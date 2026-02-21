import tkinter as tk
import win32gui
import win32con


class FloatingHUD:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("GhostHUD")
        self.root.overrideredirect(True)  # Strips window borders and title bar
        self.root.wm_attributes("-topmost", True)  # Forces it to float above all other apps
        self.root.wm_attributes("-transparentcolor", "black")  # Makes black background invisible
        self.root.config(bg='black')

        # Position at the bottom-center of the primary monitor
        screen_width = self.root.winfo_screenwidth()
        screen_height = self.root.winfo_screenheight()
        window_width = 400
        x = (screen_width // 2) - (window_width // 2)
        y = screen_height - 150  # 150px above the bottom of the screen

        self.root.geometry(f"{window_width}x60+{x}+{y}")

        # The glowing text
        self.label = tk.Label(self.root, text="", font=("Inter", 14, "bold"), fg="#10b981", bg="black")
        self.label.pack(expand=True, fill="both")

        self.root.update()  # Force Windows to draw it before we modify the OS hooks

        # 🔥 MAGIC: Tell Windows to make this window "Click-Through"
        hwnd = win32gui.FindWindow(None, "GhostHUD")
        ex_style = win32gui.GetWindowLong(hwnd, win32con.GWL_EXSTYLE)
        win32gui.SetWindowLong(hwnd, win32con.GWL_EXSTYLE,
                               ex_style | win32con.WS_EX_LAYERED | win32con.WS_EX_TRANSPARENT)

        self.clear_timer = 0

    def show_message(self, msg, duration_frames=30):
        """Displays a message and sets a timer to clear it."""
        self.label.config(text=f"» {msg} «")
        self.clear_timer = duration_frames

    def update(self):
        """Must be called in the main engine loop to keep the UI alive."""
        if self.clear_timer > 0:
            self.clear_timer -= 1
            if self.clear_timer == 0:
                self.label.config(text="")  # Clear text when timer hits 0
        self.root.update()