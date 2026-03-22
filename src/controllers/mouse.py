import pyautogui
import numpy as np
import math
import time
import os
from collections import deque
import settings

# Native cursor API for lower latency (Windows only)
_use_native_cursor = False
if os.name == 'nt':
    try:
        import ctypes
        _user32 = ctypes.windll.user32
        _use_native_cursor = True
        _MOUSEEVENTF_LEFTDOWN = 0x0002
        _MOUSEEVENTF_LEFTUP = 0x0004
        _MOUSEEVENTF_RIGHTDOWN = 0x0008
        _MOUSEEVENTF_RIGHTUP = 0x0010
        _MOUSEEVENTF_WHEEL = 0x0800
    except Exception:
        pass


class MouseController:
    def __init__(self):
        pyautogui.FAILSAFE = False
        pyautogui.PAUSE = 0

        self.screen_w, self.screen_h = pyautogui.size()
        self.center_x = self.screen_w / 2.0
        self.center_y = self.screen_h / 2.0
        self.cursor_x = self.center_x
        self.cursor_y = self.center_y
        self.dead_zone_norm = getattr(settings, 'DEADZONE', 0.03)

        # --- THE AUTO-AGENT (Personalized Baselines) ---
        self.is_agent_calibrated = False
        self._calibration_samples = []
        self._TARGET_CALIBRATION_FRAMES = 12
        self._gesture_started_at = {}
        self._prev_active_gestures = set()
        self._prev_m_ratio = 0.0
        
        self.base_l_ear = 0.25  # Left Eye resting width
        self.base_r_ear = 0.25  # Right Eye resting width
        self.base_l_brow_eye = 0.055
        self.base_r_brow_eye = 0.055
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

        # --- PREMIUM SWIPE DETECTION STATE ---
        self._swipe_history = deque(maxlen=20)       # Rolling buffer: (timestamp, smoothed_x)
        self._swipe_smooth_x = None                  # EMA-smoothed hand X position
        self._swipe_state = {
            "phase": "idle",              # idle -> armed -> fired
            "stable_side": 0,             # Candidate side while waiting to arm
            "stable_since": 0.0,          # Timestamp when the palm became stable
            "arm_side": 0,                # Side from which the active swipe started
            "arm_origin_x": 0.0,          # Smoothed X value when the swipe armed
            "arm_origin_time": 0.0,       # Timestamp when the swipe armed
            "fired_direction": 0,         # Direction of the last emitted swipe
            "settle_since": 0.0,          # When the post-trigger settle condition began
            "last_trigger_time": 0.0,     # Cooldown timestamp
            "last_seen_time": 0.0,        # Last time hand was visible
        }

        self.face_missing_start = 0
        self.has_auto_paused = False

    def reset_agent_calibration(self):
        self.is_agent_calibrated = False
        self._calibration_samples.clear()
        self._gesture_started_at.clear()
        self._prev_active_gestures.clear()
        self._prev_m_ratio = 0.0
        self.base_l_ear = 0.25
        self.base_r_ear = 0.25
        self.base_l_brow_eye = 0.055
        self.base_r_brow_eye = 0.055
        self.base_mar = 0.05
        self.base_m_ratio = 0.35
        self._swipe_history.clear()
        self._swipe_smooth_x = None
        self._swipe_state.update({
            "phase": "idle",
            "stable_side": 0,
            "stable_since": 0.0,
            "arm_side": 0,
            "arm_origin_x": 0.0,
            "arm_origin_time": 0.0,
            "fired_direction": 0,
            "settle_since": 0.0,
            "last_trigger_time": 0.0,
            "last_seen_time": 0.0,
        })

    # --- 1. THE AUTO-AGENT CALIBRATOR ---
    def calibrate_agent(self, face):
        """ Scans 30 frames of resting face to create robust personalized baselines. """
        if face is None:
            return False
        
        r_ear = self.get_ear(face, 159, 145, 133, 33)
        l_ear = self.get_ear(face, 386, 374, 362, 263)
        r_brow_eye = self.get_norm_dist(face, 105, 159)
        l_brow_eye = self.get_norm_dist(face, 334, 386)
        mouth_w = self.get_norm_dist(face, 61, 291)
        mouth_h = self.get_norm_dist(face, 13, 14)
        face_w = self.get_norm_dist(face, 234, 454)

        mar = mouth_h / mouth_w if mouth_w > 0 else 0
        m_ratio = mouth_w / face_w if face_w > 0 else 0

        # Only use neutral frames for calibration so a wink/blink/open mouth
        # during startup doesn't poison the baseline.
        if l_ear < 0.20 or r_ear < 0.20 or mar > 0.12:
            return False
        
        self._calibration_samples.append({
            'l_ear': l_ear, 'r_ear': r_ear,
            'l_brow_eye': l_brow_eye, 'r_brow_eye': r_brow_eye,
            'mar': mar, 'm_ratio': m_ratio
        })
        
        if len(self._calibration_samples) >= self._TARGET_CALIBRATION_FRAMES:
            # Calculate averages
            self.base_l_ear = sum(s['l_ear'] for s in self._calibration_samples) / self._TARGET_CALIBRATION_FRAMES
            self.base_r_ear = sum(s['r_ear'] for s in self._calibration_samples) / self._TARGET_CALIBRATION_FRAMES
            self.base_l_brow_eye = sum(s['l_brow_eye'] for s in self._calibration_samples) / self._TARGET_CALIBRATION_FRAMES
            self.base_r_brow_eye = sum(s['r_brow_eye'] for s in self._calibration_samples) / self._TARGET_CALIBRATION_FRAMES
            self.base_mar = sum(s['mar'] for s in self._calibration_samples) / self._TARGET_CALIBRATION_FRAMES
            self.base_m_ratio = sum(s['m_ratio'] for s in self._calibration_samples) / self._TARGET_CALIBRATION_FRAMES
            
            self.is_agent_calibrated = True
            # Clear samples for next time
            self._calibration_samples.clear()
            print(f"[AGENT] Calibrated (30 frames) - L_Eye:{self.base_l_ear:.3f}, R_Eye:{self.base_r_ear:.3f}")
            return True

        return False

    # --- 2. MOVEMENT ---
    def apply_dead_zone(self, v):
        if abs(v) < self.dead_zone_norm: return 0
        return v - self.dead_zone_norm if v > 0 else v + self.dead_zone_norm

    def acceleration_curve(self, v):
        exp = getattr(settings, 'ACCELERATION', 1.6)
        return np.sign(v) * (abs(v) ** exp)

    def move(self, dx_pixels, dy_pixels):
        """Move cursor by pixel deltas (velocity/joystick model).
        dx_pixels / dy_pixels are per-frame pixel movements from MotionEngine.
        """
        if self.action_states["scroll_mode"]: return

        # Accumulate position
        self.cursor_x += dx_pixels
        self.cursor_y += dy_pixels

        # Clamp to screen bounds and detect if we hit the edge
        hit_edge_x = False
        hit_edge_y = False
        
        if self.cursor_x < 0:
            self.cursor_x = 0
            hit_edge_x = True
        elif self.cursor_x >= self.screen_w:
            self.cursor_x = self.screen_w - 1
            hit_edge_x = True
            
        if self.cursor_y < 0:
            self.cursor_y = 0
            hit_edge_y = True
        elif self.cursor_y >= self.screen_h:
            self.cursor_y = self.screen_h - 1
            hit_edge_y = True

        gx = int(self.cursor_x)
        gy = int(self.cursor_y)

        # Use native Win32 API for minimal latency, fallback to pyautogui
        if _use_native_cursor:
            _user32.SetCursorPos(gx, gy)
        else:
            pyautogui.moveTo(gx, gy)
            
        return hit_edge_x, hit_edge_y

    def _left_down(self):
        if _use_native_cursor:
            _user32.mouse_event(_MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0)
        else:
            pyautogui.mouseDown()

    def _left_up(self):
        if _use_native_cursor:
            _user32.mouse_event(_MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)
        else:
            pyautogui.mouseUp()

    def _left_click(self):
        if _use_native_cursor:
            self._left_down()
            self._left_up()
        else:
            pyautogui.click()

    def _right_click(self):
        if _use_native_cursor:
            _user32.mouse_event(_MOUSEEVENTF_RIGHTDOWN, 0, 0, 0, 0)
            _user32.mouse_event(_MOUSEEVENTF_RIGHTUP, 0, 0, 0, 0)
        else:
            pyautogui.rightClick()

    def _double_click(self):
        if _use_native_cursor:
            self._left_click()
            time.sleep(0.04)
            self._left_click()
        else:
            pyautogui.doubleClick()

    def _scroll(self, amount):
        if _use_native_cursor:
            _user32.mouse_event(_MOUSEEVENTF_WHEEL, 0, 0, int(amount), 0)
        else:
            pyautogui.scroll(amount)

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
        index_open = lm[8].y < lm[6].y
        middle_open = lm[12].y < lm[10].y
        ring_open = lm[16].y < lm[14].y
        pinky_open = lm[20].y < lm[18].y
        open_count = sum((index_open, middle_open, ring_open, pinky_open))

        return open_count >= 3

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

    def get_hand_confidence(self, hand_results):
        if not hand_results or not hand_results.multi_handedness:
            return 1.0
        try:
            return float(hand_results.multi_handedness[0].classification[0].score)
        except Exception:
            return 1.0

    def _reset_swipe_tracking(self, preserve_cooldown=True):
        """Clear all swipe state for a fresh start."""
        last_trigger_time = self._swipe_state["last_trigger_time"] if preserve_cooldown else 0.0
        last_seen_time = self._swipe_state["last_seen_time"] if preserve_cooldown else 0.0
        self._swipe_history.clear()
        self._swipe_smooth_x = None
        self._swipe_state.update({
            "phase": "idle",
            "stable_side": 0,
            "stable_since": 0.0,
            "arm_side": 0,
            "arm_origin_x": 0.0,
            "arm_origin_time": 0.0,
            "fired_direction": 0,
            "settle_since": 0.0,
            "last_trigger_time": last_trigger_time,
            "last_seen_time": last_seen_time,
        })

    def _arm_hand_swap(self, side, rel_x, now):
        """Enter the armed phase once the palm is stable on a start side."""
        self._swipe_history.clear()
        self._swipe_history.append((now, rel_x))
        self._swipe_state.update({
            "phase": "armed",
            "stable_side": 0,
            "stable_since": 0.0,
            "arm_side": side,
            "arm_origin_x": rel_x,
            "arm_origin_time": now,
            "settle_since": 0.0,
        })

    def _maybe_rearm_after_fire(self, rel_x, rel_y, palm_active, now):
        """Ignore the return path until the hand settles or leaves the activation zone."""
        state = self._swipe_state

        _REARM_SETTLE = 0.10
        _REARM_NEUTRAL_BAND = 0.22
        _REARM_SIDE_BAND = 0.38
        _LOWER_Y_THRESHOLD = 0.95
        _MAX_FIRE_HOLD = 1.0

        settled = (
            not palm_active or
            abs(rel_x) <= _REARM_NEUTRAL_BAND or
            abs(rel_x) >= _REARM_SIDE_BAND or
            rel_y >= _LOWER_Y_THRESHOLD
        )

        if settled:
            if state["settle_since"] == 0.0:
                state["settle_since"] = now
            elif now - state["settle_since"] >= _REARM_SETTLE:
                self._reset_swipe_tracking(preserve_cooldown=True)
        else:
            state["settle_since"] = 0.0

        if now - state["last_trigger_time"] >= _MAX_FIRE_HOLD:
            self._reset_swipe_tracking(preserve_cooldown=True)

    def _advance_hand_swap_state(self, *, rel_x=None, rel_y=0.0, palm_active=False, hand_visible=False, now=None):
        """Advance the window-swipe state machine from normalized hand samples."""
        if now is None:
            now = time.time()

        state = self._swipe_state

        _ARM_SIDE_THRESHOLD = 0.28
        _ARM_HOLD = 0.04
        _ARM_TIMEOUT = 1.0
        _HISTORY_WINDOW = 0.75
        _COOLDOWN = 0.45
        _MIN_TRAVEL = 0.24
        _CENTER_CROSS = 0.00
        _MIN_SPEED = 0.35
        _MIN_CONSISTENCY = 0.55
        _MISSING_RESET = 0.30
        _DROP_BEFORE_TRIGGER_Y = 1.25

        if hand_visible:
            state["last_seen_time"] = now
        elif now - state["last_seen_time"] > _MISSING_RESET:
            self._reset_swipe_tracking(preserve_cooldown=True)
            return None

        if state["phase"] == "fired":
            if hand_visible and rel_x is not None:
                self._maybe_rearm_after_fire(rel_x, rel_y, palm_active, now)
            return None

        if not hand_visible or rel_x is None:
            return None

        side = 1 if rel_x >= _ARM_SIDE_THRESHOLD else (-1 if rel_x <= -_ARM_SIDE_THRESHOLD else 0)

        if state["phase"] == "idle":
            if palm_active and side != 0:
                if state["stable_side"] != side:
                    state["stable_side"] = side
                    state["stable_since"] = now
                elif now - state["stable_since"] >= _ARM_HOLD:
                    self._arm_hand_swap(side, rel_x, now)
            else:
                state["stable_side"] = 0
                state["stable_since"] = 0.0
            return None

        if state["phase"] != "armed":
            return None

        if rel_y >= _DROP_BEFORE_TRIGGER_Y:
            self._reset_swipe_tracking(preserve_cooldown=True)
            return None

        arm_side = state["arm_side"]
        if arm_side == 0:
            self._reset_swipe_tracking(preserve_cooldown=True)
            return None

        expected_dir = -arm_side

        # Let the palm settle slightly farther out before the actual cross-face sweep starts.
        if side == arm_side and (rel_x - state["arm_origin_x"]) * arm_side > 0:
            state["arm_origin_x"] = rel_x
            state["arm_origin_time"] = now
            self._swipe_history.clear()
            self._swipe_history.append((now, rel_x))
            return None

        self._swipe_history.append((now, rel_x))
        while self._swipe_history and now - self._swipe_history[0][0] > _HISTORY_WINDOW:
            self._swipe_history.popleft()

        progress = (rel_x - state["arm_origin_x"]) * expected_dir
        crossed_center = rel_x * arm_side <= -_CENTER_CROSS

        if now - state["arm_origin_time"] > _ARM_TIMEOUT and progress < _MIN_TRAVEL:
            self._reset_swipe_tracking(preserve_cooldown=True)
            return None

        if progress < -0.12:
            self._reset_swipe_tracking(preserve_cooldown=True)
            return None

        if len(self._swipe_history) < 3 or not crossed_center or progress < _MIN_TRAVEL:
            return None

        deltas = [self._swipe_history[i + 1][1] - self._swipe_history[i][1] for i in range(len(self._swipe_history) - 1)]
        agreeing = sum(1 for delta in deltas if delta == 0 or delta * expected_dir > 0)
        consistency = agreeing / len(deltas)
        if consistency < _MIN_CONSISTENCY:
            return None

        dt = now - state["arm_origin_time"]
        speed = progress / dt if dt > 0 else 0.0
        if speed < _MIN_SPEED:
            return None

        if now - state["last_trigger_time"] < _COOLDOWN:
            return None

        event = "WINDOW_NEXT" if expected_dir > 0 else "WINDOW_PREV"
        state.update({
            "phase": "fired",
            "fired_direction": expected_dir,
            "settle_since": 0.0,
            "stable_side": 0,
            "stable_since": 0.0,
            "last_trigger_time": now,
        })
        self._swipe_history.clear()
        self._swipe_history.append((now, rel_x))

        print(f"[SWIPE] {event} arm_side={arm_side:+d} progress={progress:.3f} "
              f"speed={speed:.2f} consistency={consistency:.0%} rel_x={rel_x:.3f}")
        return event

    _swipe_debug_counter = 0

    def _legacy_detect_hand_swap_event(self, face, hand_results, now=None):
        """Premium hand swipe detector for window switching.

        Pipeline:
          1. Orientation-independent hand center (averaged base joints)
          2. Face-width normalization
          3. EMA smoothing (kills single-frame jitter)
          4. Rolling motion history buffer (auto-pruned to 600ms)
          5. Direction consistency voting (≥70% agreement)
          6. Early intent trigger (displacement + speed + consistency)
          7. One-shot lock with smart reset

        Returns 'WINDOW_NEXT', 'WINDOW_PREV', or None.
        """
        if now is None:
            now = time.time()

        state = self._swipe_state

        # ── No hand visible: decay and reset ──────────────────────────────
        if face is None or not hand_results or not hand_results.multi_hand_landmarks:
            if now - state["last_seen_time"] > 0.4:
                self._reset_swipe_tracking()
            return None

        # Low-confidence detections are noise
        if self.get_hand_confidence(hand_results) < 0.25:
            return None

        # ── 1. Orientation-independent hand center ────────────────────────
        # Average of wrist (0) + all MCP bases (5, 9, 13, 17)
        # Works regardless of palm/edge/tilted orientation
        hand = hand_results.multi_hand_landmarks[0]
        raw_hand_x = sum(hand.landmark[i].x for i in (0, 5, 9, 13, 17)) / 5.0

        # ── 2. Face-width normalization ───────────────────────────────────
        face_center_x = (face.landmark[234].x + face.landmark[454].x) / 2.0
        face_width = abs(face.landmark[454].x - face.landmark[234].x)
        if face_width < 0.05:
            return None

        raw_rel_x = (raw_hand_x - face_center_x) / face_width

        # ── 3. EMA smoothing (α=0.4: low lag, kills jitter) ──────────────
        _EMA_ALPHA = 0.4
        if self._swipe_smooth_x is None:
            self._swipe_smooth_x = raw_rel_x
        else:
            self._swipe_smooth_x += _EMA_ALPHA * (raw_rel_x - self._swipe_smooth_x)

        rel_x = self._swipe_smooth_x

        # ── 4. Rolling motion history ─────────────────────────────────────
        self._swipe_history.append((now, rel_x))
        state["last_seen_time"] = now

        # Prune to 600ms window (fast swipes happen within this)
        _HISTORY_WINDOW = 0.6
        while self._swipe_history and now - self._swipe_history[0][0] > _HISTORY_WINDOW:
            self._swipe_history.popleft()

        # ── Smart reset logic (unlock the one-shot lock) ──────────────────
        if state["locked"]:
            # Calculate instantaneous speed from last 3 samples
            if len(self._swipe_history) >= 3:
                t_recent = self._swipe_history[-1][0] - self._swipe_history[-3][0]
                x_recent = self._swipe_history[-1][1] - self._swipe_history[-3][1]
                inst_speed = abs(x_recent) / t_recent if t_recent > 0 else 0.0

                # Detect direction reversal from trigger direction
                recent_dir = 1 if x_recent > 0 else (-1 if x_recent < 0 else 0)
                direction_reversed = (
                    state["lock_direction"] != 0 and
                    recent_dir != 0 and
                    recent_dir != state["lock_direction"]
                )

                # Returned close to lock position
                returned_to_origin = abs(rel_x - state["lock_x"]) < 0.15

                # Motion has stopped
                motion_stopped = inst_speed < 0.3

                if direction_reversed or returned_to_origin or motion_stopped:
                    state["locked"] = False
                    state["lock_direction"] = 0
                    self._swipe_history.clear()
                    self._swipe_smooth_x = None

            return None

        # ── Cooldown guard (minimum 0.6s between triggers) ────────────────
        _COOLDOWN = 0.6
        if now - state["last_trigger_time"] < _COOLDOWN:
            return None

        # ── Need at least 4 samples for meaningful analysis ───────────────
        if len(self._swipe_history) < 4:
            return None

        # ── 5-7. Swipe analysis pipeline ──────────────────────────────────
        xs = [x for _, x in self._swipe_history]
        ts = [t for t, _ in self._swipe_history]

        _MIN_DISPLACEMENT = 0.35   # 35% face width (early intent — before full crossing)
        _MIN_SPEED = 1.2           # 1.2 face-widths/second (momentum awareness)
        _MIN_CONSISTENCY = 0.70    # 70% of segments must agree on direction
        _MIN_TIME_SPAN = 0.06      # Minimum time span to reject tracking glitches

        event_triggered = None

        # Scan sub-windows ending at latest sample (catches fast bursts)
        for i in range(len(xs) - 3, -1, -1):
            dx = xs[-1] - xs[i]
            dt = ts[-1] - ts[i]

            if dt < _MIN_TIME_SPAN:
                continue

            abs_dx = abs(dx)
            if abs_dx < _MIN_DISPLACEMENT:
                continue

            speed = abs_dx / dt
            if speed < _MIN_SPEED:
                continue

            # ── Direction consistency voting ──────────────────────────
            sub_xs = xs[i:]
            n_segments = len(sub_xs) - 1
            if n_segments < 2:
                continue

            target_dir = 1 if dx > 0 else -1
            agreeing = 0
            for k in range(n_segments):
                seg_delta = sub_xs[k + 1] - sub_xs[k]
                if seg_delta * target_dir > 0:   # Same sign = agrees
                    agreeing += 1
                # Zero-delta segments are neutral (not counted against)
                elif seg_delta == 0:
                    agreeing += 1

            consistency = agreeing / n_segments
            if consistency < _MIN_CONSISTENCY:
                continue

            # ── Momentum check: recent 3-sample speed ────────────────
            t3 = ts[-1] - ts[-3]
            x3 = abs(xs[-1] - xs[-3])
            recent_speed = x3 / t3 if t3 > 0 else 0.0
            if recent_speed < _MIN_SPEED * 0.6:  # Decelerating too much
                continue

            # ── TRIGGER ───────────────────────────────────────────────
            event = "WINDOW_NEXT" if dx > 0 else "WINDOW_PREV"

            # Engage one-shot lock
            state["locked"] = True
            state["lock_x"] = rel_x
            state["lock_direction"] = target_dir
            state["last_trigger_time"] = now
            self._swipe_history.clear()
            self._swipe_smooth_x = None

            print(f"[SWIPE] {event}  dx={dx:.3f}  dt={dt:.3f}  "
                  f"spd={speed:.1f}  consist={consistency:.0%}  "
                  f"recent_spd={recent_speed:.1f}")
            event_triggered = event
            break

        if event_triggered:
            return event_triggered

        # ── Debug logging (every 20 frames) ───────────────────────────────
        MouseController._swipe_debug_counter += 1
        if MouseController._swipe_debug_counter % 20 == 0:
            total_dx = xs[-1] - xs[0]
            total_dt = ts[-1] - ts[0]
            if total_dt > 0:
                print(f"[SWIPE_DBG] dx={total_dx:.3f} dt={total_dt:.3f} "
                      f"rel_x={rel_x:.3f} locked={state['locked']}")

        return None

    def detect_hand_swap_event(self, face, hand_results, now=None):
        """Detect a deliberate open-palm sweep across the face for window switching."""
        if now is None:
            now = time.time()

        if face is None or not hand_results or not hand_results.multi_hand_landmarks:
            return self._advance_hand_swap_state(hand_visible=False, now=now)

        if self.get_hand_confidence(hand_results) < 0.25:
            return self._advance_hand_swap_state(hand_visible=False, now=now)

        hand = hand_results.multi_hand_landmarks[0]
        raw_hand_x = sum(hand.landmark[i].x for i in (0, 5, 9, 13, 17)) / 5.0
        raw_hand_y = sum(hand.landmark[i].y for i in (0, 5, 9, 13, 17)) / 5.0

        face_center_x = (face.landmark[234].x + face.landmark[454].x) / 2.0
        face_center_y = (face.landmark[10].y + face.landmark[152].y) / 2.0
        face_width = abs(face.landmark[454].x - face.landmark[234].x)
        if face_width < 0.05:
            return None

        raw_rel_x = (raw_hand_x - face_center_x) / face_width
        raw_rel_y = (raw_hand_y - face_center_y) / face_width

        _EMA_ALPHA = 0.45
        if self._swipe_smooth_x is None:
            self._swipe_smooth_x = raw_rel_x
        else:
            self._swipe_smooth_x += _EMA_ALPHA * (raw_rel_x - self._swipe_smooth_x)

        rel_x = self._swipe_smooth_x
        palm_active = self.detect_palm(hand_results)

        MouseController._swipe_debug_counter += 1
        if MouseController._swipe_debug_counter % 20 == 0:
            print(f"[SWIPE_DBG] rel_x={rel_x:.3f} rel_y={raw_rel_y:.3f} "
                  f"palm={palm_active} phase={self._swipe_state['phase']}")

        return self._advance_hand_swap_state(
            rel_x=rel_x,
            rel_y=raw_rel_y,
            palm_active=palm_active,
            hand_visible=True,
            now=now,
        )

    # --- 5. GESTURE DETECTION (The Hardware Agnostic Layer) ---
    _gesture_debug_counter = 0

    def _get_gesture_config(self, gesture_name):
        return getattr(settings, 'GESTURE_CALIBRATION', {}).get(gesture_name, {})

    def _get_hold_duration(self, gesture_name, default=0.2):
        return float(self._get_gesture_config(gesture_name).get('hold_duration', default))

    def _get_threshold(self, gesture_name, default):
        return float(self._get_gesture_config(gesture_name).get('threshold', default))

    def _sustain_gesture(self, gesture_name, raw_active, now, default_hold=0.2, hold_duration=None):
        if not raw_active:
            self._gesture_started_at.pop(gesture_name, None)
            return False

        started_at = self._gesture_started_at.setdefault(gesture_name, now)
        if hold_duration is None:
            hold_duration = self._get_hold_duration(gesture_name, default_hold)
        return hold_duration <= 0 or (now - started_at) >= hold_duration

    def detect_gestures(self, face, hand_results=None):
        if face is None:
            return []

        now = time.time()

        r_ear = self.get_ear(face, 159, 145, 133, 33)
        l_ear = self.get_ear(face, 386, 374, 362, 263)
        r_brow_eye = self.get_norm_dist(face, 105, 159)
        l_brow_eye = self.get_norm_dist(face, 334, 386)

        mouth_w = self.get_norm_dist(face, 61, 291)
        mouth_h = self.get_norm_dist(face, 13, 14)
        face_w = self.get_norm_dist(face, 234, 454)

        mar = mouth_h / mouth_w if mouth_w > 0 else 0
        current_m_ratio = mouth_w / face_w if face_w > 0 else 0
        left_ratio = l_ear / self.base_l_ear if self.base_l_ear > 0 else 1.0
        right_ratio = r_ear / self.base_r_ear if self.base_r_ear > 0 else 1.0

        left_delta = (self.base_l_ear - l_ear) / self.base_l_ear if self.base_l_ear > 0 else 0
        right_delta = (self.base_r_ear - r_ear) / self.base_r_ear if self.base_r_ear > 0 else 0

        mouth_delta = self._prev_m_ratio - current_m_ratio
        self._prev_m_ratio = current_m_ratio

        left_wink_threshold = self._get_threshold('left_wink', 0.78)
        right_wink_threshold = self._get_threshold('right_wink', 0.78)
        both_closed_threshold = self._get_threshold('both_closed', 0.45)
        pucker_threshold = self._get_threshold('pucker', 0.80)
        jaw_thresh = self._get_threshold('jaw_drop', 0.15)
        abs_eye_closed = 0.19
        abs_eye_open = 0.205
        abs_pucker_ratio = 0.29

        other_eye_open_guard = 0.72
        left_closed_enough = left_ratio <= left_wink_threshold or left_delta >= 0.18 or l_ear <= abs_eye_closed
        right_closed_enough = right_ratio <= right_wink_threshold or right_delta >= 0.18 or r_ear <= abs_eye_closed
        left_eye_open_enough = left_ratio >= max(0.78, other_eye_open_guard) or l_ear >= abs_eye_open
        right_eye_open_enough = right_ratio >= max(0.78, other_eye_open_guard) or r_ear >= abs_eye_open
        left_brow_raised = l_brow_eye >= max(self.base_l_brow_eye * 1.15, self.base_l_brow_eye + 0.012)
        right_brow_raised = r_brow_eye >= max(self.base_r_brow_eye * 1.15, self.base_r_brow_eye + 0.012)
        eye_separation = abs(l_ear - r_ear)

        raw_left_wink = (
            ((left_closed_enough and (right_eye_open_enough or right_brow_raised)) and eye_separation >= 0.018) or
            (l_ear <= abs_eye_closed and r_ear >= abs_eye_open)
        )
        raw_right_wink = (
            ((right_closed_enough and (left_eye_open_enough or left_brow_raised)) and eye_separation >= 0.018) or
            (r_ear <= abs_eye_closed and l_ear >= abs_eye_open)
        )
        raw_both_closed = (
            (left_ratio <= both_closed_threshold and right_ratio <= both_closed_threshold) or
            (l_ear <= abs_eye_closed and r_ear <= abs_eye_closed)
        )
        raw_pucker = (
            current_m_ratio <= (self.base_m_ratio * pucker_threshold) or
            current_m_ratio <= abs_pucker_ratio or
            ((self.base_m_ratio - current_m_ratio) >= 0.035 and mar <= max(self.base_mar + 0.03, 0.18))
        )

        is_dragging = getattr(self, 'action_states', {}).get("is_dragging", False)
        raw_jaw_drop = mar > (self.base_mar + (0.05 if is_dragging else jaw_thresh))
        raw_open_palm = self.detect_palm(hand_results)

        left_wink_hold = min(self._get_hold_duration('left_wink', 0.06), 0.08)
        right_wink_hold = min(self._get_hold_duration('right_wink', 0.06), 0.08)
        pucker_hold = min(self._get_hold_duration('pucker', 0.10), 0.14)

        L_WINK = self._sustain_gesture('left_wink', raw_left_wink, now, default_hold=0.10, hold_duration=left_wink_hold)
        R_WINK = self._sustain_gesture('right_wink', raw_right_wink, now, default_hold=0.10, hold_duration=right_wink_hold)
        BOTH_CLOSED = self._sustain_gesture('both_closed', raw_both_closed, now, default_hold=0.5)
        PUCKERED = self._sustain_gesture('pucker', raw_pucker, now, default_hold=0.10, hold_duration=pucker_hold)
        JAW_DROPPED = self._sustain_gesture('jaw_drop', raw_jaw_drop, now, default_hold=0.2)
        OPEN_PALM = self._sustain_gesture('open_palm', raw_open_palm, now, default_hold=0.2)

        MouseController._gesture_debug_counter += 1
        if MouseController._gesture_debug_counter % 30 == 0:
            print(f"[GESTURE] lEAR={l_ear:.3f} rEAR={r_ear:.3f} lBrow={l_brow_eye:.3f} rBrow={r_brow_eye:.3f} dL={left_delta:.3f} dR={right_delta:.3f} ratioL={left_ratio:.3f} ratioR={right_ratio:.3f}")
            print(f"[GESTURE] mouth_ratio={current_m_ratio:.3f} delta={mouth_delta:.3f} jaw={mar:.3f}")

        active_gestures = []

        if L_WINK:
            active_gestures.append("left_wink")

        elif PUCKERED:
            active_gestures.append("pucker")

        elif R_WINK:
            active_gestures.append("right_wink")

        elif JAW_DROPPED:
            active_gestures.append("jaw_drop")

        elif BOTH_CLOSED:
            active_gestures.append("both_closed")

        if OPEN_PALM:
            active_gestures.append("open_palm")

        return active_gestures

    # --- 6. THE ROUTER (Executes actions based on settings.py) ---
    def process_actions(self, face, hand_results=None):
        now = time.time()
        state_msgs = []

        # 1. Detect physical gestures using the Auto-Agent
        active_gestures = set(self.detect_gestures(face, hand_results))
        previous_gestures = self._prev_active_gestures
        if not self.is_agent_calibrated:
            previous_gestures = set()

        # 2. Get user preferences from settings
        mapping = settings.GESTURE_MAPPINGS

        def gesture_started(gesture_name):
            return gesture_name and gesture_name != 'none' and gesture_name in active_gestures and gesture_name not in previous_gestures


        # --- KEYBOARD INPUT: HAND-SWAP WINDOW SWITCH ---
        if getattr(settings, 'HAND_SWAP_WINDOW_SWITCH', False):
            hand_swap_event = self.detect_hand_swap_event(face, hand_results, now)
            if hand_swap_event == "WINDOW_NEXT":
                pyautogui.hotkey('alt', 'tab')
                state_msgs.append("WINDOW_NEXT")
            elif hand_swap_event == "WINDOW_PREV":
                pyautogui.hotkey('alt', 'shift', 'tab')
                state_msgs.append("WINDOW_PREV")

        # Skip mouse gesture actions if mouse control is disabled
        if not getattr(settings, 'MOUSE_CONTROL_ENABLED', True):
            self._prev_active_gestures = active_gestures
            return state_msgs

        # --- SCROLL ROUTER (respects SCROLL_ENABLED toggle) ---
        scroll_enabled = getattr(settings, 'SCROLL_ENABLED', True)
        scroll_gesture = mapping.get("scroll")
        if scroll_enabled and gesture_started(scroll_gesture):
            if now - self.action_states["scroll_start"] > 0.75:
                self.action_states["scroll_mode"] = not self.action_states["scroll_mode"]
                self.action_states["scroll_start"] = now

        if self.action_states["scroll_mode"] and scroll_enabled:
            state_msgs.append("[SCROLL MODE ACTIVE]")
            dx = abs(face.landmark[263].x - face.landmark[33].x)
            dy = face.landmark[263].y - face.landmark[33].y
            angle = math.degrees(math.atan2(dy, max(dx, 0.0001)))
            if now - self.action_states["last_scroll"] > 0.05:
                if angle > 10:
                    self._scroll(60); self.action_states["last_scroll"] = now
                elif angle < -10:
                    self._scroll(-60); self.action_states["last_scroll"] = now
            self._prev_active_gestures = active_gestures
            return state_msgs  # Block other clicks while scrolling
        elif not scroll_enabled:
            self.action_states["scroll_mode"] = False

        # --- DRAG ROUTER ---
        drag_gesture = mapping.get("drag_drop")
        if drag_gesture and drag_gesture != 'none' and drag_gesture in active_gestures:
            if not self.action_states["is_dragging"]:
                self._left_down()
                self.action_states["is_dragging"] = True
            state_msgs.append("[ DRAGGING ACTIVE ]")
        else:
            if self.action_states["is_dragging"]:
                self._left_up()
                self.action_states["is_dragging"] = False
                state_msgs.append("DROPPED")

        # --- LEFT CLICK ROUTER ---
        l_click_gesture = mapping.get("left_click")
        if gesture_started(l_click_gesture):
            if not self.action_states["is_clicking"]:
                self._left_click()
                self.action_states["is_clicking"] = True
                state_msgs.append("LEFT CLICK")
                print("[ACTION] LEFT CLICK")
        else:
            self.action_states["is_clicking"] = False

        # --- RIGHT CLICK ROUTER ---
        r_click_gesture = mapping.get("right_click")
        if gesture_started(r_click_gesture) and now - self.action_states["last_right_click"] > 0.8:
            self._right_click()
            self.action_states["last_right_click"] = now
            state_msgs.append("RIGHT CLICK")
            print("[ACTION] RIGHT CLICK")

        # --- DOUBLE CLICK ROUTER ---
        d_click_gesture = mapping.get("double_click")
        if gesture_started(d_click_gesture) and now - self.action_states["last_double_click"] > 1.0:
            self._double_click()
            self.action_states["last_double_click"] = now
            state_msgs.append("DOUBLE CLICK")
            print("[ACTION] DOUBLE CLICK")

        # --- MEDIA PLAY/PAUSE ROUTER ---
        media_gesture = mapping.get("media_play_pause")
        if gesture_started(media_gesture) and now - self.action_states["last_media_pp"] > 1.5:
            pyautogui.press('playpause')
            self.action_states["last_media_pp"] = now
            state_msgs.append("MEDIA PLAY/PAUSE")
            print("[ACTION] MEDIA PLAY/PAUSE")

        self._prev_active_gestures = active_gestures
        return state_msgs
