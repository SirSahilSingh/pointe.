import os
import sys
import types
import unittest


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)


pyautogui_stub = types.ModuleType("pyautogui")
pyautogui_stub.FAILSAFE = False
pyautogui_stub.PAUSE = 0
pyautogui_stub.size = lambda: (1920, 1080)
pyautogui_stub.hotkey = lambda *args, **kwargs: None
pyautogui_stub.press = lambda *args, **kwargs: None
pyautogui_stub.mouseDown = lambda *args, **kwargs: None
pyautogui_stub.mouseUp = lambda *args, **kwargs: None
pyautogui_stub.click = lambda *args, **kwargs: None
pyautogui_stub.doubleClick = lambda *args, **kwargs: None
pyautogui_stub.scroll = lambda *args, **kwargs: None

numpy_stub = types.ModuleType("numpy")
numpy_stub.sign = lambda value: (value > 0) - (value < 0)

sys.modules.setdefault("pyautogui", pyautogui_stub)
sys.modules.setdefault("numpy", numpy_stub)

from src.controllers.mouse import MouseController


class HandSwapStateTests(unittest.TestCase):
    def setUp(self):
        self.controller = MouseController()

    def feed(self, samples):
        events = []
        for sample in samples:
            event = self.controller._advance_hand_swap_state(
                rel_x=sample.get("rel_x"),
                rel_y=sample.get("rel_y", 0.0),
                palm_active=sample.get("palm", True),
                hand_visible=sample.get("visible", True),
                now=sample["t"],
            )
            if event:
                events.append(event)
        return events

    def test_left_to_right_swipe_triggers_window_next(self):
        events = self.feed([
            {"t": 1.00, "rel_x": -0.56},
            {"t": 1.06, "rel_x": -0.56},
            {"t": 1.12, "rel_x": -0.56},
            {"t": 1.18, "rel_x": -0.34},
            {"t": 1.24, "rel_x": 0.02},
            {"t": 1.30, "rel_x": 0.18},
        ])
        self.assertEqual(events, ["WINDOW_NEXT"])

    def test_right_to_left_swipe_triggers_window_prev(self):
        events = self.feed([
            {"t": 1.00, "rel_x": 0.56},
            {"t": 1.06, "rel_x": 0.56},
            {"t": 1.12, "rel_x": 0.56},
            {"t": 1.18, "rel_x": 0.34},
            {"t": 1.24, "rel_x": -0.02},
            {"t": 1.30, "rel_x": -0.18},
        ])
        self.assertEqual(events, ["WINDOW_PREV"])

    def test_return_path_is_ignored_and_rearm_allows_repeat(self):
        events = self.feed([
            {"t": 1.00, "rel_x": -0.56},
            {"t": 1.06, "rel_x": -0.56},
            {"t": 1.12, "rel_x": -0.56},
            {"t": 1.18, "rel_x": -0.34},
            {"t": 1.24, "rel_x": 0.02},
            {"t": 1.30, "rel_x": 0.18},
            {"t": 1.36, "rel_x": 0.04},
            {"t": 1.42, "rel_x": -0.18},
            {"t": 1.48, "rel_x": -0.44},
            {"t": 1.60, "rel_x": -0.56},
            {"t": 1.72, "rel_x": -0.56},
            {"t": 1.78, "rel_x": -0.56},
            {"t": 1.84, "rel_x": -0.30},
            {"t": 1.90, "rel_x": 0.04},
            {"t": 1.96, "rel_x": 0.22},
        ])
        self.assertEqual(events, ["WINDOW_NEXT", "WINDOW_NEXT"])

    def test_noise_and_partial_occlusion_do_not_trigger(self):
        events = self.feed([
            {"t": 1.00, "rel_x": -0.48},
            {"t": 1.06, "rel_x": -0.48},
            {"t": 1.12, "rel_x": -0.48},
            {"t": 1.18, "rel_x": -0.38},
            {"t": 1.24, "rel_x": -0.30},
            {"t": 1.30, "rel_x": -0.24},
            {"t": 1.36, "rel_x": None, "visible": False},
            {"t": 1.42, "rel_x": None, "visible": False},
            {"t": 1.48, "rel_x": -0.20, "palm": False},
        ])
        self.assertEqual(events, [])


if __name__ == "__main__":
    unittest.main()
