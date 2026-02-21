import pyautogui
import numpy as np
import math
import time
import settings


class MouseController:
    def __init__(self):
        pyautogui.FAILSAFE = False
        pyautogui.PAUSE = 0

        self.screen_w, self.screen_h = pyautogui.size()
        self.center_x = self.screen_w / 2.0
        self.center_y = self.screen_h / 2.0
        self.cursor_x = self.center_x
        self.cursor_y = self.center_y
        self.dead_zone_norm = 0.03

        # --- THE AUTO-AGENT (Personalized Baselines) ---
        self.is_agent_calibrated = False
        self.base_l_ear = 0.25  # Left Eye resting width
        self.base_r_ear = 0.25  # Right Eye resting width
        self.base_mar = 0.05  # Mouth resting height
        self.base_m_ratio = 0.35  # Resting mouth width

        # --- ACTION STATES ---
        self.action_states = {
            "left_click_start": 0,
            "is_clicking": False,
            "right_click_start": 0,
            "last_right_click": 0,
            "double_click_start": 0,
            "last_double_click": 0,
            "drag_start": 0,
            "is_dragging": False,
            "scroll_start": 0,
            "scroll_mode": False,
            "last_scroll": 0,
            "media_pp_start": 0,
            "last_media_pp": 0
        }

        # --- PINCH / HAND-SWAP STATES ---
        self.is_pinching = False
        self.last_pinch_time = 0
        self.last_hand_label = None
        self.last_hand_swap_time = 0

        self.face_missing_start = 0
        self.has_auto_paused = False

    # --- 1. THE AUTO-AGENT CALIBRATOR ---
    def calibrate_agent(self, face):
        """ Scans your resting face to create personalized mathematical thresholds. """
        self.base_r_ear = self.get_ear(face, 159, 145, 133, 33)
        self.base_l_ear = self.get_ear(face, 386, 374, 362, 263)

        mouth_w = self.get_norm_dist(face, 61, 291)
        mouth_h = self.get_norm_dist(face, 13, 14)
        face_w = self.get_norm_dist(face, 234, 454)

        self.base_mar = mouth_h / mouth_w if mouth_w > 0 else 0
        self.base_m_ratio = mouth_w / face_w if face_w > 0 else 0
        self.is_agent_calibrated = True
        print(f"[AGENT] Calibrated Face - L_Eye:{self.base_l_ear:.2f}, Mouth:{self.base_mar:.2f}")

    # --- 2. MOVEMENT PHYSICS ---
    def apply_dead_zone(self, v):
        if abs(v) < self.dead_zone_norm: return 0
        return v - self.dead_zone_norm if v > 0 else v + self.dead_zone_norm

    def acceleration_curve(self, v):
        return np.sign(v) * (abs(v) ** 1.6)

    def move(self, dx_norm, dy_norm, zoom):
        if self.action_states["scroll_mode"]: return

        dx = self.apply_dead_zone(dx_norm)
        dy = self.apply_dead_zone(dy_norm)

        nx = self.acceleration_curve(dx)
        ny = self.acceleration_curve(dy)

        zoom_factor = max(zoom, 0.5)
        nx /= zoom_factor
        ny /= zoom_factor

        tx = self.center_x + (nx * (self.screen_w / 2.0))
        ty = self.center_y + (ny * (self.screen_h / 2.0))

        pixel_dist = math.hypot(tx - self.cursor_x, ty - self.cursor_y)
        dynamic_smooth = 0.02 + (min(pixel_dist, 150) / 150.0) * (0.40 - 0.02)

        self.cursor_x += (tx - self.cursor_x) * dynamic_smooth
        self.cursor_y += (ty - self.cursor_y) * dynamic_smooth

        gx = np.clip(self.cursor_x, 0, self.screen_w - 1)
        gy = np.clip(self.cursor_y, 0, self.screen_h - 1)
        pyautogui.moveTo(round(gx), round(gy))

    # --- 3. NORMALIZED MATH HELPERS ---
    def get_norm_dist(self, face, p1, p2):
        return math.hypot(face.landmark[p1].x - face.landmark[p2].x, face.landmark[p1].y - face.landmark[p2].y)

    def get_ear(self, face, top, bot, left, right):
        v = self.get_norm_dist(face, top, bot)
        h = self.get_norm_dist(face, left, right)
        return v / h if h > 0 else 0

    def process_presence(self, face):
        # Respect the MEDIA_AUTO_PAUSE toggle
        if not getattr(settings, 'MEDIA_AUTO_PAUSE', True):
            self.face_missing_start = 0
            self.has_auto_paused = False
            return None

        now = time.time()
        if face is None:
            if self.face_missing_start == 0:
                self.face_missing_start = now
            elif now - self.face_missing_start > 2.0 and not self.has_auto_paused:
                pyautogui.press('playpause')
                self.has_auto_paused = True
                return "[ MEDIA: AUTO-PAUSED (AWAY) ]"
        else:
            self.face_missing_start = 0
            self.has_auto_paused = False
        return None

    # --- 4. PALM DETECTION ---
    def detect_palm(self, hand_results):
        """Detects an open palm from MediaPipe hand landmarks.
        Returns True if all 5 fingers are extended (tip above PIP joint)."""
        if not hand_results or not hand_results.multi_hand_landmarks:
            return False

        hand = hand_results.multi_hand_landmarks[0]
        lm = hand.landmark

        # Finger tip and PIP indices (thumb uses IP instead of PIP)
        # Thumb: tip=4, ip=3  |  Index: tip=8, pip=6
        # Middle: tip=12, pip=10  |  Ring: tip=16, pip=14  |  Pinky: tip=20, pip=18
        thumb_open = lm[4].x < lm[3].x  # Thumb extends outward (for right hand)
        # For robustness, check if thumb tip is far from palm
        index_open = lm[8].y < lm[6].y
        middle_open = lm[12].y < lm[10].y
        ring_open = lm[16].y < lm[14].y
        pinky_open = lm[20].y < lm[18].y

        return index_open and middle_open and ring_open and pinky_open

    def detect_pinch(self, hand_results):
        """Detects pinch gesture (thumb tip close to index finger tip)."""
        if not hand_results or not hand_results.multi_hand_landmarks:
            return False
        lm = hand_results.multi_hand_landmarks[0].landmark
        dx = lm[4].x - lm[8].x
        dy = lm[4].y - lm[8].y
        dist = math.sqrt(dx*dx + dy*dy)
        return dist < 0.05  # threshold for pinch

    def get_hand_label(self, hand_results):
        """Returns the handedness label ('Left' or 'Right') of the detected hand."""
        if not hand_results or not hand_results.multi_handedness:
            return None
        return hand_results.multi_handedness[0].classification[0].label

    # --- 5. GESTURE DETECTION (The Hardware Agnostic Layer) ---
    def detect_gestures(self, face, hand_results=None):
        """ Analyzes face against PERSONALIZED baselines to return active physical gestures. """
        if not self.is_agent_calibrated: return []

        r_ear = self.get_ear(face, 159, 145, 133, 33)
        l_ear = self.get_ear(face, 386, 374, 362, 263)
        mouth_w = self.get_norm_dist(face, 61, 291)
        mouth_h = self.get_norm_dist(face, 13, 14)
        face_w = self.get_norm_dist(face, 234, 454)

        mar = mouth_h / mouth_w if mouth_w > 0 else 0
        m_ratio = mouth_w / face_w if face_w > 0 else 0

        # Personalized Thresholds (e.g. "Eye must be 60% smaller than YOUR normal resting eye")
        L_CLOSED = l_ear < (self.base_l_ear * 0.6)
        R_CLOSED = r_ear < (self.base_r_ear * 0.6)
        L_OPEN = l_ear > (self.base_l_ear * 0.8)
        R_OPEN = r_ear > (self.base_r_ear * 0.8)

        # Mouth must open 3x wider than YOUR normal resting state
        JAW_DROPPED = mar > (self.base_mar + 0.25)
        # Mouth must shrink to 85% of YOUR normal width
        PUCKERED = m_ratio < (self.base_m_ratio * 0.85)

        active_gestures = []
        if L_CLOSED and R_CLOSED:
            active_gestures.append("both_closed")
        elif L_CLOSED and R_OPEN:
            active_gestures.append("left_wink")
        elif R_CLOSED and L_OPEN:
            active_gestures.append("right_wink")

        if JAW_DROPPED: active_gestures.append("jaw_drop")
        if PUCKERED: active_gestures.append("pucker")

        # Palm detection
        if self.detect_palm(hand_results):
            active_gestures.append("open_palm")

        return active_gestures

    # --- 6. THE ROUTER (Executes actions based on settings.py) ---
    def process_actions(self, face, hand_results=None):
        now = time.time()
        state_msgs = []

        # 1. Detect physical gestures using the Auto-Agent
        active_gestures = self.detect_gestures(face, hand_results)
        if not self.is_agent_calibrated: return ["[ PRESS 'C' TO CALIBRATE AGENT ]"]

        # 2. Get user preferences from settings
        mapping = settings.GESTURE_MAPPINGS

        # --- KEYBOARD INPUT: PINCH COPY/PASTE ---
        if getattr(settings, 'PINCH_COPY_PASTE', False):
            pinch_now = self.detect_pinch(hand_results)
            if pinch_now and not self.is_pinching:
                # Pinch started -> Copy
                if now - self.last_pinch_time > 1.0:  # cooldown
                    pyautogui.hotkey('ctrl', 'c')
                    self.last_pinch_time = now
                    state_msgs.append("COPY (Ctrl+C)")
                self.is_pinching = True
            elif not pinch_now and self.is_pinching:
                # Unpinch -> Paste
                if now - self.last_pinch_time > 0.5:  # cooldown
                    pyautogui.hotkey('ctrl', 'v')
                    self.last_pinch_time = now
                    state_msgs.append("PASTE (Ctrl+V)")
                self.is_pinching = False

        # --- KEYBOARD INPUT: HAND-SWAP WINDOW SWITCH ---
        if getattr(settings, 'HAND_SWAP_WINDOW_SWITCH', False):
            current_label = self.get_hand_label(hand_results)
            if current_label and self.last_hand_label:
                if current_label != self.last_hand_label and now - self.last_hand_swap_time > 1.5:
                    if current_label == 'Right':  # left -> right
                        pyautogui.hotkey('alt', 'tab')
                        state_msgs.append("WINDOW SWITCH →")
                    else:  # right -> left
                        pyautogui.hotkey('alt', 'shift', 'tab')
                        state_msgs.append("WINDOW SWITCH ←")
                    self.last_hand_swap_time = now
            if current_label:
                self.last_hand_label = current_label

        # Skip mouse gesture actions if mouse control is disabled
        if not getattr(settings, 'MOUSE_CONTROL_ENABLED', True):
            return state_msgs

        # --- SCROLL ROUTER (respects SCROLL_ENABLED toggle) ---
        scroll_enabled = getattr(settings, 'SCROLL_ENABLED', True)
        scroll_gesture = mapping.get("scroll")
        if scroll_enabled and scroll_gesture and scroll_gesture != 'none' and scroll_gesture in active_gestures:
            if self.action_states["scroll_start"] == 0:
                self.action_states["scroll_start"] = now
            elif now - self.action_states["scroll_start"] > 0.5:
                self.action_states["scroll_mode"] = not self.action_states["scroll_mode"]
                self.action_states["scroll_start"] = now + 1.0  # Cooldown
        else:
            self.action_states["scroll_start"] = 0

        if self.action_states["scroll_mode"] and scroll_enabled:
            state_msgs.append("[SCROLL MODE ACTIVE]")
            dx = abs(face.landmark[263].x - face.landmark[33].x)
            dy = face.landmark[263].y - face.landmark[33].y
            angle = math.degrees(math.atan2(dy, max(dx, 0.0001)))
            if now - self.action_states["last_scroll"] > 0.05:
                if angle > 10:
                    pyautogui.scroll(60); self.action_states["last_scroll"] = now
                elif angle < -10:
                    pyautogui.scroll(-60); self.action_states["last_scroll"] = now
            return state_msgs  # Block other clicks while scrolling
        elif not scroll_enabled:
            self.action_states["scroll_mode"] = False

        # --- DRAG ROUTER ---
        drag_gesture = mapping.get("drag_drop")
        if drag_gesture and drag_gesture != 'none' and drag_gesture in active_gestures:
            if self.action_states["drag_start"] == 0:
                self.action_states["drag_start"] = now
            elif now - self.action_states["drag_start"] > 0.2:
                if not self.action_states["is_dragging"]:
                    pyautogui.mouseDown()
                    self.action_states["is_dragging"] = True
                state_msgs.append("[ DRAGGING ACTIVE ]")
        else:
            self.action_states["drag_start"] = 0
            if self.action_states["is_dragging"]:
                pyautogui.mouseUp()
                self.action_states["is_dragging"] = False
                state_msgs.append("DROPPED")

        # --- LEFT CLICK ROUTER ---
        l_click_gesture = mapping.get("left_click")
        if l_click_gesture and l_click_gesture != 'none' and l_click_gesture in active_gestures:
            if self.action_states["left_click_start"] == 0:
                self.action_states["left_click_start"] = now
            elif now - self.action_states["left_click_start"] > 0.15:
                if not self.action_states["is_clicking"]:
                    pyautogui.click()
                    self.action_states["is_clicking"] = True
                    state_msgs.append("LEFT CLICK")
        else:
            self.action_states["left_click_start"] = 0
            self.action_states["is_clicking"] = False

        # --- RIGHT CLICK ROUTER ---
        r_click_gesture = mapping.get("right_click")
        if r_click_gesture and r_click_gesture != 'none' and r_click_gesture in active_gestures:
            if self.action_states["right_click_start"] == 0:
                self.action_states["right_click_start"] = now
            elif now - self.action_states["right_click_start"] > 0.2:
                if now - self.action_states["last_right_click"] > 0.8:
                    pyautogui.rightClick()
                    self.action_states["last_right_click"] = now
                    state_msgs.append("RIGHT CLICK")
        else:
            self.action_states["right_click_start"] = 0

        # --- DOUBLE CLICK ROUTER ---
        d_click_gesture = mapping.get("double_click")
        if d_click_gesture and d_click_gesture != 'none' and d_click_gesture in active_gestures:
            if self.action_states["double_click_start"] == 0:
                self.action_states["double_click_start"] = now
            elif now - self.action_states["double_click_start"] > 0.2:
                if now - self.action_states["last_double_click"] > 1.0:
                    pyautogui.doubleClick()
                    self.action_states["last_double_click"] = now
                    state_msgs.append("DOUBLE CLICK")
        else:
            self.action_states["double_click_start"] = 0

        # --- MEDIA PLAY/PAUSE ROUTER ---
        media_gesture = mapping.get("media_play_pause")
        if media_gesture and media_gesture != 'none' and media_gesture in active_gestures:
            if self.action_states["media_pp_start"] == 0:
                self.action_states["media_pp_start"] = now
            elif now - self.action_states["media_pp_start"] > 0.2:
                if now - self.action_states["last_media_pp"] > 1.5:
                    pyautogui.press('playpause')
                    self.action_states["last_media_pp"] = now
                    state_msgs.append("MEDIA PLAY/PAUSE")
        else:
            self.action_states["media_pp_start"] = 0

        return state_msgs