"""
FaceLockManager — Face-based screen lock/unlock security module.

Uses MediaPipe face mesh 468-landmark embeddings for face recognition.
No additional pip dependencies required beyond what pointe already uses.
"""

import os
import time
import uuid
import cv2
import numpy as np
import mediapipe as mp

# Where registered face data is stored
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'data', 'faces')
MAX_FACES = 5
SIMILARITY_THRESHOLD = 0.82  # Cosine similarity threshold for a "match"


class FaceLockManager:
    def __init__(self):
        self.mp_face_mesh = mp.solutions.face_mesh
        self.face_mesh = self.mp_face_mesh.FaceMesh(
            static_image_mode=True,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        # Ensure data directory exists
        os.makedirs(DATA_DIR, exist_ok=True)

        # Load registered face embeddings into memory
        self.registered_faces = {}  # {face_id: np.array}
        self._load_all_faces()

        # Lock state machine
        self.face_absent_since = 0
        self.unknown_face_since = 0
        self.is_locked = False

    # ─── FACE EMBEDDING ────────────────────────────────────────

    def _extract_embedding(self, frame):
        """Extract a face embedding (468 x 3 = 1404-dim vector) from a frame.
        Returns the embedding as a 1D numpy array, or None if no face found."""
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.face_mesh.process(rgb)
        if not results.multi_face_landmarks:
            return None

        face = results.multi_face_landmarks[0]
        # Build a flat vector from all 468 landmark (x, y, z) positions
        coords = []
        for lm in face.landmark:
            coords.extend([lm.x, lm.y, lm.z])
        embedding = np.array(coords, dtype=np.float32)

        # Normalize to unit vector for cosine similarity
        norm = np.linalg.norm(embedding)
        if norm > 0:
            embedding = embedding / norm
        return embedding

    @staticmethod
    def _cosine_similarity(a, b):
        return float(np.dot(a, b))

    # ─── REGISTRATION ──────────────────────────────────────────

    def _load_all_faces(self):
        """Load all saved .npy embeddings from disk."""
        self.registered_faces = {}
        if not os.path.exists(DATA_DIR):
            return
        for fname in os.listdir(DATA_DIR):
            if fname.endswith('.npy'):
                face_id = fname.replace('.npy', '')
                path = os.path.join(DATA_DIR, fname)
                self.registered_faces[face_id] = np.load(path)

    def register_face(self, frame):
        """Register a new face from the given camera frame (single frame fallback).
        Returns (face_id, '') on success, or (None, error_msg) on failure."""
        if len(self.registered_faces) >= MAX_FACES:
            return None, "Maximum of 5 faces already registered."

        embedding = self._extract_embedding(frame)
        if embedding is None:
            return None, "No face detected in frame. Please face the camera."

        # Check if this face is already registered (avoid duplicates)
        for fid, saved_emb in self.registered_faces.items():
            sim = self._cosine_similarity(embedding, saved_emb)
            if sim > SIMILARITY_THRESHOLD:
                return None, "This face appears to already be registered."

        face_id = uuid.uuid4().hex[:8]
        np.save(os.path.join(DATA_DIR, f'{face_id}.npy'), embedding)
        self.registered_faces[face_id] = embedding
        print(f"[FACE LOCK] Registered face: {face_id}")
        return face_id, ''

    def register_face_multi(self, frames):
        """Register a face from multiple frames (different poses).
        Averages embeddings for a more robust representation.
        Returns (face_id, '') on success, or (None, error_msg) on failure."""
        if len(self.registered_faces) >= MAX_FACES:
            return None, "Maximum of 5 faces already registered."

        embeddings = []
        for frame in frames:
            emb = self._extract_embedding(frame)
            if emb is not None:
                embeddings.append(emb)

        if len(embeddings) < 2:
            return None, "Could not detect face in enough poses. Please try again."

        # Average all embeddings and re-normalize
        avg_embedding = np.mean(embeddings, axis=0).astype(np.float32)
        norm = np.linalg.norm(avg_embedding)
        if norm > 0:
            avg_embedding = avg_embedding / norm

        face_id = uuid.uuid4().hex[:8]
        np.save(os.path.join(DATA_DIR, f'{face_id}.npy'), avg_embedding)
        self.registered_faces[face_id] = avg_embedding
        print(f"[FACE LOCK] Registered face (multi-pose): {face_id}")
        return face_id, ''

    def get_registered_faces(self):
        """Return list of {id, thumbnail} for all registered faces."""
        import base64
        faces = []
        for face_id in self.registered_faces:
            thumb_path = os.path.join(DATA_DIR, f'{face_id}.jpg')
            thumb_b64 = ''
            if os.path.exists(thumb_path):
                with open(thumb_path, 'rb') as f:
                    thumb_b64 = base64.b64encode(f.read()).decode('utf-8')
            faces.append({'id': face_id, 'thumbnail': thumb_b64})
        return faces

    def delete_face(self, face_id):
        """Delete a registered face by ID."""
        npy_path = os.path.join(DATA_DIR, f'{face_id}.npy')
        jpg_path = os.path.join(DATA_DIR, f'{face_id}.jpg')
        if os.path.exists(npy_path):
            os.remove(npy_path)
        if os.path.exists(jpg_path):
            os.remove(jpg_path)
        self.registered_faces.pop(face_id, None)
        print(f"[FACE LOCK] Deleted face: {face_id}")
        return True

    # ─── IDENTIFICATION ────────────────────────────────────────

    def identify_face(self, frame):
        """Identify a face in the frame.
        Returns: 'owner'   — recognized registered face
                 'unknown' — face detected but not recognized
                 'no_face' — no face in frame at all
        """
        if not self.registered_faces:
            return 'no_face'  # No registered faces, nothing to compare

        embedding = self._extract_embedding(frame)
        if embedding is None:
            return 'no_face'

        best_sim = 0
        for fid, saved_emb in self.registered_faces.items():
            sim = self._cosine_similarity(embedding, saved_emb)
            if sim > best_sim:
                best_sim = sim

        if best_sim >= SIMILARITY_THRESHOLD:
            return 'owner'
        return 'unknown'

    # ─── LOCK STATE MACHINE ────────────────────────────────────

    def check_lock_state(self, frame, lock_timeout, lock_on_unknown=False):
        """Check whether the screen should be locked.
        Call this every frame when face lock is enabled.

        Args:
            frame: current camera frame
            lock_timeout: seconds of absence/unknown before locking
            lock_on_unknown: if True, also lock when an unregistered face is seen

        Returns:
            'lock' if the screen should be locked NOW (one-shot trigger),
            'unlock' if a registered face returned,
            None if no state change.
        """
        if not self.registered_faces:
            return None  # No faces registered, feature is inert

        now = time.time()
        identity = self.identify_face(frame)

        if identity == 'owner':
            # Recognized — reset timers and unlock
            self.face_absent_since = 0
            self.unknown_face_since = 0
            if self.is_locked:
                self.is_locked = False
                return 'unlock'
            return None

        if identity == 'no_face':
            # No face detected — start absence timer
            self.unknown_face_since = 0
            if self.face_absent_since == 0:
                self.face_absent_since = now
            elif not self.is_locked:
                elapsed = now - self.face_absent_since
                remaining = lock_timeout - elapsed
                if remaining <= 0:
                    self.is_locked = True
                    self._lock_screen()
                    return 'lock'
                elif remaining <= 5:
                    return f'countdown:{int(remaining) + 1}'

        elif identity == 'unknown' and lock_on_unknown:
            # Unknown face detected — start unknown timer
            self.face_absent_since = 0
            if self.unknown_face_since == 0:
                self.unknown_face_since = now
            elif not self.is_locked:
                elapsed = now - self.unknown_face_since
                remaining = lock_timeout - elapsed
                if remaining <= 0:
                    self.is_locked = True
                    self._lock_screen()
                    return 'lock'
                elif remaining <= 5:
                    return f'countdown:{int(remaining) + 1}'
        elif identity == 'unknown' and not lock_on_unknown:
            # Unknown face but feature off — treat as neutral, reset timers
            self.face_absent_since = 0
            self.unknown_face_since = 0

        return None

    @staticmethod
    def _lock_screen():
        """Lock the Windows workstation."""
        try:
            import ctypes
            ctypes.windll.user32.LockWorkStation()
            print("[FACE LOCK] Screen locked.")
        except Exception as e:
            print(f"[FACE LOCK] Failed to lock screen: {e}")
