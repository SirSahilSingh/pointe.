import pyautogui
import numpy as np
import math
import time


class Kalman2D:
    def __init__(self):
        self.x = np.zeros((4, 1))
        self.F = np.array([[1, 0, 1, 0], [0, 1, 0, 1], [0, 0, 1, 0], [0, 0, 0, 1]])
        self.H = np.array([[1, 0, 0, 0], [0, 1, 0, 0]])
        self.P = np.eye(4) * 100
        self.Q = np.eye(4) * 2.0
        self.R = np.eye(2) * 10.0

    def update(self, measurement):
        z = np.array(measurement).reshape(2, 1)
        self.x = self.F @ self.x
        self.P = self.F @ self.P @ self.F.T + self.Q
        y = z - self.H @ self.x
        S = self.H @ self.P @ self.H.T + self.R
        K = self.P @ self.H.T @ np.linalg.inv(S)
        self.x += K @ y
        self.P = (np.eye(4) - K @ self.H) @ self.P
        return self.x[0, 0], self.x[1, 0]


class MouseController:
    def __init__(self, sensitivity=1.5):
        pyautogui.FAILSAFE = False
        pyautogui.PAUSE = 0

        self.screen_w, self.screen_h = pyautogui.size()
        self.center_x = self.screen_w // 2
        self.center_y = self.screen_h // 2

        self.sensitivity = sensitivity
        self.dead_zone = 3
        self.kalman = Kalman2D()

        # --- MOUSE STATES ---
        self.jaw_dropped = False
        self.last_click_time = 0

        self.is_puckering = False
        self.last_double_click = 0

        self.drag_mode = False
        self.drag_toggle_fired = False  # Prevents spamming toggle while winking

        # Wink States
        self.left_wink_start = 0
        self.right_wink_start = 0
        self.last_right_click = 0

        # Scroll States
        self.scroll_mode = False
        self.eyes_closed_start = 0
        self.last_scroll_time = 0

        # Presence States
        self.face_missing_start = 0
        self.has_auto_paused = False

        # Snap Targeting
        self.gravity_targets = []
        self.snap_radius = 100

    def apply_dead_zone(self, v):
        if abs(v) < self.dead_zone: return 0
        return v - self.dead_zone if v > 0 else v + self.dead_zone

    def acceleration_curve(self, v):
        return np.sign(v) * (abs(v) ** 1.3)

    def move(self, dx, dy, zoom, anchored_face_width):
        if self.scroll_mode:
            return

        dx = self.apply_dead_zone(dx)
        dy = self.apply_dead_zone(dy)

        anchored_face_width = max(anchored_face_width, 10)

        dynamic_range_x = anchored_face_width * self.sensitivity
        dynamic_range_y = dynamic_range_x * (self.screen_h / self.screen_w)

        nx = dx / dynamic_range_x
        ny = dy / dynamic_range_y

        nx = self.acceleration_curve(nx)
        ny = self.acceleration_curve(ny)

        if zoom > 1.2:
            nx /= (zoom * 1.5)
            ny /= (zoom * 1.5)

        tx = self.center_x + nx * (self.screen_w / 2)
        ty = self.center_y + ny * (self.screen_h / 2)

        for gx, gy in self.gravity_targets:
            dist = math.hypot(tx - gx, ty - gy)
            if dist < self.snap_radius:
                tx = (tx * 0.4) + (gx * 0.6)
                ty = (ty * 0.4) + (gy * 0.6)
                break

        kx, ky = self.kalman.update([tx, ty])

        gx = np.clip(kx, 0, self.screen_w - 1)
        gy = np.clip(ky, 0, self.screen_h - 1)

        pyautogui.moveTo(gx, gy)

    # -------------------------
    # MATH HELPERS
    # -------------------------
    def get_dist(self, face, p1, p2):
        return math.hypot(face.landmark[p1].x - face.landmark[p2].x, face.landmark[p1].y - face.landmark[p2].y)

    def get_ear(self, face, top, bot, left, right):
        v = self.get_dist(face, top, bot)
        h = self.get_dist(face, left, right)
        return v / h if h > 0 else 0

    def process_presence(self, face):
        now = time.time()
        if face is None:
            if self.face_missing_start == 0:
                self.face_missing_start = now
            elif now - self.face_missing_start > 2.0:
                if not self.has_auto_paused:
                    pyautogui.press('playpause')
                    self.has_auto_paused = True
                    return "[ MEDIA: AUTO-PAUSED (AWAY) ]"
        else:
            self.face_missing_start = 0
            self.has_auto_paused = False

        return None

    def process_gestures(self, face):
        now = time.time()
        state_messages = []

        # --- EYE CALCULATIONS ---
        r_ear = self.get_ear(face, 159, 145, 133, 33)
        l_ear = self.get_ear(face, 386, 374, 362, 263)
        EYE_CLOSED = 0.15
        EYE_OPEN = 0.22

        # 1. SCROLL TOGGLE (Both Eyes Closed 1s)
        if r_ear < EYE_CLOSED and l_ear < EYE_CLOSED:
            if self.eyes_closed_start == 0:
                self.eyes_closed_start = now
            elif now - self.eyes_closed_start > 1.0:
                self.scroll_mode = not self.scroll_mode
                self.eyes_closed_start = now + 1.0
        else:
            self.eyes_closed_start = 0

        if self.scroll_mode:
            state_messages.append("[SCROLL MODE ACTIVE]")
            dx = face.landmark[263].x - face.landmark[33].x
            dy = face.landmark[263].y - face.landmark[33].y
            angle = math.degrees(math.atan2(dy, dx))

            if now - self.last_scroll_time > 0.05:
                if angle > 10:
                    pyautogui.scroll(60)
                    self.last_scroll_time = now
                elif angle < -10:
                    pyautogui.scroll(-60)
                    self.last_scroll_time = now
            return state_messages  # Halt other inputs while scrolling

        # 2. RIGHT CLICK (Left Eye Wink for 0.4s)
        if l_ear < EYE_CLOSED and r_ear > EYE_OPEN:
            if self.left_wink_start == 0:
                self.left_wink_start = now
            elif now - self.left_wink_start > 0.4:
                if now - self.last_right_click > 1.0:
                    pyautogui.rightClick()
                    state_messages.append("RIGHT CLICK")
                    self.last_right_click = now
        else:
            self.left_wink_start = 0

        # 3. DRAG TOGGLE (Right Eye Wink for 0.4s)
        if r_ear < EYE_CLOSED and l_ear > EYE_OPEN:
            if self.right_wink_start == 0:
                self.right_wink_start = now
            elif now - self.right_wink_start > 0.4:
                if not self.drag_toggle_fired:
                    self.drag_mode = not self.drag_mode  # Toggle state
                    if self.drag_mode:
                        pyautogui.mouseDown()
                    else:
                        pyautogui.mouseUp()
                    self.drag_toggle_fired = True
                    state_messages.append("DRAG TOGGLED")
        else:
            self.right_wink_start = 0
            self.drag_toggle_fired = False

        if self.drag_mode:
            state_messages.append("[ DRAGGING ACTIVE ]")

        # --- MOUTH CALCULATIONS ---
        mouth_w = self.get_dist(face, 61, 291)
        mouth_h = self.get_dist(face, 13, 14)
        face_w = self.get_dist(face, 234, 454)

        mar = mouth_h / mouth_w if mouth_w > 0 else 0
        m_ratio = mouth_w / face_w if face_w > 0 else 0

        # 4. LEFT CLICK (Jaw Drop - Single Click Only)
        if mar > 0.45:
            if not self.jaw_dropped:
                if now - self.last_click_time > 0.1:
                    pyautogui.click()
                    state_messages.append("LEFT CLICK")
                    self.last_click_time = now
                self.jaw_dropped = True
        elif mar < 0.35:
            self.jaw_dropped = False

        # 5. DOUBLE CLICK (Pucker / Kiss Face)
        # Normal ratio is ~0.35. A pucker shrinks it below 0.27
        if m_ratio < 0.27:
            if not self.is_puckering:
                if now - self.last_double_click > 1.0:  # 1-second cooldown to prevent double-firing
                    pyautogui.doubleClick()
                    state_messages.append("DOUBLE CLICK")
                    self.last_double_click = now
                self.is_puckering = True
        elif m_ratio > 0.31:
            self.is_puckering = False

        return state_messages