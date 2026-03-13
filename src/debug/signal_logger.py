"""
SignalLogger — Per-frame CSV logging for telemetry analysis.

Writes motion-engine signals to a timestamped CSV file in the /logs directory.
Only active when debug mode is enabled. Buffered writes to minimise I/O cost.
"""

import csv
import os
import time
from datetime import datetime


class SignalLogger:
    """Records per-frame motion signals to CSV for offline analysis."""

    CSV_COLUMNS = [
        "timestamp",
        "yaw",
        "pitch",
        "filtered_yaw",
        "filtered_pitch",
        "velocity_x",
        "velocity_y",
        "dead_zone_triggered",
        "zoom_factor",
    ]

    FLUSH_INTERVAL = 60  # flush to disk every N frames

    def __init__(self, log_dir=None):
        # Default log directory: <project_root>/logs
        if log_dir is None:
            project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            log_dir = os.path.join(project_root, "logs")

        self._log_dir = log_dir
        self._file = None
        self._writer = None
        self._frame_count = 0
        self._active = False

    # ------------------------------------------------------------------
    def start(self):
        """Open a new CSV file and begin logging."""
        if self._active:
            return

        os.makedirs(self._log_dir, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filepath = os.path.join(self._log_dir, f"telemetry_{timestamp}.csv")

        self._file = open(filepath, "w", newline="", encoding="utf-8")
        self._writer = csv.writer(self._file)
        self._writer.writerow(self.CSV_COLUMNS)
        self._frame_count = 0
        self._active = True
        print(f"[TELEMETRY] CSV logging started → {filepath}")

    def stop(self):
        """Flush and close the current CSV file."""
        if not self._active:
            return
        try:
            self._file.flush()
            self._file.close()
        except Exception:
            pass
        self._file = None
        self._writer = None
        self._active = False
        print("[TELEMETRY] CSV logging stopped.")

    # ------------------------------------------------------------------
    def log_frame(self, yaw, pitch, filtered_yaw, filtered_pitch,
                  velocity_x, velocity_y, dead_zone_triggered, zoom_factor):
        """Write one row of telemetry data. No-op if not active."""
        if not self._active or self._writer is None:
            return

        self._writer.writerow([
            f"{time.perf_counter():.6f}",
            f"{yaw:.6f}",
            f"{pitch:.6f}",
            f"{filtered_yaw:.6f}",
            f"{filtered_pitch:.6f}",
            f"{velocity_x:.4f}",
            f"{velocity_y:.4f}",
            int(dead_zone_triggered),
            f"{zoom_factor:.4f}",
        ])

        self._frame_count += 1
        if self._frame_count % self.FLUSH_INTERVAL == 0:
            try:
                self._file.flush()
            except Exception:
                pass

    # ------------------------------------------------------------------
    @property
    def is_active(self):
        return self._active

    def close(self):
        """Alias for stop() — use at shutdown."""
        self.stop()
