import eel
import cv2
import base64
import sys
import os
import platform
import subprocess
import time
import signal
import settings
import numpy as np
import mediapipe as mp

from src.vision.phone_camera import PhoneCameraServer


sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from src.vision.face_mesh import FaceMeshDetector
from src.vision.face_lock import FaceLockManager
from src.controllers.mouse import MouseController

eel.init('web/dist')

is_running = True
cap = None
is_tutorial_mode = False
engine_process = None  # Store the spawned engine process
face_lock_mgr = FaceLockManager()
phone_cam_server = None  # PhoneCameraServer instance
phone_cam_active = False  # True when phone camera is the active source


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
        'gesture_calibration': getattr(settings, 'GESTURE_CALIBRATION', {})
    }


@eel.expose
def get_system_info():
    """Returns system metadata for the UI footer and dashboard."""
    return {
        'resolution': f"{settings.FRAME_WIDTH} × {settings.FRAME_HEIGHT}",
        'platform': platform.system(),
        'version': 'v1.0.0'
    }


@eel.expose
def save_and_launch(config):
    global engine_process, is_running, cap, phone_cam_active

    # Determine camera source
    cam_source = "'phone'" if phone_cam_active else str(settings.CAMERA_INDEX)

    # Gesture calibration from config
    gcal = config.get('gesture_calibration', {})
    gcal_str = '{\n'
    for gname, gvals in gcal.items():
        gcal_str += f'    "{gname}": {{"threshold": {gvals.get("threshold", 0.6)}, "hold_duration": {gvals.get("hold_duration", 0.2)}}},\n'
    gcal_str += '}'

    new_settings = f"""# --- CAMERA SETTINGS ---
CAMERA_INDEX = {settings.CAMERA_INDEX}             
CAMERA_SOURCE = {cam_source}
FRAME_WIDTH = {settings.FRAME_WIDTH}            
FRAME_HEIGHT = {settings.FRAME_HEIGHT}

# --- HEAD TRACKING SENSITIVITY ---
SENSITIVITY_X = {float(config['sens_x']):.2f}         
SENSITIVITY_Y = {float(config['sens_y']):.2f}          

# --- MOVEMENT PHYSICS ---
SMOOTHING = {float(config.get('smoothing', 0.03))}
ACCELERATION = {float(config.get('acceleration', 1.6))}
DEADZONE = {float(config.get('deadzone', 0.03))}

# --- CUSTOM GESTURE MAPPINGS ---
GESTURE_MAPPINGS = {{
    "left_click": "{config['lclick']}",
    "right_click": "{config['rclick']}",
    "double_click": "{config['dclick']}",
    "media_play_pause": "{config['media_pp']}",
    "drag_drop": "{config['drag']}",
    "scroll": "{config['scroll']}"
}}

# --- GESTURE CALIBRATION ---
GESTURE_CALIBRATION = {gcal_str}

# --- FEATURE TOGGLES ---
MEDIA_AUTO_PAUSE = {config.get('media_auto_pause', True)}
SCROLL_ENABLED = {config.get('scroll_enabled', True)}
MOUSE_CONTROL_ENABLED = {config.get('mouse_control_enabled', True)}
PINCH_COPY_PASTE = {config.get('pinch_copy_paste', True)}
HAND_SWAP_WINDOW_SWITCH = {config.get('hand_swap_window', True)}

# --- FACE LOCK ---
FACE_LOCK_ENABLED = {config.get('face_lock_enabled', False)}
FACE_LOCK_TIMEOUT = {config.get('face_lock_timeout', 30)}
FACE_LOCK_ON_UNKNOWN = {config.get('face_lock_on_unknown', False)}
"""
    settings_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "settings.py")
    with open(settings_path, "w") as f: f.write(new_settings)

    # STOP the dashboard camera so the engine can use it
    is_running = False
    time.sleep(0.3)  # Let stream_camera loop exit
    if cap:
        cap.release()
        cap = None

    print("[SYSTEM] Settings Saved. Booting pointe...")
    project_dir = os.path.dirname(os.path.abspath(__file__))
    engine_process = subprocess.Popen([sys.executable, "main.py"], cwd=project_dir)

    # Notify the JS frontend (dashboard stays open!)
    try:
        eel.engine_launched()()
    except Exception:
        pass


@eel.expose
def kill_engine():
    """Kill the running engine process and restart dashboard camera."""
    global engine_process, is_running
    if engine_process and engine_process.poll() is None:
        try:
            engine_process.terminate()
            engine_process.wait(timeout=3)
        except subprocess.TimeoutExpired:
            engine_process.kill()
        engine_process = None
        print("[SYSTEM] Engine terminated.")

        # Restart dashboard camera stream
        is_running = True
        eel.spawn(stream_camera)

        try:
            eel.engine_killed()()
        except Exception:
            pass
        return True
    engine_process = None
    return False


@eel.expose
def register_face():
    """Capture the current camera frame and register a new face (single shot)."""
    global cap
    if cap is None or not cap.isOpened():
        return {'success': False, 'error': 'Camera not available.'}
    ok, frame = cap.read()
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
    ok, frame = cap.read()
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
    """Return list of registered face IDs."""
    return [{'id': fid} for fid in face_lock_mgr.registered_faces]


