"""
MotionEngine — Velocity/Joystick model for head-tracking cursor control.

This is a fundamentally different approach from absolute position mapping:

  ABSOLUTE (old, floaty):
    head position → screen position → cursor chases target → feels floaty

  VELOCITY/JOYSTICK (new, like Smyle Mouse):
    head tilt from neutral → cursor SPEED
    neutral head = zero velocity = cursor STOPS wherever it is
    tilt head right = cursor moves right continuously
    more tilt = faster movement
    return to neutral = cursor stops instantly

This eliminates the floating/chasing feel entirely because there is no
"target position" the cursor is trying to reach. The cursor simply moves
at a speed proportional to your head tilt, and stops when you stop tilting.

Pipeline:
    raw yaw/pitch delta → pre-filter (heavy EMA) → dead zone
    → speed curve (tilt^exp × max_speed) → dt scaling
    → 1-Euro filter on velocity → pixel delta output
"""

import time
import math
import settings


# ─── 1-Euro Filter ────────────────────────────────────────────────────────────

class OneEuroFilter:
    """Speed-adaptive low-pass filter (Casiez et al. 2012)."""

    def __init__(self, t0, x0, min_cutoff=1.0, beta=0.5, d_cutoff=1.0):
        self.min_cutoff = min_cutoff
        self.beta = beta
        self.d_cutoff = d_cutoff
        self._x_prev = x0
        self._dx_prev = 0.0
        self._t_prev = t0

    @staticmethod
    def _alpha(te, cutoff):
        r = 2 * math.pi * cutoff * te
        return r / (r + 1.0)

    def __call__(self, t, x):
        te = t - self._t_prev
        if te <= 0:
            te = 1e-6

        a_d = self._alpha(te, self.d_cutoff)
        dx = (x - self._x_prev) / te
        dx_hat = a_d * dx + (1 - a_d) * self._dx_prev

        cutoff = self.min_cutoff + self.beta * abs(dx_hat)
        a = self._alpha(te, cutoff)
        x_hat = a * x + (1 - a) * self._x_prev

        self._x_prev = x_hat
        self._dx_prev = dx_hat
        self._t_prev = t
        return x_hat


# ─── MotionEngine (Velocity/Joystick Model) ──────────────────────────────────

