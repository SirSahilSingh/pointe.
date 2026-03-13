import tkinter as tk
import win32gui
import win32con
import time


class FloatingHUD:
    """
    Dynamic Island-style floating HUD.
    
    Collapsed: small pill (180×36px) showing status dot
    Expanded:  grows to ~420×48px showing message text
    Smooth animation between states via geometry interpolation.
    """

    COLLAPSED_W = 180
    COLLAPSED_H = 36
    EXPANDED_W = 420
    EXPANDED_H = 48

    BG_COLOR = '#111113'
    TEXT_COLOR = '#e5e5e5'
    GLOW_COLOR = '#1a1a1d'
    ACCENT_GREEN = '#4ade80'

    ANIM_STEPS = 8
    ANIM_DELAY_MS = 16  # ~60fps

    def __init__(self):
        self.root = tk.Tk()
        self.root.title("GhostHUD")
        self.root.overrideredirect(True)
        self.root.wm_attributes("-topmost", True)
        self.root.wm_attributes("-transparentcolor", "black")
        self.root.config(bg='black')

        self.screen_w = self.root.winfo_screenwidth()
        self.screen_h = self.root.winfo_screenheight()

        # Start collapsed
        self.current_w = self.COLLAPSED_W
        self.current_h = self.COLLAPSED_H
        self.target_w = self.COLLAPSED_W
        self.target_h = self.COLLAPSED_H
        self.is_expanded = False

        x = (self.screen_w // 2) - (self.current_w // 2)
        y = 18  # Near top of screen, like Dynamic Island
        self.root.geometry(f"{self.current_w}x{self.current_h}+{x}+{y}")

        # ─── Pill frame ───
        self.pill = tk.Frame(self.root, bg=self.BG_COLOR, highlightbackground='#2a2a2d',
                             highlightthickness=1, bd=0)
        self.pill.place(relx=0.5, rely=0.5, anchor='center',
                        width=self.current_w - 4, height=self.current_h - 4)

        # Status dot (always visible in collapsed state)
        self.dot = tk.Canvas(self.pill, width=8, height=8, bg=self.BG_COLOR,
                             highlightthickness=0)
        self.dot.create_oval(1, 1, 7, 7, fill=self.ACCENT_GREEN, outline='')
        self.dot.place(relx=0.5, rely=0.5, anchor='center')

        # Text label (visible in expanded state)
        self.label = tk.Label(self.pill, text="", font=("Inter", 11, "bold"),
                              fg=self.TEXT_COLOR, bg=self.BG_COLOR)
        self.label.place_forget()  # Hidden initially

        self.root.update()

        # Make click-through
        hwnd = win32gui.FindWindow(None, "GhostHUD")
        ex_style = win32gui.GetWindowLong(hwnd, win32con.GWL_EXSTYLE)
        win32gui.SetWindowLong(hwnd, win32con.GWL_EXSTYLE,
                               ex_style | win32con.WS_EX_LAYERED | win32con.WS_EX_TRANSPARENT)

        self.clear_timer = 0
        self._anim_step = 0
        self._anim_id = None
        self._last_msg_time = 0

    def _ease_out_cubic(self, t):
        """Cubic ease-out for smooth deceleration."""
        return 1 - (1 - t) ** 3

    def _animate_to(self, target_w, target_h, on_complete=None):
        """Smooth geometry animation from current to target size."""
        start_w = self.current_w
        start_h = self.current_h
        step = [0]

        def tick():
            try:
                step[0] += 1
                t = min(step[0] / self.ANIM_STEPS, 1.0)
                ease_t = self._ease_out_cubic(t)

                self.current_w = int(start_w + (target_w - start_w) * ease_t)
                self.current_h = int(start_h + (target_h - start_h) * ease_t)

                x = (self.screen_w // 2) - (self.current_w // 2)
                y = 18
                self.root.geometry(f"{self.current_w}x{self.current_h}+{x}+{y}")
                self.pill.place_configure(width=self.current_w - 4, height=self.current_h - 4)

                if t < 1.0:
                    self._anim_id = self.root.after(self.ANIM_DELAY_MS, tick)
                else:
                    self._anim_id = None
                    if on_complete:
                        on_complete()
            except Exception:
                self._anim_id = None

        # Cancel any in-progress animation
        if self._anim_id:
            try:
                self.root.after_cancel(self._anim_id)
            except Exception:
                pass
        tick()

    def _expand(self, msg):
        """Expand the pill and show message."""
        def on_done():
            self.is_expanded = True
            self.dot.place_forget()
            self.label.config(text=f"  {msg}  ")
            self.label.place(relx=0.5, rely=0.5, anchor='center')

        self._animate_to(self.EXPANDED_W, self.EXPANDED_H, on_done)

    def _collapse(self):
        """Collapse to pill and show dot."""
        self.label.place_forget()
        self.label.config(text="")

        def on_done():
            self.is_expanded = False
            self.dot.place(relx=0.5, rely=0.5, anchor='center')

        self._animate_to(self.COLLAPSED_W, self.COLLAPSED_H, on_done)

    def show_message(self, msg, duration_frames=30):
        """Displays a message: expands the island, auto-collapses after duration."""
        self._last_msg_time = time.time()
        self._expand(msg)
        self.clear_timer = duration_frames

    def update(self):
        """Must be called in the main engine loop to keep the UI alive."""
        try:
            if self.clear_timer > 0:
                self.clear_timer -= 1
                if self.clear_timer == 0 and self.is_expanded:
                    self._collapse()
            self.root.update()
        except Exception:
            pass