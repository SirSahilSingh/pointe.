import eel
import cv2
import base64
import sys
import os
import platform
import subprocess
import time
import signal
import getpass
import settings
import numpy as np
import mediapipe as mp

from src.vision.phone_camera import PhoneCameraServer


sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from src.vision.face_mesh import FaceMeshDetector
from src.vision.face_lock import FaceLockManager
from src.controllers.mouse import MouseController

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
WEB_DIST_DIR = os.path.join(PROJECT_DIR, 'web', 'dist')
eel.init(WEB_DIST_DIR)
print(f"[SYSTEM] Serving UI from: {WEB_DIST_DIR}")
print(f"[SYSTEM] CWD: {os.getcwd()}")

is_running = True
cap = None
is_tutorial_mode = False
engine_process = None  # Store the spawned engine process
face_lock_mgr = FaceLockManager()
phone_cam_server = None  # PhoneCameraServer instance
phone_cam_active = False  # True when phone camera is the active source
engine_phone_source = False  # True while the launched engine expects phone input
engine_phone_handoff_pending = False  # True while dashboard hands phone control to the engine
preview_generation = 0  # Monotonic token so only the newest preview loop stays alive
current_camera_meta = {'source': 'webcam', 'width': settings.FRAME_WIDTH, 'height': settings.FRAME_HEIGHT, 'mp': round((settings.FRAME_WIDTH * settings.FRAME_HEIGHT) / 1_000_000, 1)}


def _restart_preview_stream():
    """Invalidate the current preview worker and spawn a new one.

    Idempotent for rapid repeated calls: each call bumps preview_generation
    and spawns a worker, but only the latest-generation worker will pass
    GATE 1 inside stream_camera() and actually acquire resources.  Intermediate
    workers exit silently before opening any camera or IPC socket.

    Resource cleanup (camera release, IPC socket close) is owned by the
    dying worker — we do NOT release cap here.
    """
    global preview_generation
    preview_generation += 1
    eel.spawn(stream_camera)


def _open_local_camera():
    backend = cv2.CAP_DSHOW if os.name == 'nt' else cv2.CAP_ANY
    local_cap = cv2.VideoCapture(settings.CAMERA_INDEX, backend)
    if not local_cap.isOpened():
        print(f"[stream_camera] Failed to open camera index {settings.CAMERA_INDEX}")
        return None
    try:
        local_cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*'MJPG'))
    except Exception:
        pass
    try:
        local_cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
    except Exception:
        pass
    print(f"[stream_camera] Camera opened (index={settings.CAMERA_INDEX})")
    return local_cap


def _send_camera_meta(source, frame):
    global current_camera_meta
    if frame is None or len(frame.shape) < 2:
        return
    height, width = frame.shape[:2]
    meta = {
        'source': source,
        'width': width,
        'height': height,
        'mp': round((width * height) / 1_000_000, 1),
    }
    if meta != current_camera_meta:
        current_camera_meta = meta
        try:
            eel.updateCameraMeta(meta)()
        except Exception:
            pass


def _publish_camera_meta(meta):
    global current_camera_meta
    if not meta:
        return
    normalized = {
        'source': meta.get('source', current_camera_meta.get('source', 'webcam')),
        'width': int(meta.get('width', current_camera_meta.get('width', settings.FRAME_WIDTH))),
        'height': int(meta.get('height', current_camera_meta.get('height', settings.FRAME_HEIGHT))),
        'mp': float(meta.get('mp', current_camera_meta.get('mp', round((settings.FRAME_WIDTH * settings.FRAME_HEIGHT) / 1_000_000, 1)))),
    }
    if normalized != current_camera_meta:
        current_camera_meta = normalized
        try:
            eel.updateCameraMeta(normalized)()
        except Exception:
            pass