class MotionEngine:
    """Maps head tilt (yaw/pitch delta from neutral) to cursor VELOCITY.

    Cursor control model:
      - Dead zone: small tilts produce zero velocity
      - Quadratic speed curve: precision at small tilts, speed at large
      - Velocity damping: cursor decelerates fast when head returns to center
      - Screen edge protection: velocity resets at screen boundaries

    Output: (dx_pixels, dy_pixels) per frame — pixel deltas to add to cursor pos.
    """

    def __init__(self):
        # Screen dimensions for edge protection and scaling
        import pyautogui
        self._screen_w, self._screen_h = pyautogui.size()
        # Track cursor position for edge detection
        self._cursor_x = self._screen_w / 2.0
        self._cursor_y = self._screen_h / 2.0

        # --- State ---
        now = time.perf_counter()
        self._last_time = now

        # Pre-filter state
        self._raw_x = 0.0
        self._raw_y = 0.0
        self._first_frame = True

        # Current velocity (persisted for damping)
        self._vx = 0.0
        self._vy = 0.0

        # 1-Euro filters are configured below from the active source profile.
        self._euro_vx = None
        self._euro_vy = None

        # Sensitivity
        self._sens_x = getattr(settings, 'SENSITIVITY_X', 2.5)
        self._sens_y = getattr(settings, 'SENSITIVITY_Y', 2.5)

        # --- Telemetry state (read-only, does not affect output) ---
        self._last_vx = 0.0
        self._last_vy = 0.0
        self._last_dt = 0.0
        self._last_dead_zone_x = True
        self._last_dead_zone_y = True

        self._min_cutoff = 1.5
        self._beta = 0.3
        self._d_cutoff = 1.0

        self.configure(getattr(settings, 'MOTION_ENGINE', {}), reset_state=True)

    def configure(self, cfg, reset_state=True):
        """Apply a full runtime config, optionally resetting filter state."""
        # Pre-filter: heavy EMA on raw yaw/pitch to kill noise
        self.raw_smooth = cfg.get('raw_smooth', 0.08)

        # Dead zone: tilt below this produces zero velocity
        self.dead_zone = cfg.get('dead_zone', 0.08)

        # Maximum tilt range (normalized, beyond dead zone)
        self.max_tilt = cfg.get('max_tilt', 0.35)

        # Maximum cursor speed in pixels/second
        self.max_speed = cfg.get('max_speed', 900)

        # Damping factor: how quickly velocity decays when returning to center
        self.damping = cfg.get('damping', 0.15)

        # 1-Euro filter settings must track the active source config too.
        self._min_cutoff = cfg.get('one_euro_mincutoff', 1.5)
        self._beta = cfg.get('one_euro_beta', 0.3)
        self._d_cutoff = cfg.get('one_euro_dcutoff', 1.0)

        if reset_state:
            self.reset()

    def _quadratic_speed(self, tilt):
        """Quadratic velocity curve with dead zone.

        normalized = (|tilt| - dead_zone) / (max_tilt - dead_zone)
        speed = normalized² × max_speed
        Returns sign(tilt) × speed, or 0 if inside dead zone.
        """
        abs_tilt = abs(tilt)
        if abs_tilt < self.dead_zone:
            return 0.0

        # Normalize tilt to [0, 1] range beyond dead zone
        range_denom = self.max_tilt - self.dead_zone
        if range_denom <= 0:
            range_denom = 0.1
        normalized = (abs_tilt - self.dead_zone) / range_denom
        normalized = min(normalized, 1.0)  # clamp to 1.0

        # Quadratic curve: precision at small tilts, fast at large
        speed = normalized * normalized * self.max_speed

        # Apply sign of original tilt
        return math.copysign(speed, tilt)

    def update(self, raw_dx, raw_dy, invert_x, aspect_ratio, zoom):
        """Process one frame of head tracking data.

        Args:
            raw_dx: yaw delta from neutral (positive = looking right)
            raw_dy: pitch delta from neutral (positive = looking down)
            invert_x: +1 or -1 for camera mirror
            aspect_ratio: frame w/h (used for Y sensitivity correction)
            zoom: parallax zoom factor

        Returns:
            (dx_pixels, dy_pixels): pixel movement this frame
        """
        now = time.perf_counter()
        dt = now - self._last_time
        if dt <= 0:
            dt = 1 / 60.0
        # Cap dt to avoid huge jumps after pauses
        dt = min(dt, 0.1)
        self._last_time = now

        # Hot-reload sensitivity
        self._sens_x = getattr(settings, 'SENSITIVITY_X', 2.5)
        self._sens_y = getattr(settings, 'SENSITIVITY_Y', 2.5)

        # ① PRE-FILTER: heavy EMA to kill landmark noise
        if self._first_frame:
            self._raw_x = raw_dx
            self._raw_y = raw_dy
            self._first_frame = False
        else:
            self._raw_x += (raw_dx - self._raw_x) * self.raw_smooth
            self._raw_y += (raw_dy - self._raw_y) * self.raw_smooth

        # Apply inversion
        tilt_x = self._raw_x * invert_x
        tilt_y = self._raw_y

        # ② CALCULATE TRUE VECTOR MAGNITUDE AND DIRECTION
        tilt_magnitude = math.sqrt(tilt_x * tilt_x + tilt_y * tilt_y)
        in_dead_zone = tilt_magnitude < self.dead_zone
        
        if in_dead_zone:
            # Head near neutral: zero velocity on both axes
            self._vx = 0.0
            self._vy = 0.0
        else:
            # Normalize magnitude mapping to [0, 1] beyond dead zone
            range_denom = self.max_tilt - self.dead_zone
            if range_denom <= 0:
                range_denom = 0.1
            
            normalized_mag = (tilt_magnitude - self.dead_zone) / range_denom
            normalized_mag = min(normalized_mag, 1.0)
            
            # Quadratic curve: fine precision at small tilts, high speed at large tilts
            speed = normalized_mag * normalized_mag * self.max_speed
            
            # Project speed back onto X and Y axes using normalized direction vectors
            dir_x = tilt_x / tilt_magnitude
            dir_y = tilt_y / tilt_magnitude
            
            target_vx = dir_x * speed
            target_vy = dir_y * speed

            # ③ Apply sensitivity multipliers
            target_vx *= self._sens_x
            target_vy *= self._sens_y

            # ④ Zoom compensation (closer = slower for same tilt)
            zoom_factor = max(zoom, 0.5)
            target_vx /= zoom_factor
            target_vy /= zoom_factor

            self._vx = target_vx
            self._vy = target_vy

        # ⑥ Clamp velocity to max_speed
        self._vx = max(-self.max_speed, min(self.max_speed, self._vx))
        self._vy = max(-self.max_speed, min(self.max_speed, self._vy))

        # ⑦ 1-Euro filter for smoothing — but BYPASS when stopped
        if self._vx == 0.0 and self._vy == 0.0:
            vx_filtered = 0.0
            vy_filtered = 0.0
            # Reset filter state IN-PLACE (no object creation = no GC pressure)
            self._euro_vx._x_prev = 0.0
            self._euro_vx._dx_prev = 0.0
            self._euro_vx._t_prev = now
            self._euro_vy._x_prev = 0.0
            self._euro_vy._dx_prev = 0.0
            self._euro_vy._t_prev = now
        else:
            vx_filtered = self._euro_vx(now, self._vx)
            vy_filtered = self._euro_vy(now, self._vy)

        # ⑧ Convert to pixel delta this frame
        dx_pixels = vx_filtered * dt
        dy_pixels = vy_filtered * dt

        # Store for telemetry (does not change output)
        self._last_vx = vx_filtered
        self._last_vy = vy_filtered
        self._last_dt = dt
        self._last_dead_zone_x = in_dead_zone
        self._last_dead_zone_y = in_dead_zone

        return dx_pixels, dy_pixels

    def reset_velocity(self, reset_x=True, reset_y=True):
        """Instantly kill velocity on the specified axes (used for screen bounds)."""
        if reset_x:
            self._vx = 0.0
            self._euro_vx._x_prev = 0.0
            self._euro_vx._dx_prev = 0.0
            self._last_vx = 0.0
        if reset_y:
            self._vy = 0.0
            self._euro_vy._x_prev = 0.0
            self._euro_vy._dx_prev = 0.0
            self._last_vy = 0.0

    @property
    def debug_state(self):
        """Read-only snapshot of internal state for telemetry overlay."""
        return {
            'filtered_yaw': self._raw_x,
            'filtered_pitch': self._raw_y,
            'velocity_x': self._last_vx,
            'velocity_y': self._last_vy,
            'dt': self._last_dt,
            'dead_zone_active': self._last_dead_zone_x and self._last_dead_zone_y,
        }

    def reset(self):
        """Reset engine state (e.g. on recalibration)."""
        now = time.perf_counter()
        self._last_time = now
        self._raw_x = 0.0
        self._raw_y = 0.0
        self._first_frame = True
        self._vx = 0.0
        self._vy = 0.0
        self._cursor_x = self._screen_w / 2.0
        self._cursor_y = self._screen_h / 2.0

        self._euro_vx = OneEuroFilter(now, 0.0, self._min_cutoff, self._beta, self._d_cutoff)
        self._euro_vy = OneEuroFilter(now, 0.0, self._min_cutoff, self._beta, self._d_cutoff)

