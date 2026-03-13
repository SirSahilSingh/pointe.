import cv2
import settings
import sys
import os
import time
import threading
import keyboard
import mediapipe as mp

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from src.vision.face_mesh import FaceMeshDetector
from src.vision.face_lock import FaceLockManager
from src.controllers.parallax import ParallaxController
from src.controllers.mouse import MouseController
from src.math_utils.filters import MotionEngine
from src.controllers.hud import FloatingHUD
from src.vision.bufferless_capture import BufferlessCapture
from src.debug.telemetry import TelemetryOverlay
from src.debug.signal_logger import SignalLogger
from src.debug.noise_measurement import NoiseMeasurement



# --- GLOBAL HOTKEY FLAGS ---
trigger_recalibrate = False
trigger_toggle_mouse = False
trigger_quit = False
trigger_debug_toggle = False
trigger_noise_measure = False


def set_recalibrate(): global trigger_recalibrate; trigger_recalibrate = True


def set_toggle(): global trigger_toggle_mouse; trigger_toggle_mouse = True


def set_quit(): global trigger_quit; trigger_quit = True


def set_debug_toggle(): global trigger_debug_toggle; trigger_debug_toggle = True


def set_noise_measure(): global trigger_noise_measure; trigger_noise_measure = True


# Assign OS-Level Shortcuts
keyboard.add_hotkey('ctrl+c', set_recalibrate)
keyboard.add_hotkey('ctrl+m', set_toggle)
keyboard.add_hotkey('ctrl+q', set_quit)
keyboard.add_hotkey('ctrl+d', set_debug_toggle)
keyboard.add_hotkey('ctrl+n', set_noise_measure)


# ─── Shared state between MediaPipe thread and main loop ───
class _TrackingState:
    """Thread-safe container for latest MediaPipe results."""
    def __init__(self):
        self.lock = threading.Lock()
        self.has_face = False
        self.face = None           # latest face landmarks
        self.hand_results = None   # latest hand results
        self.frame = None          # latest camera frame (for IPC/face_lock)
        self.yaw = 0.0
        self.pitch = 0.0
        self.face_width_norm = 0.2
        self.left_ear_x = 0.0
        self.right_ear_x = 0.0
        self.aspect_ratio = 1.333
        self.result_id = 0         # incremented on each new result
        self.mp_time_ms = 0.0      # last MediaPipe processing time


def _mediapipe_worker(cap, detector, hand_detector, state, running_flag):
    """Background thread: grab frames and run MediaPipe at a controlled rate.

    Rate-limited to ~25fps to prevent thermal throttling, and hands are
    processed only every 3rd frame to cut CPU load.
    """
    last_frame_id = -1
    first_logged = False
    frame_count = 0
    _HANDS_EVERY_N = 3           # process hands every Nth face frame
    _TARGET_MP_FPS = 35          # max processing rate
    _MIN_MP_PERIOD = 1.0 / _TARGET_MP_FPS
    _cached_hand_results = None  # reuse between hand-processing frames

    while running_flag[0]:
        iter_start = time.perf_counter()

        ok, img, frame_id = cap.read()
        if not ok or img is None:
            time.sleep(0.005)
            continue

        # Skip duplicate frames
        if frame_id == last_frame_id:
            time.sleep(0.002)
            continue
        last_frame_id = frame_id
        frame_count += 1

        # One-shot resolution log
        if not first_logged:
            print(f"[CAMERA] Frame resolution: {img.shape}")
            first_logged = True

        h, w, _ = img.shape
        aspect = w / float(h)

        # Downscale to 240×180 (smaller = faster, landmarks are normalized 0-1)
        img_mp = cv2.resize(img, (240, 180), interpolation=cv2.INTER_AREA)
        rgb_img = cv2.cvtColor(img_mp, cv2.COLOR_BGR2RGB)

        t0 = time.perf_counter()
        results = detector.face_mesh.process(rgb_img)

        # Process hands only every Nth frame to reduce CPU
        if frame_count % _HANDS_EVERY_N == 0:
            _cached_hand_results = hand_detector.process(rgb_img)

        mp_ms = (time.perf_counter() - t0) * 1000

        # Extract face data and publish atomically
        if results.multi_face_landmarks:
            face = results.multi_face_landmarks[0]

            face_cx = (face.landmark[1].x + face.landmark[4].x + face.landmark[5].x +
                       face.landmark[197].x + face.landmark[168].x) / 5.0
            face_cy = (face.landmark[1].y + face.landmark[4].y + face.landmark[5].y +
                       face.landmark[197].y + face.landmark[168].y) / 5.0

            left_ear_x = face.landmark[234].x
            right_ear_x = face.landmark[454].x
            forehead_y = face.landmark[10].y
            chin_y = face.landmark[152].y

            face_w_norm = abs(left_ear_x - right_ear_x)

            left_portion = face_cx - left_ear_x
            right_portion = right_ear_x - face_cx
            total_h = left_portion + right_portion
            yaw = (left_portion - right_portion) / max(total_h, 0.001)

            upper = face_cy - forehead_y
            lower = chin_y - face_cy
            total_v = upper + lower
            pitch = (upper - lower) / max(total_v, 0.001)

            with state.lock:
                state.has_face = True
                state.face = face
                state.hand_results = _cached_hand_results
                state.frame = img
                state.yaw = yaw
                state.pitch = pitch
                state.face_width_norm = face_w_norm
                state.left_ear_x = left_ear_x
                state.right_ear_x = right_ear_x
                state.aspect_ratio = aspect
                state.result_id += 1
                state.mp_time_ms = mp_ms
        else:
            with state.lock:
                state.has_face = False
                state.face = None
                state.hand_results = _cached_hand_results
                state.frame = img
                state.result_id += 1
                state.mp_time_ms = mp_ms

        # Rate-limit: sleep to yield CPU/GIL to main thread and prevent
        # thermal throttling. This is the KEY fix for FPS degradation.
        elapsed = time.perf_counter() - iter_start
        sleep_time = _MIN_MP_PERIOD - elapsed
        if sleep_time > 0:
            time.sleep(sleep_time)
        else:
            # Even if over budget, yield GIL briefly
            time.sleep(0.001)


