"""Tests for the JSON config persistence layer in settings.py."""
import os
import sys
import json
import types
import shutil
import tempfile
import unittest


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)


class SettingsPersistenceTests(unittest.TestCase):
    """Test save_config() -> load_config() round-trip and holdDuration normalization."""

    def setUp(self):
        """Use a temp directory so tests never touch the real config."""
        self.tmp_dir = tempfile.mkdtemp()
        self.orig_dir = None
        self.orig_path = None

        # Patch settings module to use temp dir
        import settings
        self.orig_dir = settings.CONFIG_DIR
        self.orig_path = settings.CONFIG_PATH
        settings.CONFIG_DIR = self.tmp_dir
        settings.CONFIG_PATH = os.path.join(self.tmp_dir, "config.json")

    def tearDown(self):
        import settings
        settings.CONFIG_DIR = self.orig_dir
        settings.CONFIG_PATH = self.orig_path
        shutil.rmtree(self.tmp_dir, ignore_errors=True)

    def test_save_and_load_round_trip(self):
        """Config saved via save_config() should be loaded back by load_config()."""
        import settings

        test_config = {
            "SENSITIVITY_X": 3.5,
            "SENSITIVITY_Y": 4.0,
            "SMOOTHING": 0.08,
        }
        settings.save_config(test_config)
        self.assertTrue(os.path.exists(settings.CONFIG_PATH))

        # Reset attributes to defaults before loading
        settings.SENSITIVITY_X = 2.0
        settings.SENSITIVITY_Y = 6.5
        settings.SMOOTHING = 0.05

        settings.load_config()

        self.assertAlmostEqual(settings.SENSITIVITY_X, 3.5)
        self.assertAlmostEqual(settings.SENSITIVITY_Y, 4.0)
        self.assertAlmostEqual(settings.SMOOTHING, 0.08)

    def test_holdDuration_normalized_to_hold_duration(self):
        """JS-style holdDuration keys should be normalized to hold_duration."""
        import settings

        test_config = {
            "GESTURE_CALIBRATION": {
                "left_wink": {"threshold": 0.7, "holdDuration": 0.3},
                "right_wink": {"threshold": 0.6, "holdDuration": 0.25},
            }
        }
        settings.save_config(test_config)
        settings.load_config()

        cal = settings.GESTURE_CALIBRATION
        self.assertIn("left_wink", cal)
        self.assertIn("hold_duration", cal["left_wink"])
        self.assertNotIn("holdDuration", cal["left_wink"])
        self.assertAlmostEqual(cal["left_wink"]["hold_duration"], 0.3)
        self.assertAlmostEqual(cal["left_wink"]["threshold"], 0.7)

    def test_engine_sees_correct_calibration_shape(self):
        """After load_config(), GESTURE_CALIBRATION has hold_duration keys,
        not holdDuration — matching what mouse.py._get_hold_duration() expects."""
        import settings

        test_config = {
            "GESTURE_CALIBRATION": {
                "left_wink": {"threshold": 0.65, "holdDuration": 0.15},
                "pucker": {"threshold": 0.85, "hold_duration": 0.20},
                "jaw_drop": {"threshold": 0.25, "holdDuration": 0.20},
            }
        }
        settings.save_config(test_config)
        settings.load_config()

        for gesture, vals in settings.GESTURE_CALIBRATION.items():
            self.assertIn("hold_duration", vals,
                          f"{gesture} missing 'hold_duration' key")
            self.assertIn("threshold", vals,
                          f"{gesture} missing 'threshold' key")
            self.assertNotIn("holdDuration", vals,
                             f"{gesture} still has JS-style 'holdDuration' key")

    def test_whitelist_prevents_arbitrary_attribute(self):
        """Non-whitelisted keys in JSON should not patch module attributes."""
        import settings

        test_config = {
            "SENSITIVITY_X": 5.0,
            "__SECRET__": "should_not_appear",
            "EVIL_INJECTION": True,
        }
        settings.save_config(test_config)
        settings.load_config()

        self.assertAlmostEqual(settings.SENSITIVITY_X, 5.0)
        self.assertFalse(hasattr(settings, "__SECRET__"))
        self.assertFalse(hasattr(settings, "EVIL_INJECTION"))

    def test_missing_config_file_is_silent(self):
        """load_config() should not crash if config file doesn't exist."""
        import settings
        # ensure file doesn't exist
        if os.path.exists(settings.CONFIG_PATH):
            os.remove(settings.CONFIG_PATH)

        # Should not raise
        settings.load_config()

    def test_malformed_json_is_silent(self):
        """load_config() should not crash on malformed JSON."""
        import settings
        os.makedirs(settings.CONFIG_DIR, exist_ok=True)
        with open(settings.CONFIG_PATH, "w") as f:
            f.write("{invalid json!!! }")

        # Should not raise
        settings.load_config()
    def test_type_validation_rejects_wrong_types(self):
        """Values with wrong types should be silently rejected."""
        import settings

        # Save config with wrong types: string where float expected, int where bool expected
        test_config = {
            "SENSITIVITY_X": "not_a_number",    # should be float
            "SENSITIVITY_Y": 3.0,               # valid
            "SCROLL_ENABLED": 42,               # should be bool
            "GESTURE_MAPPINGS": "not_a_dict",   # should be dict
        }
        settings.save_config(test_config)

        # Reset to known defaults
        original_sens_x = settings.SENSITIVITY_X
        settings.SENSITIVITY_X = 2.0
        settings.SENSITIVITY_Y = 2.0
        settings.SCROLL_ENABLED = True
        original_mappings = dict(settings.GESTURE_MAPPINGS)

        settings.load_config()

        # Wrong-typed values should NOT have been applied
        self.assertAlmostEqual(settings.SENSITIVITY_X, 2.0,
                               msg="String should not overwrite float")
        self.assertTrue(settings.SCROLL_ENABLED,
                        msg="Int should not overwrite bool")
        self.assertEqual(settings.GESTURE_MAPPINGS, original_mappings,
                         msg="String should not overwrite dict")
        # Valid value should have been applied
        self.assertAlmostEqual(settings.SENSITIVITY_Y, 3.0)

    def test_camera_source_persists(self):
        """CAMERA_SOURCE should survive save -> load round-trip."""
        import settings

        test_config = {"CAMERA_SOURCE": "phone"}
        settings.save_config(test_config)

        settings.CAMERA_SOURCE = 0  # reset to default
        settings.load_config()

        self.assertEqual(settings.CAMERA_SOURCE, "phone")

    def test_camera_source_not_overwritten_by_default(self):
        """Saving with webcam index should also persist correctly."""
        import settings

        test_config = {"CAMERA_SOURCE": 0}
        settings.save_config(test_config)
        settings.load_config()

        self.assertEqual(settings.CAMERA_SOURCE, 0)

    def test_bool_rejected_for_numeric_fields(self):
        """Python bools (subclass of int) must NOT pass numeric validation."""
        import settings

        test_config = {
            "CAMERA_INDEX": True,       # bool, should be int only
            "SENSITIVITY_X": False,     # bool, should be float only
            "FACE_LOCK_TIMEOUT": True,  # bool, should be int/float only
            "SCROLL_ENABLED": True,     # bool — this IS the expected type
        }
        settings.save_config(test_config)

        settings.CAMERA_INDEX = 0
        settings.SENSITIVITY_X = 2.0
        settings.FACE_LOCK_TIMEOUT = 30
        settings.SCROLL_ENABLED = False

        settings.load_config()

        # Bools should NOT have overwritten numeric fields
        self.assertEqual(settings.CAMERA_INDEX, 0,
                         "bool should not overwrite int field")
        self.assertAlmostEqual(settings.SENSITIVITY_X, 2.0,
                               msg="bool should not overwrite float field")
        self.assertEqual(settings.FACE_LOCK_TIMEOUT, 30,
                         "bool should not overwrite int/float field")
        # But bool IS valid for boolean fields
        self.assertTrue(settings.SCROLL_ENABLED,
                        "bool should be accepted for bool field")


class HudImportTests(unittest.TestCase):
    """Smoke test that FloatingHUD can be imported and instantiated without PyQt6."""

    def test_import_floatinghud(self):
        """from src.controllers.hud import FloatingHUD should not crash."""
        # This test validates that hud.py handles missing PyQt6 gracefully
        from src.controllers.hud import FloatingHUD
        hud = FloatingHUD()
        # show_message and close should be safe to call as no-ops
        hud.show_message("test")
        hud.close()


if __name__ == "__main__":
    unittest.main()
