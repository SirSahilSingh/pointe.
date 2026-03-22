"""
TelemetryOverlay — Real-time debug overlay and motion visualizer for Pointe.

Shows internal motion-engine signals on a transparent tkinter window:
  • Raw / filtered yaw & pitch
  • Velocity X / Y
  • Dead-zone active indicator
  • FPS & dt
  • Direction arrow, dead-zone circle, velocity bar

Designed to be zero-cost when disabled (all methods short-circuit).
"""

import tkinter as tk
import math
import time

_HAS_WIN32 = False
try:
    import win32gui
    import win32con
    _HAS_WIN32 = True
except ImportError:
    pass


class TelemetryOverlay:
    """Lightweight debug overlay rendered on a tkinter Toplevel window."""

    # Layout
    OVERLAY_W = 320
    OVERLAY_H = 380
    MARGIN = 12
    CANVAS_SIZE = 120   # motion visualizer square
    BAR_W = 200
    BAR_H = 14

    # Colors
    BG = "#0d0d0f"
    TEXT = "#c8c8cc"
    ACCENT = "#4ade80"
    DIM = "#555560"
    WARN = "#f87171"
    BAR_BG = "#1e1e24"
    BAR_FG = "#6366f1"
    ARROW_COLOR = "#38bdf8"
    DZ_CIRCLE_COLOR = "#facc15"

    def __init__(self, hud_root):
        """
        Args:
            hud_root: The existing tk.Tk() root from FloatingHUD so we
                      share one mainloop.
        """
        self.enabled = False
        self._root = hud_root

        # --- Toplevel window ---
        self._win = tk.Toplevel(self._root)
        self._win.title("PointeTelemetry")
        self._win.overrideredirect(True)
        self._win.wm_attributes("-topmost", True)
        self._win.wm_attributes("-alpha", 0.88)
        self._win.config(bg=self.BG)

        # Place bottom-left corner of screen
        screen_w = self._root.winfo_screenwidth()
        screen_h = self._root.winfo_screenheight()
        x = 16
        y = screen_h - self.OVERLAY_H - 60
        self._win.geometry(f"{self.OVERLAY_W}x{self.OVERLAY_H}+{x}+{y}")

        # Make click-through on Windows
        self._win.update()
        try:
            hwnd = win32gui.FindWindow(None, "PointeTelemetry")
            ex = win32gui.GetWindowLong(hwnd, win32con.GWL_EXSTYLE)
            win32gui.SetWindowLong(hwnd, win32con.GWL_EXSTYLE,
                                   ex | win32con.WS_EX_LAYERED | win32con.WS_EX_TRANSPARENT)
        except Exception:
            pass

        # Build UI
        self._build_ui()

        # Start hidden
        self._win.withdraw()

        # --- Internal state ---
        self._last_render = 0.0
        self._fps_hist = []
        self._fps_val = 0.0

    # ==================================================================
    # UI construction
    # ==================================================================
    def _build_ui(self):
        pad = self.MARGIN

        # Title bar
        tk.Label(self._win, text="🛠 DEBUG TELEMETRY", font=("Consolas", 10, "bold"),
                 fg=self.ACCENT, bg=self.BG, anchor="w").pack(
            padx=pad, pady=(pad, 2), anchor="w")

        sep = tk.Frame(self._win, bg=self.DIM, height=1)
        sep.pack(fill="x", padx=pad)

        # --- Text readouts ---
        self._labels = {}
        fields = [
            ("raw_yaw",       "Raw Yaw"),
            ("raw_pitch",     "Raw Pitch"),
            ("filt_yaw",      "Filt Yaw"),
            ("filt_pitch",    "Filt Pitch"),
            ("vel_x",         "Vel X"),
            ("vel_y",         "Vel Y"),
            ("dead_zone",     "Dead Zone"),
            ("fps",           "FPS"),
            ("dt",            "dt (ms)"),
        ]
        for key, label_text in fields:
            row = tk.Frame(self._win, bg=self.BG)
            row.pack(fill="x", padx=pad, pady=1)
            tk.Label(row, text=f"{label_text}:", font=("Consolas", 9),
                     fg=self.DIM, bg=self.BG, width=12, anchor="w").pack(side="left")
            val_label = tk.Label(row, text="—", font=("Consolas", 9, "bold"),
                                 fg=self.TEXT, bg=self.BG, anchor="e")
            val_label.pack(side="right")
            self._labels[key] = val_label

        sep2 = tk.Frame(self._win, bg=self.DIM, height=1)
        sep2.pack(fill="x", padx=pad, pady=(4, 2))

        # --- Motion Visualizer ---
        viz_frame = tk.Frame(self._win, bg=self.BG)
        viz_frame.pack(padx=pad, pady=4, anchor="w")

        # Canvas for direction arrow + dead-zone circle
        self._canvas = tk.Canvas(viz_frame, width=self.CANVAS_SIZE,
                                  height=self.CANVAS_SIZE,
                                  bg="#111116", highlightthickness=1,
                                  highlightbackground=self.DIM)
        self._canvas.pack(side="left", padx=(0, 8))

        # Velocity bar on the right
        bar_frame = tk.Frame(viz_frame, bg=self.BG)
        bar_frame.pack(side="left", anchor="n", pady=4)
        tk.Label(bar_frame, text="Velocity", font=("Consolas", 8),
                 fg=self.DIM, bg=self.BG).pack(anchor="w")
        self._bar_canvas = tk.Canvas(bar_frame, width=self.BAR_W,
                                      height=self.BAR_H,
                                      bg=self.BAR_BG, highlightthickness=0)
        self._bar_canvas.pack(pady=2)
        self._bar_fill = self._bar_canvas.create_rectangle(
            0, 0, 0, self.BAR_H, fill=self.BAR_FG, outline="")

        self._vel_label = tk.Label(bar_frame, text="0 px/s", font=("Consolas", 8, "bold"),
                                    fg=self.TEXT, bg=self.BG)
        self._vel_label.pack(anchor="w")

    # ==================================================================
    # Public API
    # ==================================================================
    def toggle(self):
        """Flip debug overlay on/off."""
        self.enabled = not self.enabled
        if self.enabled:
            self._win.deiconify()
            print("[TELEMETRY] Debug overlay ON")
        else:
            self._win.withdraw()
            print("[TELEMETRY] Debug overlay OFF")

    def update(self, raw_yaw, raw_pitch, filtered_yaw, filtered_pitch,
               velocity_x, velocity_y, dead_zone_active, dt, zoom_factor):
        """Feed latest frame data. No-op when disabled."""
        if not self.enabled:
            return

        # FPS calculation (rolling average over 30 frames)
        now = time.perf_counter()
        self._fps_hist.append(now)
        # Keep last 30 timestamps
        if len(self._fps_hist) > 30:
            self._fps_hist = self._fps_hist[-30:]
        if len(self._fps_hist) >= 2:
            span = self._fps_hist[-1] - self._fps_hist[0]
            self._fps_val = (len(self._fps_hist) - 1) / max(span, 1e-6)
        else:
            self._fps_val = 0.0

        # Update labels
        self._labels["raw_yaw"].config(text=f"{raw_yaw:+.5f}")
        self._labels["raw_pitch"].config(text=f"{raw_pitch:+.5f}")
        self._labels["filt_yaw"].config(text=f"{filtered_yaw:+.5f}")
        self._labels["filt_pitch"].config(text=f"{filtered_pitch:+.5f}")
        self._labels["vel_x"].config(text=f"{velocity_x:+.1f}")
        self._labels["vel_y"].config(text=f"{velocity_y:+.1f}")

        dz_text = "● ACTIVE" if dead_zone_active else "○ moving"
        dz_color = self.ACCENT if dead_zone_active else self.WARN
        self._labels["dead_zone"].config(text=dz_text, fg=dz_color)

        self._labels["fps"].config(text=f"{self._fps_val:.1f}")
        self._labels["dt"].config(text=f"{dt * 1000:.2f}")

        # --- Motion Visualizer ---
        self._draw_visualizer(filtered_yaw, filtered_pitch,
                              velocity_x, velocity_y, dead_zone_active)

    def render(self):
        """Kept as a separate call for future use; currently no-op
        since tkinter updates via the shared mainloop."""
        pass

    # ==================================================================
    # Motion Visualizer Drawing
    # ==================================================================
    def _draw_visualizer(self, filt_yaw, filt_pitch, vx, vy, dz_active):
        c = self._canvas
        c.delete("all")

        cx = self.CANVAS_SIZE // 2
        cy = self.CANVAS_SIZE // 2

        # Dead-zone circle (radius proportional to dead_zone setting)
        # Scale: 0.02 dead_zone → ~15px radius, up to 0.10 → ~40px
        # We read dead_zone from settings if available
        try:
            import settings
            dz_val = getattr(settings, 'MOTION_ENGINE', {}).get('dead_zone', 0.02)
        except Exception:
            dz_val = 0.02
        dz_r = max(10, min(int(dz_val * 600), 50))
        c.create_oval(cx - dz_r, cy - dz_r, cx + dz_r, cy + dz_r,
                      outline=self.DZ_CIRCLE_COLOR, width=1, dash=(3, 3))

        # Tilt dot — position shows current filtered yaw/pitch
        # Scale: ±0.15 maps to ±50px
        scale = 50.0 / 0.15
        dot_x = cx + filt_yaw * scale
        dot_y = cy + filt_pitch * scale
        # Clamp inside canvas
        dot_x = max(6, min(self.CANVAS_SIZE - 6, dot_x))
        dot_y = max(6, min(self.CANVAS_SIZE - 6, dot_y))
        dot_r = 4
        dot_color = self.ACCENT if dz_active else self.WARN
        c.create_oval(dot_x - dot_r, dot_y - dot_r,
                      dot_x + dot_r, dot_y + dot_r,
                      fill=dot_color, outline="")

        # Direction arrow from center
        mag = math.sqrt(filt_yaw ** 2 + filt_pitch ** 2)
        if mag > 0.005:
            angle = math.atan2(filt_pitch, filt_yaw)
            arrow_len = min(mag * scale, 50)
            ax = cx + arrow_len * math.cos(angle)
            ay = cy + arrow_len * math.sin(angle)
            c.create_line(cx, cy, ax, ay, fill=self.ARROW_COLOR,
                          width=2, arrow="last", arrowshape=(8, 10, 4))

        # Center cross
        c.create_line(cx - 4, cy, cx + 4, cy, fill=self.DIM)
        c.create_line(cx, cy - 4, cx, cy + 4, fill=self.DIM)

        # --- Velocity bar ---
        vel_mag = math.sqrt(vx ** 2 + vy ** 2)
        max_vis_vel = 1200.0  # pixels/sec for full bar
        fill_frac = min(vel_mag / max_vis_vel, 1.0)
        bar_px = int(fill_frac * self.BAR_W)
        self._bar_canvas.coords(self._bar_fill, 0, 0, bar_px, self.BAR_H)
        self._vel_label.config(text=f"{vel_mag:.0f} px/s")
