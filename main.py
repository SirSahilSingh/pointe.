import cv2
import settings
import sys
import os
import time
import keyboard
import mediapipe as mp

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from src.vision.face_mesh import FaceMeshDetector
from src.vision.face_lock import FaceLockManager
from src.controllers.parallax import ParallaxController
from src.controllers.mouse import MouseController
from src.controllers.hud import FloatingHUD



# --- GLOBAL HOTKEY FLAGS ---
trigger_recalibrate = False
trigger_toggle_mouse = False
trigger_quit = False


def set_recalibrate(): global trigger_recalibrate; trigger_recalibrate = True


def set_toggle(): global trigger_toggle_mouse; trigger_toggle_mouse = True


def set_quit(): global trigger_quit; trigger_quit = True


# Assign OS-Level Shortcuts
keyboard.add_hotkey('ctrl+c', set_recalibrate)
keyboard.add_hotkey('ctrl+m', set_toggle)
keyboard.add_hotkey('ctrl+q', set_quit)


def main():
    global trigger_recalibrate, trigger_toggle_mouse, trigger_quit

    print("\n[SYSTEM] pointe is now running in Stealth Mode.")
    print("  Ctrl+M -> Toggle Mouse")
    print("  Ctrl+C -> Recalibrate Face")
    print("  Ctrl+Q -> Quit Engine\n")

    import socket
    import json
    import base64
    IPC_PORT = 11337
    ipc_server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    ipc_server.bind(('127.0.0.1', IPC_PORT))
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
        cap = cv2.VideoCapture(source, backend)
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, settings.FRAME_WIDTH)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, settings.FRAME_HEIGHT)

    detector = FaceMeshDetector()
    parallax = ParallaxController(settings.SENSITIVITY_X, settings.SENSITIVITY_Y)
    mouse = MouseController()
    hud = FloatingHUD()

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

    hud.show_message("GHOST-TYPE ENGINE ACTIVE", 60)

    while True:
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
            hud.show_message("CALIBRATING...", 45)
            trigger_recalibrate = False

        # 2. Process Camera
        ok, img = cap.read()
        if not ok:
            time.sleep(0.05)
            continue

        img = cv2.flip(img, 1)
        h, w, _ = img.shape
        aspect_ratio = w / float(h)

        # Notice: draw=False! We save massive CPU by not rendering the mesh locally
        _, results = detector.process_frame(img, draw=False)
        zoom = 1.0

        # Hand detection for palm gestures
        rgb_img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        hand_results = hand_detector.process(rgb_img)

        # 3. Process Physics
        if results.multi_face_landmarks:
            face = results.multi_face_landmarks[0]

            nx_norm = face.landmark[1].x
            ny_norm = face.landmark[1].y
            left_ear_norm = face.landmark[234].x
            right_ear_norm = face.landmark[454].x

            live_face_width_norm = abs(left_ear_norm - right_ear_norm)

            if not parallax.is_calibrated:
                parallax.calibrate(nx_norm, ny_norm, live_face_width_norm)
                calibrated_fw_norm = live_face_width_norm
                is_mirrored = left_ear_norm < right_ear_norm
                mouse.calibrate_agent(face)
                hud.show_message("CALIBRATION COMPLETE", 60)

            auto_invert_x = 1 if is_mirrored else -1
            safe_fw = max(calibrated_fw_norm, 0.01)

            dx_norm = ((nx_norm - parallax.neutral_x) / safe_fw) * settings.SENSITIVITY_X * auto_invert_x
            dy_norm = (((ny_norm - parallax.neutral_y) / safe_fw) * settings.SENSITIVITY_Y) * aspect_ratio
            zoom = parallax.get_zoom(live_face_width_norm)

            if mouse_active:
                mouse.move(dx_norm, dy_norm, zoom)

                # Check for gestures and pipe them to the HUD!
                action_msgs = mouse.process_actions(face, hand_results)
                if action_msgs:
                    hud.show_message(action_msgs[-1], 20)

                presence_msg = mouse.process_presence(face)
                if presence_msg: hud.show_message(presence_msg, 60)
        else:
            if mouse_active:
                presence_msg = mouse.process_presence(None)
                if presence_msg: hud.show_message(presence_msg, 60)

        # 5. Face Lock Check
        if face_lock:
            lock_timeout = getattr(settings, 'FACE_LOCK_TIMEOUT', 30)
            lock_on_unknown = getattr(settings, 'FACE_LOCK_ON_UNKNOWN', False)
            lock_result = face_lock.check_lock_state(img, lock_timeout, lock_on_unknown)
            if lock_result == 'lock':
                hud.show_message('SCREEN LOCKED — FACE NOT DETECTED', 120)
            elif lock_result == 'unlock':
                hud.show_message('SCREEN UNLOCKED — WELCOME BACK', 60)
            elif lock_result and lock_result.startswith('countdown:'):
                secs = lock_result.split(':')[1]
                hud.show_message(f'LOCKING IN {secs}...', 15)

        # 6. IPC Broadcast for Dashboard
        try:
            conn, _ = ipc_server.accept()
            conn.setblocking(False)
            if client_conn: client_conn.close()
            client_conn = conn
        except BlockingIOError:
            pass

        if client_conn:
            try:
                frame_ui = cv2.resize(img, (640, 360))
                _, buffer = cv2.imencode('.jpg', frame_ui, [cv2.IMWRITE_JPEG_QUALITY, 55])
                b64_str = base64.b64encode(buffer).decode('utf-8')
                payload = json.dumps({"frame": b64_str, "face_detected": bool(results.multi_face_landmarks)}) + "\n"
                client_conn.sendall(payload.encode('utf-8'))
            except Exception:
                client_conn.close()
                client_conn = None

        # 7. Update UI Overlay (replaces cv2.imshow)
        hud.update()

    cap.release()
    if client_conn: client_conn.close()
    ipc_server.close()
    hand_detector.close()
    sys.exit(0)


if __name__ == "__main__":
    main()