@eel.expose
def activate_shortcut(action):
    """Activates a keyboard shortcut from the UI."""
    import keyboard
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
    global phone_cam_server, phone_cam_active, is_running, cap
    try:
        if phone_cam_server and phone_cam_server.is_running:
            return {
                'success': True,
                'qr': phone_cam_server.qr_base64,
                'url': phone_cam_server.url,
                'status': phone_cam_server.get_status()
            }

        phone_cam_server = PhoneCameraServer()
        phone_cam_server.start()
        phone_cam_active = True

        # Stop the webcam so phone camera can be used
        is_running = False
        time.sleep(0.3)
        if cap:
            cap.release()
            cap = None

        # Restart stream_camera with phone source
        is_running = True
        eel.spawn(stream_camera)

        return {
            'success': True,
            'qr': phone_cam_server.qr_base64,
            'url': phone_cam_server.url,
            'status': phone_cam_server.get_status()
        }
    except Exception as e:
        return {'success': False, 'error': str(e)}


@eel.expose
def stop_phone_camera():
    """Stop the phone camera server and switch back to webcam."""
    global phone_cam_server, phone_cam_active, is_running, cap
    phone_cam_active = False

    if phone_cam_server:
        phone_cam_server.stop()
        phone_cam_server = None

    # Restart webcam stream
    is_running = False
    time.sleep(0.3)
    if cap:
        cap.release()
        cap = None

    is_running = True
    eel.spawn(stream_camera)
    return {'success': True}


@eel.expose
def get_phone_camera_status():
    """Return the current phone camera connection status."""
    if phone_cam_server and phone_cam_server.is_running:
        return {
            'status': phone_cam_server.get_status(),
            'url': phone_cam_server.url
        }
    return {'status': 'idle'}


def stream_camera():
    global is_running, cap, is_tutorial_mode, phone_cam_active, phone_cam_server

    # Wait for browser to connect and React to mount before sending frames
    print("[stream_camera] Waiting for browser connection...")
    eel.sleep(2.0)
    print("[stream_camera] Starting camera stream...")

    try:
        # Choose camera source
        if phone_cam_active and phone_cam_server:
            cam = getattr(phone_cam_server, 'capture', None)
            if cam is None:
                print("[stream_camera] Phone camera capture not ready, waiting...")
                for _ in range(50):  # Wait up to 5s
                    eel.sleep(0.1)
                    cam = getattr(phone_cam_server, 'capture', None)
                    if cam is not None:
                        break
            cap = cam
        else:
            backend = cv2.CAP_DSHOW if os.name == 'nt' else cv2.CAP_ANY
            cap = cv2.VideoCapture(settings.CAMERA_INDEX, backend)
            if not cap.isOpened():
                print(f"[stream_camera] Failed to open camera index {settings.CAMERA_INDEX}")
                return

        if cap is None:
            print("[stream_camera] No camera source available")
            return
        
        detector = FaceMeshDetector()

        # Hand detector for palm detection
        mp_hands = mp.solutions.hands
        hand_detector = mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=1,
            min_detection_confidence=0.6,
            min_tracking_confidence=0.5
        )

        # We instantiate the MouseController just to use its detection math,
        # we will NOT call mouse.move() here, so the actual cursor stays safe!
        mouse_referee = MouseController()

        while is_running:
            try:
                success, frame = cap.read()
            except Exception:
                eel.sleep(0.1)
                continue
            
            if success:
                frame, results = detector.process_frame(frame, draw=False)
                face_detected = bool(results.multi_face_landmarks)

                # --- Palm detection ---
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                hand_results = hand_detector.process(rgb_frame)

                # --- THE REFEREE LOGIC (TUTORIAL) ---
                if is_tutorial_mode and face_detected:
                    face = results.multi_face_landmarks[0]

                    if not mouse_referee.is_agent_calibrated:
                        mouse_referee.calibrate_agent(face)
                        # Send signal to JS that calibration is done
                        eel.tutorial_event("calibrated")()
                    else:
                        gestures = mouse_referee.detect_gestures(face, hand_results)
                        if gestures:
                            # Send the first detected gesture to JS
                            eel.tutorial_event(gestures[0])()
                            eel.sleep(0.5)  # 0.5s cooldown so it doesn't double-count a single wink!

                # Resize and send frame to UI
                frame = cv2.resize(frame, (640, 360))
                _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
                b64_str = base64.b64encode(buffer).decode('utf-8')

                try:
                    eel.updateImage(b64_str)()
                    eel.updateTelemetry(face_detected)()
                except Exception:
                    pass

            eel.sleep(0.03)
    except Exception as e:
        print(f"[stream_camera] Fatal error: {e}")
        import traceback
        traceback.print_exc()


eel.spawn(stream_camera)

try:
    eel.start('index.html', size=(1100, 700), position=(200, 80))
except (SystemExit, KeyboardInterrupt):
    is_running = False
    if cap: cap.release()
    if engine_process and engine_process.poll() is None:
        engine_process.terminate()