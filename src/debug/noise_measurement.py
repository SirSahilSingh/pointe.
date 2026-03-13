"""
NoiseMeasurement — Noise floor measurement tool for dead-zone calibration.

When activated, records raw yaw/pitch for 5 seconds while the user holds
their head still.  Computes mean, std-dev, max absolute deviation, and
outputs a recommended dead_zone = 3 × max_deviation.
"""

import time
import math
import os


class NoiseMeasurement:
    """Records head-tracking noise for 5 seconds and recommends a dead zone."""

    DURATION = 5.0  # seconds

    def __init__(self):
        self._active = False
        self._start_time = 0.0
        self._yaw_samples = []
        self._pitch_samples = []

    # ------------------------------------------------------------------
    @property
    def is_active(self):
        return self._active

    def start(self):
        """Begin a noise measurement session."""
        if self._active:
            return
        self._active = True
        self._start_time = time.perf_counter()
        self._yaw_samples = []
        self._pitch_samples = []
        print("\n" + "=" * 60)
        print("[NOISE MEASUREMENT] STARTED")
        print("  Hold your head perfectly still for 5 seconds...")
        print("=" * 60)

    def record(self, yaw, pitch):
        """Record one sample.  Auto-finishes after DURATION seconds."""
        if not self._active:
            return

        elapsed = time.perf_counter() - self._start_time
        if elapsed >= self.DURATION:
            self._finish()
            return

        self._yaw_samples.append(yaw)
        self._pitch_samples.append(pitch)

    # ------------------------------------------------------------------
    def _finish(self):
        """Compute statistics and print results."""
        self._active = False

        n = len(self._yaw_samples)
        if n < 10:
            print("[NOISE MEASUREMENT] Not enough samples collected. Try again.")
            return

        # --- Statistics ---
        mean_yaw = sum(self._yaw_samples) / n
        mean_pitch = sum(self._pitch_samples) / n

        var_yaw = sum((y - mean_yaw) ** 2 for y in self._yaw_samples) / n
        var_pitch = sum((p - mean_pitch) ** 2 for p in self._pitch_samples) / n
        std_yaw = math.sqrt(var_yaw)
        std_pitch = math.sqrt(var_pitch)

        max_dev_yaw = max(abs(y - mean_yaw) for y in self._yaw_samples)
        max_dev_pitch = max(abs(p - mean_pitch) for p in self._pitch_samples)

        max_dev = max(max_dev_yaw, max_dev_pitch)
        recommended_dz = 3.0 * max_dev

        print("\n" + "=" * 60)
        print(f"[NOISE MEASUREMENT] COMPLETE — {n} samples over {self.DURATION}s")
        print("-" * 60)
        print(f"  Yaw   →  mean: {mean_yaw:+.6f}   std: {std_yaw:.6f}   max_dev: {max_dev_yaw:.6f}")
        print(f"  Pitch →  mean: {mean_pitch:+.6f}   std: {std_pitch:.6f}   max_dev: {max_dev_pitch:.6f}")
        print("-" * 60)
        print(f"  ★ Recommended dead_zone = 3 × {max_dev:.6f} = {recommended_dz:.6f}")
        print("=" * 60 + "\n")

        # Optionally save to settings.py
        self._offer_save(recommended_dz)

    def _offer_save(self, recommended_dz):
        """Print the recommended value and how to apply it to settings.py."""
        try:
            settings_path = os.path.join(
                os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
                "settings.py",
            )
            with open(settings_path, "r", encoding="utf-8") as f:
                content = f.read()

            # Find and replace the dead_zone value in MOTION_ENGINE dict
            import re
            pattern = r'("dead_zone"\s*:\s*)([\d.]+)'
            match = re.search(pattern, content)
            if match:
                old_val = match.group(2)
                print(f"  → To apply, update settings.py: dead_zone {old_val} → {recommended_dz:.4f}")
                print(f"  → File: {settings_path}")
            else:
                print("  → Could not locate dead_zone in settings.py for auto-update.")
        except Exception as e:
            print(f"  → Could not read settings.py: {e}")
