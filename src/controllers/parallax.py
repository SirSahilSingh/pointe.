class ParallaxController:

    def __init__(self, sensitivity_x=3.0, sensitivity_y=3.0):

        self.neutral_x = 0.0
        self.neutral_y = 0.0
        self.neutral_z_width = 1.0

        self.is_calibrated = False

        self.sensitivity_x = sensitivity_x
        self.sensitivity_y = sensitivity_y

    def calibrate(self, nose_x, nose_y, face_width):

        self.neutral_x = nose_x
        self.neutral_y = nose_y

        # 🔥 SAFETY NET: In normalized space, face width is tiny (e.g., 0.15).
        # We enforce a minimum of 0.001 so it never accidentally divides by zero.
        self.neutral_z_width = max(face_width, 0.001)

        self.is_calibrated = True

        print("[CALIBRATED]")

    def get_shift(self, nose_x, nose_y):

        if not self.is_calibrated:
            return 0.0, 0.0

        dx = nose_x - self.neutral_x
        dy = nose_y - self.neutral_y

        shift_x = -(dx * self.sensitivity_x)
        shift_y = dy * self.sensitivity_y

        # 🔥 FIXED: Returns pure floating-point decimals now. No int() casting!
        return float(shift_x), float(shift_y)

    def get_zoom(self, current_width):

        if not self.is_calibrated or self.neutral_z_width <= 0:
            return 1.0

        zoom = current_width / self.neutral_z_width

        return max(0.5, min(zoom, 3.0))