def _prepare_display_frame(frame, target_width=480, target_height=270):
    if frame is None:
        return frame
    height, width = frame.shape[:2]
    if height <= 0 or width <= 0:
        return frame

    target_ratio = target_width / target_height
    frame_ratio = width / height

    if frame_ratio > target_ratio:
        crop_width = int(height * target_ratio)
        x1 = max((width - crop_width) // 2, 0)
        cropped = frame[:, x1:x1 + crop_width]
    else:
        crop_height = int(width / target_ratio)
        y1 = max((height - crop_height) // 2, 0)
        cropped = frame[y1:y1 + crop_height, :]

    return cv2.resize(cropped, (target_width, target_height))


def _sync_phone_preview_source(server_status=None):
    """Switch the dashboard preview to phone only once WebRTC is actually live."""
    global phone_cam_active, phone_cam_server, engine_process

    if not phone_cam_server or not phone_cam_server.is_running:
        desired_phone_active = False
    else:
        status = server_status or phone_cam_server.get_status()
        desired_phone_active = status == 'streaming'

    if desired_phone_active != phone_cam_active:
        phone_cam_active = desired_phone_active
        if not (engine_process and engine_process.poll() is None):
            _restart_preview_stream()

    return phone_cam_active


@eel.expose
def set_tutorial_mode(state):
    global is_tutorial_mode
    is_tutorial_mode = state
    print(f"[SYSTEM] Tutorial Mode: {state}")


@eel.expose
def get_current_settings():
    """Returns the current settings so the UI can hydrate on load."""
    return {
        'sens_x': settings.SENSITIVITY_X,
        'sens_y': settings.SENSITIVITY_Y,
        'smoothing': getattr(settings, 'SMOOTHING', 0.03),
        'acceleration': getattr(settings, 'ACCELERATION', 1.6),
        'deadzone': getattr(settings, 'DEADZONE', 0.03),
        'lclick': settings.GESTURE_MAPPINGS.get('left_click', 'left_wink'),
        'rclick': settings.GESTURE_MAPPINGS.get('right_click', 'right_wink'),
        'dclick': settings.GESTURE_MAPPINGS.get('double_click', 'pucker'),
        'media_pp': settings.GESTURE_MAPPINGS.get('media_play_pause', 'open_palm'),
        'drag': settings.GESTURE_MAPPINGS.get('drag_drop', 'jaw_drop'),
        'scroll': settings.GESTURE_MAPPINGS.get('scroll', 'both_closed'),
        'media_auto_pause': getattr(settings, 'MEDIA_AUTO_PAUSE', True),
        'scroll_enabled': getattr(settings, 'SCROLL_ENABLED', True),
        'mouse_control_enabled': getattr(settings, 'MOUSE_CONTROL_ENABLED', True),
        'pinch_copy_paste': getattr(settings, 'PINCH_COPY_PASTE', True),
        'hand_swap_window': getattr(settings, 'HAND_SWAP_WINDOW_SWITCH', True),
        'face_lock_enabled': getattr(settings, 'FACE_LOCK_ENABLED', False),
        'face_lock_timeout': getattr(settings, 'FACE_LOCK_TIMEOUT', 30),
        'face_lock_on_unknown': getattr(settings, 'FACE_LOCK_ON_UNKNOWN', False),
        'face_lock_faces': face_lock_mgr.get_registered_faces(),
        'camera_source': getattr(settings, 'CAMERA_SOURCE', 0),
        'gesture_calibration': getattr(settings, 'GESTURE_CALIBRATION', {}),
        'camera_meta': current_camera_meta,
    }


@eel.expose
def get_default_settings():
    """Return canonical default settings (single source of truth).

    Values here mirror the module-level defaults in settings.py.
    The frontend Reset-to-Defaults button uses this endpoint so there
    is no duplicated default-config object in JS.
    """
    return settings.get_default_ui_config()


@eel.expose
def get_system_info():
    """Returns system metadata for the UI footer and dashboard."""
    version = 'v1.0.0'
    try:
        version_path = os.path.join(PROJECT_DIR, 'VERSION')
        with open(version_path, 'r') as f:
            version = 'v' + f.read().strip()
    except (OSError, IOError):
        pass
    return {
        'resolution': f"{settings.FRAME_WIDTH} × {settings.FRAME_HEIGHT}",
        'platform': platform.system(),
        'version': version
    }


@eel.expose
def get_user_name():
    """Returns the current OS username for the dashboard greeting."""
    try:
        return getpass.getuser()
    except Exception:
        return 'User'


def _build_persist_config(config, override_cam_source=None):
    """Convert frontend config dict into settings.py expected schema."""
    selected_source = config.get('camera_source', getattr(settings, 'CAMERA_SOURCE', settings.CAMERA_INDEX))
    cam_source = override_cam_source if override_cam_source is not None else selected_source

    gesture_mapping = {
        'left_click': config.get('lclick', 'left_wink'),
        'right_click': config.get('rclick', 'right_wink'),
        'double_click': config.get('dclick', 'pucker'),
        'media_play_pause': config.get('media_pp', 'open_palm'),
        'drag_drop': config.get('drag', 'jaw_drop'),
        'scroll': config.get('scroll', 'both_closed'),
    }

    duplicate_assignments = {}
    enabled_actions = ['left_click', 'right_click', 'double_click', 'media_play_pause', 'drag_drop']
    if config.get('scroll_enabled', True):
        enabled_actions.append('scroll')

    for action in enabled_actions:
        gesture = gesture_mapping.get(action, 'none')
        if not gesture or gesture == 'none':
            continue
        duplicate_assignments.setdefault(gesture, []).append(action)

    conflicts = {
        gesture: actions
        for gesture, actions in duplicate_assignments.items()
        if len(actions) > 1
    }
    if conflicts:
        conflict_text = ", ".join(
            f"{gesture}: {', '.join(actions)}" for gesture, actions in conflicts.items()
        )
        raise ValueError(f"Duplicate gesture mappings are not allowed ({conflict_text})")
    
    return {
        'CAMERA_INDEX': settings.CAMERA_INDEX,
        'CAMERA_SOURCE': cam_source,
        'FRAME_WIDTH': settings.FRAME_WIDTH,
        'FRAME_HEIGHT': settings.FRAME_HEIGHT,
        'SENSITIVITY_X': float(config.get('sens_x', 2.0)),
        'SENSITIVITY_Y': float(config.get('sens_y', 2.0)),
        'SMOOTHING': float(config.get('smoothing', 0.03)),
        'ACCELERATION': float(config.get('acceleration', 1.6)),
        'DEADZONE': float(config.get('deadzone', 0.03)),
        'GESTURE_MAPPINGS': gesture_mapping,
        'GESTURE_CALIBRATION': config.get('gesture_calibration', {}),
        'MEDIA_AUTO_PAUSE': config.get('media_auto_pause', True),
        'SCROLL_ENABLED': config.get('scroll_enabled', True),
        'MOUSE_CONTROL_ENABLED': config.get('mouse_control_enabled', True),
        'PINCH_COPY_PASTE': config.get('pinch_copy_paste', True),
        'HAND_SWAP_WINDOW_SWITCH': config.get('hand_swap_window', True),
        'FACE_LOCK_ENABLED': config.get('face_lock_enabled', False),
        'FACE_LOCK_TIMEOUT': config.get('face_lock_timeout', 30),
        'FACE_LOCK_ON_UNKNOWN': config.get('face_lock_on_unknown', False),
    }


@eel.expose
def save_settings(config):
    """Save settings and reload backend state. Does NOT launch engine."""
    try:
        persist = _build_persist_config(config)
        settings.save_config(persist)
        settings.load_config()
        print("[SYSTEM] Settings successfully saved immediately.")
        return {'success': True}
    except Exception as e:
        err = f"Failed to save settings: {e}"
        print(f"[SYSTEM] Warning: {err}")
        return {'success': False, 'error': err}



@eel.expose
def save_and_launch(config):
    global engine_process, is_running, cap, phone_cam_active, preview_generation
    global engine_phone_source, engine_phone_handoff_pending

    # Kill any existing engine process first to free the IPC port
    if engine_process and engine_process.poll() is None:
        try:
            engine_process.terminate()
            engine_process.wait(timeout=3)
        except subprocess.TimeoutExpired:
            engine_process.kill()
        except Exception:
            pass
        engine_process = None
        time.sleep(0.5)  # Let OS release the port

    # Determine camera source — use config as source of truth,
    # override to 'phone' only if actively connected
    selected_source = config.get('camera_source', getattr(settings, 'CAMERA_SOURCE', settings.CAMERA_INDEX))
    cam_source = selected_source
    if phone_cam_active:
        cam_source = 'phone'
    engine_phone_source = cam_source == 'phone'
    engine_phone_handoff_pending = engine_phone_source

    # Build config dict for JSON persistence
    try:
        persist = _build_persist_config(config, cam_source)
    except ValueError as exc:
        print(f"[SYSTEM] Launch blocked: {exc}")
        return {'success': False, 'error': str(exc)}

    # Save to JSON and reload into the settings module
    try:
        settings.save_config(persist)
        settings.load_config()
    except Exception as e:
        print(f"[SYSTEM] Warning: Failed to save config: {e}")

    # Free up phone server ports for main.py to start its own server
    global phone_cam_server
    if phone_cam_active and phone_cam_server:
        phone_cam_active = False
        phone_cam_server.stop()
        phone_cam_server = None
        # Wait for OS to release the ports before engine starts
        time.sleep(0.5)

    print("[SYSTEM] Settings Saved. Booting pointe...")
    project_dir = os.path.dirname(os.path.abspath(__file__))
    engine_process = subprocess.Popen([sys.executable, "main.py"], cwd=project_dir)

    # Invalidate old preview worker and spawn a new IPC-oriented one.
    # The new worker will see engine_process is alive and enter IPC mode.
    _restart_preview_stream()

    # Notify the JS frontend
    try:
        eel.engine_launched()()
    except Exception:
        pass
    return {'success': True}


@eel.expose
def kill_engine():
    """Kill the running engine process and restart dashboard camera."""
    global engine_process, is_running, phone_cam_server, phone_cam_active
    global engine_phone_source, engine_phone_handoff_pending
    if engine_process and engine_process.poll() is None:
        try:
            engine_process.terminate()
            engine_process.wait(timeout=3)
        except subprocess.TimeoutExpired:
            engine_process.kill()
        print("[SYSTEM] Engine terminated.")

        # If phone camera was active, restart the phone camera server
        was_phone = engine_phone_source
        if was_phone and phone_cam_server is None:
            time.sleep(1.0)  # Let engine release the ports
            phone_cam_server = PhoneCameraServer()
            phone_cam_server.start()
            print("[SYSTEM] Phone camera server restarted.")
            phone_cam_active = False

        engine_phone_source = False
        engine_phone_handoff_pending = False

        # Clear engine_process BEFORE restarting preview so the new
        # worker sees no engine and enters webcam/phone mode, not IPC.
        engine_process = None

        # Invalidate old IPC worker and spawn a new webcam worker.
        # The dying IPC worker cleans up its own socket.
        _restart_preview_stream()

        try:
            eel.engine_killed()()
        except Exception:
            pass
        return True
    engine_process = None
    return False


@eel.expose
def get_engine_status():
    """Return authoritative engine state for frontend hydration."""
    if engine_process and engine_process.poll() is None:
        return {'running': True, 'phone_source': engine_phone_source}
    return {'running': False, 'phone_source': False}


@eel.expose
def register_face():
    """Capture the current camera frame and register a new face (single shot)."""
    global cap
    if cap is None or not cap.isOpened():
        return {'success': False, 'error': 'Camera not available.'}
    ok, frame, *_ = cap.read()
    if not ok:
        return {'success': False, 'error': 'Could not capture frame.'}
    face_id, result = face_lock_mgr.register_face(frame)
    if face_id:
        return {'success': True, 'id': face_id}
    return {'success': False, 'error': result}


@eel.expose
def capture_face_frame():
    """Capture a single frame for multi-pose face registration.
    Returns base64-encoded frame or error."""
    import base64
    global cap
    if cap is None or not cap.isOpened():
        return {'success': False, 'error': 'Camera not available.'}
    ok, frame, *_ = cap.read()
    if not ok:
        return {'success': False, 'error': 'Could not capture frame.'}
    _, buf = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
    b64 = base64.b64encode(buf).decode('utf-8')
    return {'success': True, 'frame': b64}


@eel.expose
def register_face_multi(frames_b64):
    """Register a face from multiple base64-encoded frames (multi-pose scan)."""
    import base64
    frames = []
    for b64 in frames_b64:
        data = base64.b64decode(b64)
        arr = np.frombuffer(data, np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is not None:
            frames.append(img)
    if not frames:
        return {'success': False, 'error': 'No valid frames received.'}
    face_id, err = face_lock_mgr.register_face_multi(frames)
    if face_id:
        return {'success': True, 'id': face_id}
    return {'success': False, 'error': err}


@eel.expose
def delete_face(face_id):
    """Delete a registered face."""
    face_lock_mgr.delete_face(face_id)
    return {'success': True}


@eel.expose
def get_registered_faces():
    """Return list of registered face IDs and thumbnails."""
    return face_lock_mgr.get_registered_faces()


@eel.expose
def activate_shortcut(action):
    """Activates a keyboard shortcut from the UI."""
    try:
        import keyboard
    except ImportError:
        print("[SYSTEM] keyboard module not available on this platform.")
        return False
    shortcut_map = {
        'toggle_mouse': 'ctrl+m',
        'recalibrate': 'ctrl+c',
        'quit_engine': 'ctrl+q'
    }
    combo = shortcut_map.get(action)
    if combo:
        keyboard.press_and_release(combo)
        print(f"[SYSTEM] Activated shortcut: {combo}")
        return True
    return False


# ─── PHONE CAMERA ENDPOINTS ────────────────────────────────

@eel.expose
def start_phone_camera():
    """Start the phone camera server and return QR code + URL."""
    global phone_cam_server
    try:
        if phone_cam_server and phone_cam_server.is_running:
            status = phone_cam_server.get_status()
            _sync_phone_preview_source(status)
            return {
                'success': True,
                'qr': phone_cam_server.qr_base64,
                'url': phone_cam_server.url,
                'status': status,
                'network_scope': phone_cam_server.network_scope,
                'config_warning': phone_cam_server.config_warning,
                'local_url': phone_cam_server.local_url,
                'error': phone_cam_server.last_error,
            }

        phone_cam_server = PhoneCameraServer()
        phone_cam_server.start()
        status = phone_cam_server.get_status()
        _sync_phone_preview_source(status)

        return {
            'success': True,
            'qr': phone_cam_server.qr_base64,
            'url': phone_cam_server.url,
            'status': status,
            'network_scope': phone_cam_server.network_scope,
            'config_warning': phone_cam_server.config_warning,
            'local_url': phone_cam_server.local_url,
            'error': phone_cam_server.last_error,
        }
    except Exception as e:
        return {'success': False, 'error': str(e)}


@eel.expose
def stop_phone_camera():
    """Stop the phone camera server and switch back to webcam."""
    global phone_cam_server, phone_cam_active, engine_phone_source, engine_phone_handoff_pending
    phone_cam_active = False
    engine_phone_source = False
    engine_phone_handoff_pending = False

    if phone_cam_server:
        phone_cam_server.stop()
        phone_cam_server = None

    _restart_preview_stream()
    return {'success': True}


@eel.expose
def get_phone_camera_status():
    """Return the current phone camera connection status."""
    if phone_cam_server and phone_cam_server.is_running:
        status = phone_cam_server.get_status()
        _sync_phone_preview_source(status)
        return {
            'status': status,
            'url': phone_cam_server.url,
            'network_scope': phone_cam_server.network_scope,
            'config_warning': phone_cam_server.config_warning,
            'local_url': phone_cam_server.local_url,
            'error': phone_cam_server.last_error,
            'active_preview': phone_cam_active,
        }
    if engine_process and engine_process.poll() is None and engine_phone_source:
        return {
            'status': 'handoff' if engine_phone_handoff_pending else 'engine',
            'url': '',
            'network_scope': 'local',
            'config_warning': '',
            'local_url': '',
            'error': '',
            'active_preview': False,
        }
    return {'status': 'idle', 'error': '', 'active_preview': False}


def stream_camera():
    """Single-owner preview loop.

    Each invocation snapshots preview_generation at birth.  After the initial
    sleep the worker checks GATE 1 — if its generation is already stale
    (another _restart_preview_stream() fired) it exits *before* opening any
    resource.  Inside the main loop, GATE 2 checks prevent stale workers
    from retrying IPC connections or camera opens.

    Resource ownership: whatever THIS worker opens (webcam, IPC socket) it
    cleans up on exit.  No other function releases these resources.
    """
    global is_running, cap, is_tutorial_mode, phone_cam_active, phone_cam_server
    global engine_process, preview_generation
    global engine_phone_source, engine_phone_handoff_pending

    frame_send_count = 0
    my_generation = preview_generation  # snapshot at birth

    # Wait for browser to connect and React to mount before sending frames
    print(f"[stream_camera gen={my_generation}] Waiting for browser connection...")
    eel.sleep(2.0)

    # ── GATE 1: stale? exit before touching anything ────────────────────
    if not is_running or my_generation != preview_generation:
        print(f"[stream_camera gen={my_generation}] Stale at GATE 1, exiting.")
        return

    print(f"[stream_camera gen={my_generation}] Starting camera stream...")

    import socket
    import json

    # --- Resources owned by THIS worker (cleaned up on exit) ---
    local_ipc_conn = None
    local_cap = None  # webcam opened by this worker (NOT phone capture)
    buffer_str = ""

    try:
        # Choose camera source based on current state
        engine_alive = engine_process and engine_process.poll() is None

        if engine_alive:
            # IPC mode — don't open any camera, receive frames from engine
            print(f"[stream_camera gen={my_generation}] Entering IPC mode.")
            cap = None
        elif phone_cam_active and phone_cam_server:
            # Phone mode — use phone server's capture surface
            cam = getattr(phone_cam_server, 'capture', None)
            if cam is None:
                print(f"[stream_camera gen={my_generation}] Phone capture not ready, waiting...")
                for _ in range(50):  # Wait up to 5s
                    eel.sleep(0.1)
                    if my_generation != preview_generation:
                        print(f"[stream_camera gen={my_generation}] Stale during phone wait, exiting.")
                        return
                    cam = getattr(phone_cam_server, 'capture', None)
                    if cam is not None:
                        break
            cap = cam
        else:
            # Webcam mode — open local camera (this worker owns it)
            local_cap = _open_local_camera()
            if local_cap is None:
                print(f"[stream_camera gen={my_generation}] Failed to open webcam, exiting.")
                return
            cap = local_cap

        detector = FaceMeshDetector()

        # Hand detector for palm detection
        mp_hands = mp.solutions.hands
        hand_detector = mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=1,
            min_detection_confidence=0.6,
            min_tracking_confidence=0.5
        )

        # MouseController for tutorial detection math only — no cursor moves
        mouse_referee = MouseController()

        while is_running and my_generation == preview_generation:
            # ── GATE 2: check generation before any blocking call ────────

            # --- IPC FEED IF ENGINE IS RUNNING ---
            if engine_process and engine_process.poll() is None:
                try:
                    if not local_ipc_conn:
                        if my_generation != preview_generation:
                            break  # GATE 2
                        local_ipc_conn = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                        local_ipc_conn.settimeout(0.5)
                        try:
                            local_ipc_conn.connect(('127.0.0.1', 11337))
                            local_ipc_conn.setblocking(False)
                            buffer_str = ""
                            print(f"[stream_camera gen={my_generation}] IPC connected to engine.")
                            engine_phone_handoff_pending = False
                        except (ConnectionRefusedError, OSError, socket.timeout):
                            local_ipc_conn.close()
                            local_ipc_conn = None
                            eel.sleep(0.3)
                            continue

                    try:
                        data = local_ipc_conn.recv(4096 * 1024).decode('utf-8')
                        if data:
                            buffer_str += data
                        else:
                            raise ConnectionError()
                    except BlockingIOError:
                        eel.sleep(0.01)
                        continue

                    if "\n" in buffer_str:
                        lines = buffer_str.split("\n")
                        buffer_str = lines.pop()  # Keep the remainder
                        if lines:
                            latest_json = lines[-1]
                            if latest_json.strip():
                                data_obj = json.loads(latest_json)
                                eel.updateImage(data_obj["frame"])()
                                eel.updateTelemetry(data_obj.get("telemetry", data_obj["face_detected"]))()
                                camera_meta = data_obj.get("camera_meta")
                                if camera_meta:
                                    _publish_camera_meta(camera_meta)
                                    if engine_phone_source and camera_meta.get("source") != "phone":
                                        engine_phone_source = False
                                        engine_phone_handoff_pending = False
                                        try:
                                            eel.phone_camera_disconnected()()
                                        except Exception:
                                            pass
                except Exception:
                    if local_ipc_conn:
                        local_ipc_conn.close()
                        local_ipc_conn = None
                    eel.sleep(0.2)
                continue

            # --- Engine died or was killed: detect and notify ---
            if engine_process is not None and engine_process.poll() is not None:
                # The engine exited unexpectedly.  Clean up IPC and notify UI.
                if local_ipc_conn:
                    try:
                        local_ipc_conn.close()
                    except Exception:
                        pass
                    local_ipc_conn = None
                    buffer_str = ""

                engine_process = None  # Clear stale reference
                engine_phone_handoff_pending = False
                print(f"[stream_camera gen={my_generation}] Engine exited — restarting local camera.")

                if engine_phone_source and phone_cam_server is None:
                    time.sleep(0.5)
                    try:
                        phone_cam_server = PhoneCameraServer()
                        phone_cam_server.start()
                        cap = None
                    except Exception:
                        pass
                elif cap is None:
                    local_cap = _open_local_camera()
                    cap = local_cap
                engine_phone_source = False
                try:
                    eel.engine_killed()()
                except Exception:
                    pass

            # --- LOCAL CAPTURE IF ENGINE IS OFF ---
            if cap is None:
                eel.sleep(0.1)
                continue

            if phone_cam_active and phone_cam_server:
                phone_status = phone_cam_server.get_status()
                if phone_status in ('error', 'idle') or (phone_status == 'waiting' and phone_cam_server.has_streamed):
                    print(f"[stream_camera gen={my_generation}] Phone '{phone_status}' — falling back to webcam.")
                    phone_cam_active = False
                    # Don't release phone capture — phone_cam_server owns it.
                    local_cap = _open_local_camera()
                    cap = local_cap
                    frame_send_count = 0
                    if cap is None:
                        eel.sleep(0.1)
                        continue
                    try:
                        eel.phone_camera_disconnected()()
                    except Exception:
                        pass
                    eel.sleep(0.05)
                    continue

            try:
                success, frame, *_ = cap.read()
            except Exception as read_err:
                print(f"[stream_camera gen={my_generation}] cap.read() exception: {read_err}")
                eel.sleep(0.1)
                continue

            if not success:
                eel.sleep(0.01)
                continue

            current_source = 'phone' if phone_cam_active and phone_cam_server else 'webcam'
            _send_camera_meta(current_source, frame)

            # ONLY run expensive AI detection if we are actively in the tutorial
            face_detected = False
            if is_tutorial_mode:
                frame, results = detector.process_frame(frame, draw=False)
                face_detected = bool(results.multi_face_landmarks)

                # --- Palm detection ---
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                hand_results = hand_detector.process(rgb_frame)

                # --- THE REFEREE LOGIC (TUTORIAL) ---
                if face_detected:
                    face = results.multi_face_landmarks[0]

                    if not mouse_referee.is_agent_calibrated:
                        if mouse_referee.calibrate_agent(face):
                            eel.tutorial_event("calibrated")()

                    gestures = mouse_referee.detect_gestures(face, hand_results)
                    if gestures:
                        eel.tutorial_event(gestures[0])()
                        eel.sleep(0.5)

            # Resize and send frame to UI (lower res = much faster b64 transfer)
            display_frame = _prepare_display_frame(frame, 480, 270)
            _, buffer = cv2.imencode('.jpg', display_frame, [cv2.IMWRITE_JPEG_QUALITY, 60])
            b64_str = base64.b64encode(buffer).decode('utf-8')

            try:
                eel.updateImage(b64_str)()
                eel.updateTelemetry(face_detected)()
                frame_send_count += 1
                if frame_send_count == 1:
                    print(f"[stream_camera gen={my_generation}] First frame sent to JS!")
                elif frame_send_count % 100 == 0:
                    print(f"[stream_camera gen={my_generation}] {frame_send_count} frames sent")
            except Exception as e:
                if frame_send_count == 0:
                    print(f"[stream_camera gen={my_generation}] Failed to send frame: {e}")

            # Yield briefly to let Eel send WebSockets without hogging CPU
            eel.sleep(0.005)

    except Exception as e:
        print(f"[stream_camera gen={my_generation}] Fatal error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # ── Cleanup: release whatever THIS worker opened ────────────────
        if local_ipc_conn:
            try:
                local_ipc_conn.close()
            except Exception:
                pass
        if local_cap:
            try:
                local_cap.release()
            except Exception:
                pass
            # Clear global cap only if it's still pointing to our local capture
            if cap is local_cap:
                cap = None
        print(f"[stream_camera gen={my_generation}] Worker exited.")


eel.spawn(stream_camera)

try:
    eel.start('index.html', size=(1100, 700), position=(200, 80))
except (SystemExit, KeyboardInterrupt):
    is_running = False
    if cap: cap.release()
    if engine_process and engine_process.poll() is None:
        engine_process.terminate()