def main():
    global trigger_recalibrate, trigger_toggle_mouse, trigger_quit
    global trigger_debug_toggle, trigger_noise_measure

    print("\n[SYSTEM] pointe is now running in Stealth Mode.")
    print("  Ctrl+M -> Toggle Mouse")
    print("  Ctrl+C -> Recalibrate Face")
    print("  Ctrl+D -> Toggle Debug Overlay")
    print("  Ctrl+N -> Noise Measurement")
    print("  Ctrl+Q -> Quit Engine\n")

    import socket
    import json
    import base64
    IPC_PORT = 11337
    ipc_server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    # Retry binding — previous engine may still be releasing the port
    for attempt in range(10):
        try:
            ipc_server.bind(('127.0.0.1', IPC_PORT))
            break
        except OSError:
            if attempt < 9:
                time.sleep(0.5)
            else:
                print(f"[SYSTEM] Could not bind IPC port {IPC_PORT} after 10 attempts. Exiting.")
                sys.exit(1)
    ipc_server.listen(1)
    ipc_server.setblocking(False)
    client_conn = None

    # Decide source
    source = settings.CAMERA_INDEX
    camera_source = getattr(settings, 'CAMERA_SOURCE', 0)

    if camera_source == 'phone':
        # Use the phone camera's BufferlessCapture
        from src.vision.phone_camera import PhoneCameraServer
        # Connect to the already-running server started by dashboard
        phone_server = PhoneCameraServer()
        phone_server.start()
        cap = phone_server.capture
        print("[SYSTEM] Using phone camera as video source.")
    else:
        backend = cv2.CAP_DSHOW if os.name == 'nt' else cv2.CAP_ANY
        cap = BufferlessCapture(source, backend)
        # Request MJPG codec — many USB cameras deliver higher FPS with
        # compressed transport than raw YUV
        cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*'MJPG'))
        cap.set(cv2.CAP_PROP_FPS, 30)
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        import time as _t; _t.sleep(0.5)  # let threaded reader grab first frame

    detector = FaceMeshDetector()
    parallax = ParallaxController(settings.SENSITIVITY_X, settings.SENSITIVITY_Y)
    mouse = MouseController()
    motion_engine = MotionEngine()

    # --- HUD disabled for testing (tkinter blocking issue) ---
    class _NoOpHUD:
        """Stub that silently eats all HUD/telemetry calls."""
        def __getattr__(self, _): return lambda *a, **kw: None
    hud = _NoOpHUD()

    # --- Debug telemetry (disabled while HUD is off) ---
    telemetry = _NoOpHUD()
    signal_log = SignalLogger()
    noise_tool = NoiseMeasurement()

    # Face lock manager
    face_lock = None
    if getattr(settings, 'FACE_LOCK_ENABLED', False):
        face_lock = FaceLockManager()

    # Initialize hand detector for palm detection
    mp_hands = mp.solutions.hands
    hand_detector = mp_hands.Hands(
        static_image_mode=False,
        max_num_hands=1,
        min_detection_confidence=0.6,
        min_tracking_confidence=0.5
    )

    calibrated_fw_norm = 0.2
    is_mirrored = False
    mouse_active = getattr(settings, 'MOUSE_CONTROL_ENABLED', True)

    # --- Shared tracking state ---
    tracking = _TrackingState()
    _last_result_id = -1

    # --- Start MediaPipe background thread ---
    _mp_running = [True]
    mp_thread = threading.Thread(
        target=_mediapipe_worker,
        args=(cap, detector, hand_detector, tracking, _mp_running),
        daemon=True
    )
    mp_thread.start()
    print("[SYSTEM] MediaPipe worker thread started.")

    # --- Loop rate limiting ---
    TARGET_LOOP_HZ = 120         # cursor updates up to 120 Hz
    MIN_LOOP_PERIOD = 1.0 / TARGET_LOOP_HZ

    # --- Cached state for coasting ---
    _last_raw_dx = 0.0
    _last_raw_dy = 0.0
    _last_auto_invert_x = 1
    _last_aspect_ratio = 1.333
    _last_zoom = 1.0
    _has_face = False

    # --- Performance diagnostic ---
    DEBUG_PERF = True
    _perf_loop_count = 0
    _perf_new_results = 0
    _perf_start = time.perf_counter()
    _perf_mp_ms_accum = 0.0
    _PERF_INTERVAL_SEC = 5.0     # report every 5 seconds
    _last_ipc_time = 0.0         # IPC broadcast rate limiter

    hud.show_message("GHOST-TYPE ENGINE ACTIVE", 60)

    while True:
        loop_start = time.perf_counter()

        # 1. Check Global Hotkeys
        if trigger_quit:
            break

        if trigger_toggle_mouse:
            mouse_active = not mouse_active
            state = "ON" if mouse_active else "OFF"
            hud.show_message(f"TRACKING: {state}", 45)
            trigger_toggle_mouse = False

        if trigger_recalibrate:
            parallax.is_calibrated = False
            motion_engine.reset()
            # Move cursor to screen center on recalibrate
            mouse.cursor_x = mouse.center_x
            mouse.cursor_y = mouse.center_y
            mouse.move(0, 0)  # push to OS cursor
            hud.show_message("CALIBRATING...", 45)
            trigger_recalibrate = False

        if trigger_debug_toggle:
            telemetry.toggle()
            if telemetry.enabled:
                signal_log.start()
            else:
                signal_log.stop()
            trigger_debug_toggle = False

        if trigger_noise_measure:
            noise_tool.start()
            trigger_noise_measure = False

        # 2. Read latest tracking results (non-blocking, ~0ms)
        with tracking.lock:
            new_result = (tracking.result_id != _last_result_id)
            _last_result_id = tracking.result_id
            t_has_face = tracking.has_face
            t_face = tracking.face
            t_hand_results = tracking.hand_results
            t_yaw = tracking.yaw
            t_pitch = tracking.pitch
            t_fw_norm = tracking.face_width_norm
            t_left_ear = tracking.left_ear_x
            t_right_ear = tracking.right_ear_x
            t_aspect = tracking.aspect_ratio
            t_mp_ms = tracking.mp_time_ms

        # 3. Process new MediaPipe results (calibration, gestures)
        if new_result:
            _perf_new_results += 1
            _perf_mp_ms_accum += t_mp_ms
            _has_face = t_has_face
            _last_aspect_ratio = t_aspect

            if t_has_face and t_face is not None:
                if not parallax.is_calibrated:
                    parallax.calibrate(t_yaw, t_pitch, t_fw_norm)
                    calibrated_fw_norm = t_fw_norm
                    is_mirrored = t_left_ear > t_right_ear
                    mouse.calibrate_agent(t_face)
                    motion_engine.reset()
                    hud.show_message("CALIBRATION COMPLETE", 60)

                _last_auto_invert_x = 1 if is_mirrored else -1
                _last_raw_dx = t_yaw - parallax.neutral_x
                _last_raw_dy = t_pitch - parallax.neutral_y
                _last_zoom = parallax.get_zoom(t_fw_norm)

                # Gestures (only on new results)
                if mouse_active:
                    action_msgs = mouse.process_actions(t_face, t_hand_results)
                    if action_msgs:
                        hud.show_message(action_msgs[-1], 20)
                    presence_msg = mouse.process_presence(t_face)
                    if presence_msg:
                        hud.show_message(presence_msg, 60)
            else:
                if mouse_active:
                    presence_msg = mouse.process_presence(None)
                    if presence_msg:
                        hud.show_message(presence_msg, 60)

        # ── Motion engine runs EVERY tick (~120Hz) ──
        # On ticks between MediaPipe results it "coasts" on last yaw/pitch.
        if mouse_active and _has_face:
            dx_px, dy_px = motion_engine.update(
                _last_raw_dx, _last_raw_dy,
                _last_auto_invert_x, _last_aspect_ratio, _last_zoom)
            mouse.move(dx_px, dy_px)

            # Debug telemetry
            dbg = motion_engine.debug_state
            telemetry.update(
                raw_yaw=_last_raw_dx, raw_pitch=_last_raw_dy,
                filtered_yaw=dbg['filtered_yaw'],
                filtered_pitch=dbg['filtered_pitch'],
                velocity_x=dbg['velocity_x'],
                velocity_y=dbg['velocity_y'],
                dead_zone_active=dbg['dead_zone_active'],
                dt=dbg['dt'],
                zoom_factor=_last_zoom,
            )
            telemetry.render()
            signal_log.log_frame(
                yaw=_last_raw_dx, pitch=_last_raw_dy,
                filtered_yaw=dbg['filtered_yaw'],
                filtered_pitch=dbg['filtered_pitch'],
                velocity_x=dbg['velocity_x'],
                velocity_y=dbg['velocity_y'],
                dead_zone_triggered=dbg['dead_zone_active'],
                zoom_factor=_last_zoom,
            )

            if noise_tool.is_active:
                noise_tool.record(_last_raw_dx, _last_raw_dy)

        # 5. Face Lock Check (uses cached frame from TrackingState)
        if new_result and face_lock:
            try:
                with tracking.lock:
                    _fl_frame = tracking.frame
                if _fl_frame is not None:
                    lock_timeout = getattr(settings, 'FACE_LOCK_TIMEOUT', 30)
                    lock_on_unknown = getattr(settings, 'FACE_LOCK_ON_UNKNOWN', False)
                    lock_result = face_lock.check_lock_state(_fl_frame, lock_timeout, lock_on_unknown)
                    if lock_result == 'lock':
                        hud.show_message('SCREEN LOCKED — FACE NOT DETECTED', 120)
                    elif lock_result == 'unlock':
                        hud.show_message('SCREEN UNLOCKED — WELCOME BACK', 60)
                    elif lock_result and lock_result.startswith('countdown:'):
                        secs = lock_result.split(':')[1]
                        hud.show_message(f'LOCKING IN {secs}...', 15)
            except Exception:
                pass

        # 6. IPC Broadcast for Dashboard (rate-limited, uses cached frame)
        if new_result and (time.perf_counter() - _last_ipc_time) >= 0.2:
            _last_ipc_time = time.perf_counter()
            try:
                conn, _ = ipc_server.accept()
                conn.setblocking(False)
                if client_conn: client_conn.close()
                client_conn = conn
            except BlockingIOError:
                pass

            if client_conn:
                try:
                    with tracking.lock:
                        _ipc_frame = tracking.frame
                    if _ipc_frame is not None:
                        frame_ui = cv2.resize(_ipc_frame, (320, 180), interpolation=cv2.INTER_AREA)
                        _, buffer = cv2.imencode('.jpg', frame_ui, [cv2.IMWRITE_JPEG_QUALITY, 40])
                        b64_str = base64.b64encode(buffer).decode('utf-8')
                        payload = json.dumps({"frame": b64_str, "face_detected": _has_face}) + "\n"
                        client_conn.sendall(payload.encode('utf-8'))
                except Exception:
                    client_conn.close()
                    client_conn = None

        # 7. Update UI Overlay
        hud.update()

        # --- Performance report ---
        _perf_loop_count += 1
        if DEBUG_PERF:
            now = time.perf_counter()
            elapsed_sec = now - _perf_start
            if elapsed_sec >= _PERF_INTERVAL_SEC:
                loop_fps = _perf_loop_count / elapsed_sec
                mp_fps = _perf_new_results / elapsed_sec
                avg_mp_ms = _perf_mp_ms_accum / max(_perf_new_results, 1)
                print(f"\n=== PERFORMANCE REPORT ({elapsed_sec:.1f}s) ===")
                print(f"  {'Cursor Update Hz':<18s}: {loop_fps:7.1f}  (target: {TARGET_LOOP_HZ})")
                print(f"  {'MediaPipe FPS':<18s}: {mp_fps:7.1f}  (new detections)")
                print(f"  {'MediaPipe Avg':<18s}: {avg_mp_ms:7.1f} ms/frame")
                print(f"  {'Loop iterations':<18s}: {_perf_loop_count:7d}")
                print(f"  {'New MP results':<18s}: {_perf_new_results:7d}")
                print("==========================")
                _perf_loop_count = 0
                _perf_new_results = 0
                _perf_mp_ms_accum = 0.0
                _perf_start = now

        # --- Rate limiting: cap loop to TARGET_LOOP_HZ ---
        elapsed = time.perf_counter() - loop_start
        if elapsed < MIN_LOOP_PERIOD:
            time.sleep(MIN_LOOP_PERIOD - elapsed)

    _mp_running[0] = False
    mp_thread.join(timeout=2)
    cap.release()
    signal_log.close()
    if client_conn: client_conn.close()
    ipc_server.close()
    hand_detector.close()
    sys.exit(0)


if __name__ == "__main__":
    main()