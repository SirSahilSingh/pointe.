# --- CAMERA SETTINGS ---
CAMERA_INDEX = 0             
CAMERA_SOURCE = 0
FRAME_WIDTH = 1280            
FRAME_HEIGHT = 720

# --- HEAD TRACKING SENSITIVITY ---
SENSITIVITY_X = 2.00         
SENSITIVITY_Y = 6.50          

# --- MOVEMENT PHYSICS ---
SMOOTHING = 0.05
ACCELERATION = 1.4
DEADZONE = 0.04

# --- CUSTOM GESTURE MAPPINGS ---
GESTURE_MAPPINGS = {
    "left_click": "left_wink",
    "right_click": "right_wink",
    "double_click": "pucker",
    "media_play_pause": "none",
    "drag_drop": "jaw_drop",
    "scroll": "both_closed"
}

# --- GESTURE CALIBRATION ---
GESTURE_CALIBRATION = {
    "left_wink": {"threshold": 0.65, "hold_duration": 0.25},
    "right_wink": {"threshold": 0.65, "hold_duration": 0.25},
    "pucker": {"threshold": 0.8, "hold_duration": 0.3},
    "jaw_drop": {"threshold": 0.15, "hold_duration": 0.2},
    "both_closed": {"threshold": 0.45, "hold_duration": 0.5},
    "open_palm": {"threshold": 0.6, "hold_duration": 0.2},
}

# --- FEATURE TOGGLES ---
MEDIA_AUTO_PAUSE = True
SCROLL_ENABLED = False
MOUSE_CONTROL_ENABLED = True
PINCH_COPY_PASTE = True
HAND_SWAP_WINDOW_SWITCH = True

# --- FACE LOCK ---
FACE_LOCK_ENABLED = False
FACE_LOCK_TIMEOUT = 15
FACE_LOCK_ON_UNKNOWN = False

# --- MOTION ENGINE (Velocity/Joystick Cursor Model) ---
MOTION_ENGINE = {
    "raw_smooth": 0.08,
    "dead_zone": 0.08,
    "max_tilt": 0.35,
    "max_speed": 900,
    "damping": 0.15,
    "one_euro_mincutoff": 1.5,
    "one_euro_beta": 0.3,
    "one_euro_dcutoff": 1.0,
}


# ─── Shared JSON Config Persistence ────────────────────────────────────────
# Both dashboard.py and main.py import this module, so both see the same
# overrides when load_config() is called at import time below.

import os
import sys
import json
import tempfile

# Per-user config path: %APPDATA%/Pointe/config.json (Windows),
# ~/.config/Pointe/config.json (Linux), ~/Library/Application Support/Pointe (macOS)
def _get_config_dir():
    if sys.platform == 'win32':
        base = os.environ.get('APPDATA', os.path.expanduser('~'))
    elif sys.platform == 'darwin':
        base = os.path.join(os.path.expanduser('~'), 'Library', 'Application Support')
    else:
        base = os.environ.get('XDG_CONFIG_HOME', os.path.join(os.path.expanduser('~'), '.config'))
    return os.path.join(base, 'Pointe')

CONFIG_DIR = _get_config_dir()
CONFIG_PATH = os.path.join(CONFIG_DIR, 'config.json')

# Only these module-level attributes can be overridden from JSON.
_CONFIG_WHITELIST = {
    'CAMERA_INDEX', 'CAMERA_SOURCE', 'FRAME_WIDTH', 'FRAME_HEIGHT',
    'SENSITIVITY_X', 'SENSITIVITY_Y',
    'SMOOTHING', 'ACCELERATION', 'DEADZONE',
    'GESTURE_MAPPINGS', 'GESTURE_CALIBRATION',
    'MEDIA_AUTO_PAUSE', 'SCROLL_ENABLED', 'MOUSE_CONTROL_ENABLED',
    'PINCH_COPY_PASTE', 'HAND_SWAP_WINDOW_SWITCH',
    'FACE_LOCK_ENABLED', 'FACE_LOCK_TIMEOUT', 'FACE_LOCK_ON_UNKNOWN',
    'MOTION_ENGINE',
}

# Expected types for validation (key -> allowed types)
_CONFIG_TYPES = {
    'CAMERA_INDEX': (int,),
    'CAMERA_SOURCE': (int, str),  # int for webcam index, 'phone' for phone
    'FRAME_WIDTH': (int,),
    'FRAME_HEIGHT': (int,),
    'SENSITIVITY_X': (int, float),
    'SENSITIVITY_Y': (int, float),
    'SMOOTHING': (int, float),
    'ACCELERATION': (int, float),
    'DEADZONE': (int, float),
    'GESTURE_MAPPINGS': (dict,),
    'GESTURE_CALIBRATION': (dict,),
    'MEDIA_AUTO_PAUSE': (bool,),
    'SCROLL_ENABLED': (bool,),
    'MOUSE_CONTROL_ENABLED': (bool,),
    'PINCH_COPY_PASTE': (bool,),
    'HAND_SWAP_WINDOW_SWITCH': (bool,),
    'FACE_LOCK_ENABLED': (bool,),
    'FACE_LOCK_TIMEOUT': (int, float),
    'FACE_LOCK_ON_UNKNOWN': (bool,),
    'MOTION_ENGINE': (dict,),
}


def _normalize_calibration(cal):
    """Convert JS-style holdDuration keys to Python-style hold_duration."""
    if not isinstance(cal, dict):
        return cal
    normalized = {}
    for gesture, vals in cal.items():
        if not isinstance(vals, dict):
            continue
        entry = {}
        for k, v in vals.items():
            # holdDuration -> hold_duration
            key = 'hold_duration' if k == 'holdDuration' else k
            entry[key] = v
        normalized[gesture] = entry
    return normalized


def load_config():
    """Load persisted JSON config and patch whitelisted module attributes.
    Silently falls back to defaults if the file is missing, malformed, or
    partially invalid."""
    _this = sys.modules[__name__]
    if not os.path.exists(CONFIG_PATH):
        return
    try:
        with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
        if not isinstance(data, dict):
            return
    except (json.JSONDecodeError, OSError, ValueError):
        return

    for key, value in data.items():
        if key not in _CONFIG_WHITELIST:
            continue
        # Type validation — skip values that don't match expected types.
        # In Python bool is a subclass of int, so we must explicitly reject
        # bools for fields that expect numeric (int/float) values.
        expected = _CONFIG_TYPES.get(key)
        if expected:
            if bool not in expected and isinstance(value, bool):
                continue
            if not isinstance(value, expected):
                continue
        if key == 'GESTURE_CALIBRATION':
            value = _normalize_calibration(value)
        setattr(_this, key, value)


def save_config(config_dict):
    """Atomically write config dict to CONFIG_PATH.
    Writes to a temp file first, then renames to avoid corruption on crash."""
    os.makedirs(CONFIG_DIR, exist_ok=True)

    # Normalize calibration before saving
    data = dict(config_dict)
    if 'GESTURE_CALIBRATION' in data:
        data['GESTURE_CALIBRATION'] = _normalize_calibration(data['GESTURE_CALIBRATION'])

    # Atomic write: temp file in same directory, then rename
    fd, tmp_path = tempfile.mkstemp(dir=CONFIG_DIR, suffix='.tmp', prefix='config_')
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
        # On Windows, os.replace is atomic and handles cross-device correctly
        os.replace(tmp_path, CONFIG_PATH)
    except Exception:
        # Clean up temp file on failure
        try:
            os.remove(tmp_path)
        except OSError:
            pass
        raise


# Apply persisted config on import
load_config()
