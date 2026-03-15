import sys
import multiprocessing
import time
from PyQt6.QtWidgets import QApplication, QLabel, QWidget, QFrame
from PyQt6.QtCore import Qt, QPropertyAnimation, QRect, QTimer, QSize, QPoint, QEasingCurve
from PyQt6.QtGui import QColor, QFont, QPalette


class DynamicIslandWorker(QWidget):
    """
    PyQt6 implementation of the Dynamic Island HUD.
    Runs entirely in its own process, hardware accelerated.
    """
    COLLAPSED_W = 180
    COLLAPSED_H = 36
    EXPANDED_W = 420
    EXPANDED_H = 48
    
    def __init__(self, command_queue):
        super().__init__()
        self.command_queue = command_queue
        self.initUI()
        
        # Check for commands from main process every 16ms (~60fps polling)
        self.timer = QTimer(self)
        self.timer.timeout.connect(self.check_queue)
        self.timer.start(16)
        
        self.clear_timer = QTimer(self)
        self.clear_timer.setSingleShot(True)
        self.clear_timer.timeout.connect(self.collapse)
        
    def initUI(self):
        # Translucent, click-through, frameless window
        self.setWindowFlags(Qt.WindowType.FramelessWindowHint | 
                            Qt.WindowType.WindowStaysOnTopHint |
                            Qt.WindowType.Tool |
                            Qt.WindowType.WindowTransparentForInput)
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground)
        
        screen = QApplication.primaryScreen().geometry()
        self.screen_w = screen.width()
        
        # Start collapsed
        x = (self.screen_w - self.COLLAPSED_W) // 2
        y = 18
        self.setGeometry(x, y, self.COLLAPSED_W, self.COLLAPSED_H)
        
        # The main pill background
        self.pill = QFrame(self)
        self.pill.setStyleSheet("""
            QFrame {
                background-color: #111113;
                border: 1px solid #2a2a2d;
                border-radius: 18px;
            }
        """)
        self.pill.setGeometry(0, 0, self.COLLAPSED_W, self.COLLAPSED_H)
        
        # Status Dot (Green)
        self.dot = QWidget(self.pill)
        self.dot.setStyleSheet("""
            QWidget {
                background-color: #4ade80;
                border-radius: 4px;
            }
        """)
        self.dot.setGeometry((self.COLLAPSED_W - 8) // 2, (self.COLLAPSED_H - 8) // 2, 8, 8)
        
        # Text Label
        self.label = QLabel("", self.pill)
        self.label.setFont(QFont("Inter", 11, QFont.Weight.Bold))
        self.label.setStyleSheet("color: #e5e5e5; background: transparent;")
        self.label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.label.hide()
        
        # Setup Animation
        self.anim = QPropertyAnimation(self, b"geometry")
        self.anim.setDuration(400) # 400ms smooth animation
        self.anim.setEasingCurve(QEasingCurve.Type.OutCubic)
        self.anim.valueChanged.connect(self._on_anim_step)
        
        self.is_expanded = False
        
    def _on_anim_step(self, rect):
        # Keep the pill frame sizing perfectly with the window
        self.pill.setGeometry(0, 0, rect.width(), rect.height())
        
        # Keep items centered during animation
        if self.is_expanded:
            self.label.setGeometry(0, 0, rect.width(), rect.height())
        else:
            self.dot.setGeometry((rect.width() - 8) // 2, (rect.height() - 8) // 2, 8, 8)
            
    def expand(self, text):
        self.is_expanded = True
        self.dot.hide()
        self.label.setText(text)
        self.label.show()
        
        start_rect = self.geometry()
        end_x = (self.screen_w - self.EXPANDED_W) // 2
        end_rect = QRect(end_x, 18, self.EXPANDED_W, self.EXPANDED_H)
        
        self.anim.stop()
        self.anim.setStartValue(start_rect)
        self.anim.setEndValue(end_rect)
        self.anim.start()
        
    def collapse(self):
        self.is_expanded = False
        self.label.hide()
        self.dot.show()
        
        start_rect = self.geometry()
        end_x = (self.screen_w - self.COLLAPSED_W) // 2
        end_rect = QRect(end_x, 18, self.COLLAPSED_W, self.COLLAPSED_H)
        
        self.anim.stop()
        self.anim.setStartValue(start_rect)
        self.anim.setEndValue(end_rect)
        self.anim.start()

    def check_queue(self):
        try:
            while not self.command_queue.empty():
                cmd = self.command_queue.get_nowait()
                if cmd['type'] == 'show_message':
                    self.expand(cmd['msg'])
                    duration = cmd.get('duration_ms', 1000)
                    self.clear_timer.start(duration)
                elif cmd['type'] == 'quit':
                    QApplication.quit()
        except:
            pass


def _run_pyqt_app(command_queue):
    """Entry point for the separate process"""
    import multiprocessing
    multiprocessing.freeze_support()
    app = QApplication([])  # Empty argv for child process
    window = DynamicIslandWorker(command_queue)
    window.show()
    sys.exit(app.exec())


class FloatingHUD:
    """
    Main-thread proxy object. 
    Drop-in replacement for the old Tkinter FloatingHUD.
    It spins up PyQt6 in a completely separate processing core.
    """
    def __init__(self):
        self.queue = multiprocessing.Queue()
        self.process = multiprocessing.Process(target=_run_pyqt_app, args=(self.queue,), daemon=True)
        self.process.start()

    def show_message(self, msg, duration_frames=30):
        """Send message to PyQt process. duration_frames assumes ~60fps logic (1 frame ~ 16ms)"""
        try:
            self.queue.put_nowait({
                'type': 'show_message',
                'msg': msg,
                'duration_ms': int(duration_frames * 16.66)
            })
        except:
            pass

    def update(self):
        """Tkinter needed this. PyQt6 is isolated, so this is just a stub to prevent crashes."""
        pass
        
    def close(self):
        try:
            self.queue.put_nowait({'type': 'quit'})
            self.process.join(timeout=1.0)
        except:
            pass