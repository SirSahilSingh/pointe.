import cv2
import settings
import sys
import os
import time
import threading

try:
    import keyboard
    _HAS_KEYBOARD = True
except ImportError:
    _HAS_KEYBOARD = False

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


# Assign OS-Level Shortcuts (Windows only — requires `keyboard` package)
# NOTE: Ctrl+D is reserved for the app-local Dashboard nav shortcut.
if _HAS_KEYBOARD:
    keyboard.add_hotkey('ctrl+c', set_recalibrate)
    keyboard.add_hotkey('ctrl+m', set_toggle)
    keyboard.add_hotkey('ctrl+q', set_quit)
    keyboard.add_hotkey('ctrl+shift+d', set_debug_toggle)
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
        self.performance_tier = 'normal'  # adaptive tier (normal/degraded)
        self.low_light = False     # true only when frame brightness is actually low
        self.brightness = 0.0      # latest tracking-frame brightness


def _open_local_capture(source):
    backend = cv2.CAP_DSHOW if os.name == 'nt' else cv2.CAP_ANY
    cap = BufferlessCapture(source, backend)
    cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*'MJPG'))
    cap.set(cv2.CAP_PROP_FPS, 30)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
    return cap


def _swap_capture(capture_state, new_cap, new_source, new_phone_server=None):
    old_cap = None
    old_phone_server = None
    with capture_state["lock"]:
        old_cap = capture_state["cap"]
        old_phone_server = capture_state["phone_server"]
        capture_state["cap"] = new_cap
        capture_state["source"] = new_source
        capture_state["phone_server"] = new_phone_server
        capture_state["phone_selected_at"] = time.perf_counter() if new_source == "phone" else None

    if old_phone_server and old_phone_server is not new_phone_server:
        try:
            old_phone_server.stop()
        except Exception:
            pass
    elif old_cap and old_cap is not new_cap:
        try:
            old_cap.release()
        except Exception:
            pass


def _prepare_ipc_frame(frame, target_width=320, target_height=180):
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

    return cv2.resize(cropped, (target_width, target_height), interpolation=cv2.INTER_AREA)


# Resolution presets per performance tier.
# Only the MediaPipe input resolution changes — MotionEngine tuning is NEVER touched.
_TRACKING_RES = {
    'normal':   {'webcam': (240, 180), 'phone': (320, 240)},
    'degraded': {'webcam': (160, 120), 'phone': (200, 150)},
}


def _prepare_tracking_frame(frame, source, tier='normal'):
    """Prepare MediaPipe input while preserving webcam behavior.

    Webcam keeps the existing low-latency 240x180 path in normal tier.
    In degraded tier, resolution is reduced to cut MediaPipe cost.
    Phone frames are center-cropped to 4:3 before resize.

    Only tracking resolution changes between tiers — the MotionEngine
    cursor model (smoothing, dead zone, speed curve, 1-Euro filters)
    is never modified by tier changes.
    """
    if frame is None:
        return frame

    res = _TRACKING_RES.get(tier, _TRACKING_RES['normal'])

    if source != 'phone':
        target = res['webcam']
        return cv2.resize(frame, target, interpolation=cv2.INTER_AREA)

    height, width = frame.shape[:2]
    if height <= 0 or width <= 0:
        return frame

    target_width, target_height = res['phone']
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

    return cv2.resize(cropped, (target_width, target_height), interpolation=cv2.INTER_AREA)


def _mediapipe_worker(capture_state, detector, hand_detector, state, running_flag):
    """Background thread: grab frames and run MediaPipe at a controlled rate.

    Rate-limited to ~35fps to prevent thermal throttling, and hands are
    processed only every 2nd frame (normal) or 4th (degraded) to cut CPU load.

    Adaptive performance tiers:
      - 'normal':   full tracking resolution, hands every 2nd frame
      - 'degraded': reduced resolution, hands every 4th frame
    Tier changes ONLY affect MediaPipe input resolution and hand cadence.
    The MotionEngine cursor model is NEVER modified by tier transitions.
    """
    last_frame_id = -1
    first_logged = False
    frame_count = 0
    _HANDS_NORMAL = 2            # hand cadence in normal tier
    _HANDS_DEGRADED = 4          # hand cadence in degraded tier
    _hands_every_n = _HANDS_NORMAL
    _TARGET_MP_FPS = 35          # max processing rate
    _MIN_MP_PERIOD = 1.0 / _TARGET_MP_FPS
    _cached_hand_results = None  # reuse between hand-processing frames

    # ── Adaptive performance tier state ──
    _current_tier = 'normal'
    _fps_timestamps = []         # rolling window of result timestamps
    _FPS_WINDOW_SEC = 2.0        # sliding window length
    _ENTER_DEGRADED_FPS = 12     # drop below this → start counting
    _EXIT_DEGRADED_FPS = 20      # rise above this → start recovery
    _ENTER_HOLD_SEC = 3.0        # sustained low FPS before switching
    _EXIT_HOLD_SEC = 4.0         # sustained high FPS before recovering
    _low_since = None            # perf_counter when low FPS started
    _recovery_since = None       # perf_counter when high FPS started

    while running_flag[0]:
        iter_start = time.perf_counter()

        with capture_state["lock"]:
            cap = capture_state["cap"]
            source = capture_state["source"]

        if cap is None:
            time.sleep(0.01)
            continue

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

        # Use current tier for tracking resolution selection.
        # ONLY the input resolution to MediaPipe changes — MotionEngine is untouched.
        img_mp = _prepare_tracking_frame(img, source, tier=_current_tier)
        brightness = float(cv2.mean(cv2.cvtColor(img_mp, cv2.COLOR_BGR2GRAY))[0])
        low_light = brightness < 45.0
        rgb_img = cv2.cvtColor(img_mp, cv2.COLOR_BGR2RGB)

        t0 = time.perf_counter()
        results = detector.face_mesh.process(rgb_img)
        mp_ms = (time.perf_counter() - t0) * 1000

        # Process hands separately — cadence adapts to tier
        if frame_count % _hands_every_n == 0:
            _cached_hand_results = hand_detector.process(rgb_img)

        # ── Adaptive tier management (FPS-driven, not brightness) ──
        now_t = time.perf_counter()
        _fps_timestamps.append(now_t)
        cutoff = now_t - _FPS_WINDOW_SEC
        _fps_timestamps = [t for t in _fps_timestamps if t > cutoff]
        window_fps = len(_fps_timestamps) / _FPS_WINDOW_SEC

        if _current_tier == 'normal':
            if window_fps < _ENTER_DEGRADED_FPS:
                if _low_since is None:
                    _low_since = now_t
                elif (now_t - _low_since) >= _ENTER_HOLD_SEC:
                    _current_tier = 'degraded'
                    _hands_every_n = _HANDS_DEGRADED
                    _low_since = None
                    _recovery_since = None
                    state.performance_tier = 'degraded'
                    print(f"[PERF] Entered degraded tier (MP FPS={window_fps:.1f}). "
                          f"Reduced tracking resolution, hands every {_HANDS_DEGRADED} frames.")
            else:
                _low_since = None
        elif _current_tier == 'degraded':
            if window_fps >= _EXIT_DEGRADED_FPS:
                if _recovery_since is None:
                    _recovery_since = now_t
                elif (now_t - _recovery_since) >= _EXIT_HOLD_SEC:
                    _current_tier = 'normal'
                    _hands_every_n = _HANDS_NORMAL
                    _recovery_since = None
                    _low_since = None
                    state.performance_tier = 'normal'
                    print(f"[PERF] Recovered to normal tier (MP FPS={window_fps:.1f}).")
            else:
                _recovery_since = None

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
                state.low_light = low_light
                state.brightness = brightness
        else:
            with state.lock:
                state.has_face = False
                state.face = None
                state.hand_results = _cached_hand_results
                state.frame = img
                state.result_id += 1
                state.mp_time_ms = mp_ms
                state.low_light = low_light
                state.brightness = brightness

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
    print("  Ctrl+M         -> Toggle Mouse")
    print("  Ctrl+C         -> Recalibrate Face")
    print("  Ctrl+Shift+D   -> Toggle Debug Overlay")
    print("  Ctrl+N         -> Noise Measurement")
    print("  Ctrl+Q         -> Quit Engine\n")

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

    phone_server = None
    active_source = 'webcam'

    if camera_source == 'phone':
        try:
            from src.vision.phone_camera import PhoneCameraServer
            phone_server = PhoneCameraServer()
            phone_server.start()
            cap = phone_server.capture
            active_source = 'phone'
            print("[SYSTEM] Using phone camera as video source.")
        except Exception as exc:
            print(f"[SYSTEM] Phone camera unavailable, falling back to webcam: {exc}")
            cap = _open_local_capture(source)
            import time as _t; _t.sleep(0.5)
    else:
        cap = _open_local_capture(source)
        # Request MJPG codec — many USB cameras deliver higher FPS with
        # compressed transport than raw YUV
        cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*'MJPG'))
        import time as _t; _t.sleep(0.5)  # let threaded reader grab first frame

    capture_state = {
        "lock": threading.Lock(),
        "cap": cap,
        "source": active_source,
        "phone_server": phone_server,
        "phone_selected_at": time.perf_counter() if active_source == 'phone' else None,
    }

    detector = FaceMeshDetector()
    parallax = ParallaxController(settings.SENSITIVITY_X, settings.SENSITIVITY_Y)
    mouse = MouseController()
    motion_engine = MotionEngine()

    # --- DYNAMIC ISLAND HUD ---
    from src.controllers.hud import FloatingHUD
    hud = FloatingHUD()

    # --- Debug telemetry (disabled while HUD is off) ---
    class _NoOpHUD:
        """Stub that silently eats all HUD/telemetry calls."""
        def __getattr__(self, _): return lambda *a, **kw: None
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
        min_detection_confidence=0.35,
        min_tracking_confidence=0.4
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
        args=(capture_state, detector, hand_detector, tracking, _mp_running),
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
    PHONE_CONNECT_TIMEOUT_SEC = 6.0
    _last_active_source = active_source  # track source changes
    _live_mp_fps = 0.0
    _live_mp_window_start = time.perf_counter()
    _live_mp_window_results = 0

    # Apply source-specific motion tuning at startup
    def _apply_motion_config(src):
        """Hot-swap MotionEngine parameters for the active camera source."""
        base_cfg = getattr(settings, 'MOTION_ENGINE', {})
        if src == 'phone':
            phone_cfg = {**base_cfg, **getattr(settings, 'MOTION_ENGINE_PHONE', {})}
            tuned_cfg = dict(phone_cfg)
            tuned_cfg['raw_smooth'] = min(max(phone_cfg.get('raw_smooth', 0.10), base_cfg.get('raw_smooth', 0.08)), 0.11)
            tuned_cfg['dead_zone'] = min(max(phone_cfg.get('dead_zone', 0.09), base_cfg.get('dead_zone', 0.08)), 0.095)
            tuned_cfg['max_speed'] = max(phone_cfg.get('max_speed', base_cfg.get('max_speed', 900)), int(base_cfg.get('max_speed', 900) * 0.95))
            motion_engine.configure(tuned_cfg, reset_state=True)
            print(f"[SYSTEM] Applied phone motion config (smooth={motion_engine.raw_smooth}, dz={motion_engine.dead_zone}, max={motion_engine.max_speed})")
        else:
            motion_engine.configure(base_cfg, reset_state=True)

    _apply_motion_config(active_source)

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
            if hasattr(mouse, 'reset_agent_calibration'):
                mouse.reset_agent_calibration()
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

        current_phone_server = capture_state["phone_server"]
        current_source = capture_state["source"]

        if current_source != _last_active_source:
            print(f"[SYSTEM] Active source changed: {_last_active_source} -> {current_source}")
            _last_active_source = current_source
            _has_face = False
            _last_raw_dx = 0.0
            _last_raw_dy = 0.0
            parallax.is_calibrated = False
            if hasattr(mouse, 'reset_agent_calibration'):
                mouse.reset_agent_calibration()
            _apply_motion_config(current_source)

        if current_source == 'phone' and current_phone_server:
            phone_status = current_phone_server.get_status()
            phone_selected_at = capture_state.get("phone_selected_at")
            phone_timed_out = (
                not current_phone_server.has_streamed
                and phone_selected_at is not None
                and (time.perf_counter() - phone_selected_at) >= PHONE_CONNECT_TIMEOUT_SEC
            )
            phone_lost = (
                phone_status in ('error', 'idle')
                or (phone_status == 'waiting' and current_phone_server.has_streamed)
                or (current_phone_server.has_streamed and not current_phone_server.capture.has_recent_frame)
            )
            if phone_lost or phone_timed_out:
                reason = "timeout" if phone_timed_out else phone_status
                print(f"[SYSTEM] Phone stream status is '{reason}' - switching engine back to webcam.")
                try:
                    replacement_cap = _open_local_capture(source)
                    _swap_capture(capture_state, replacement_cap, 'webcam', None)
                    _has_face = False
                    _last_raw_dx = 0.0
                    _last_raw_dy = 0.0
                    # Full recalibration so parallax/gesture baselines
                    # match the new camera's geometry/aspect ratio.
                    parallax.is_calibrated = False
                    mouse.reset_agent_calibration()
                    _apply_motion_config('webcam')
                    _last_active_source = 'webcam'
                    hud.show_message("PHONE LOST - USING WEBCAM", 75)
                except Exception as exc:
                    print(f"[SYSTEM] Failed to fall back to webcam: {exc}")

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
            _live_mp_window_results += 1
            live_window_elapsed = time.perf_counter() - _live_mp_window_start
            if live_window_elapsed >= 1.0:
                _live_mp_fps = _live_mp_window_results / live_window_elapsed
                _live_mp_window_results = 0
                _live_mp_window_start = time.perf_counter()
            _has_face = t_has_face
            _last_aspect_ratio = t_aspect

            if t_has_face and t_face is not None:
                if not parallax.is_calibrated:
                    parallax.calibrate(t_yaw, t_pitch, t_fw_norm)
                    calibrated_fw_norm = t_fw_norm
                    is_mirrored = t_left_ear > t_right_ear
                    motion_engine.reset()
                    
                if not mouse.is_agent_calibrated:
                    agent_ready = mouse.calibrate_agent(t_face)
                    if agent_ready or mouse.is_agent_calibrated:
                        hud.show_message("CALIBRATION COMPLETE", 60)

                global _last_face
                _last_face = t_face
                
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
            
            # Move cursor and check if we hit physical screen bounds
            hit_x, hit_y = mouse.move(dx_px, dy_px)
            
            # If we hit an edge, instantly kill velocity on that axis 
            # so momentum doesn't build up "off-screen"
            if hit_x or hit_y:
                motion_engine.reset_velocity(reset_x=hit_x, reset_y=hit_y)

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
                if client_conn:
                    client_conn.close()
                client_conn = conn
            except BlockingIOError:
                pass

            if client_conn:
                try:
                    with tracking.lock:
                        _ipc_frame = tracking.frame
                    with capture_state["lock"]:
                        active_capture_source = capture_state["source"]
                    if _ipc_frame is not None:
                        frame_ui = _prepare_ipc_frame(_ipc_frame, 320, 180)
                        _, buffer = cv2.imencode('.jpg', frame_ui, [cv2.IMWRITE_JPEG_QUALITY, 40])
                        b64_str = base64.b64encode(buffer).decode('utf-8')
                        frame_h, frame_w = _ipc_frame.shape[:2]
                        payload = json.dumps({
                            "frame": b64_str,
                            "telemetry": {
                                "face_detected": _has_face,
                                "tracking_fps": round(_live_mp_fps, 1),
                                "performance_tier": tracking.performance_tier,
                                "low_light": tracking.low_light,
                                "brightness": round(tracking.brightness, 1),
                            },
                            "face_detected": _has_face,
                            "camera_meta": {
                                "source": active_capture_source,
                                "width": frame_w,
                                "height": frame_h,
                                "mp": round((frame_w * frame_h) / 1_000_000, 1),
                            },
                        }) + "\n"
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
                
                # Live Gesture Math Telemetry
                if hasattr(mouse, 'base_l_ear'):
                    print(f"  --- LIVE GESTURE MATH ---")
                    print(f"  L_Eye : base {mouse.base_l_ear:.3f} | curr {mouse.get_ear(_last_face, 386, 374, 362, 263) if hasattr(globals(), '_last_face') else 0:.3f}")
                    print(f"  R_Eye : base {mouse.base_r_ear:.3f} | curr {mouse.get_ear(_last_face, 159, 145, 133, 33) if hasattr(globals(), '_last_face') else 0:.3f}")
                    print(f"  Mouth : base {mouse.base_mar:.3f} | curr {(mouse.get_norm_dist(_last_face, 13, 14) / mouse.get_norm_dist(_last_face, 61, 291)) if hasattr(globals(), '_last_face') and mouse.get_norm_dist(_last_face, 61, 291) > 0 else 0:.3f}")
                
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
    final_cap = capture_state["cap"]
    final_phone_server = capture_state["phone_server"]
    if final_phone_server:
        try:
            final_phone_server.stop()
        except Exception:
            pass
    elif final_cap:
        final_cap.release()
    signal_log.close()
    if client_conn: client_conn.close()
    ipc_server.close()
    hand_detector.close()
    hud.close()
    sys.exit(0)


if __name__ == "__main__":
    main()
