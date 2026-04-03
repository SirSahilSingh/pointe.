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

# Phone-specific overrides — heavier smoothing to absorb WebRTC jitter,
# wider dead zone for noisier phone landmarks, lower max speed to prevent
# noise amplification.  User-tunable via config.json.
MOTION_ENGINE_PHONE = {
    "raw_smooth": 0.10,
    "dead_zone": 0.09,
    "max_tilt": 0.35,
    "max_speed": 900,
    "damping": 0.15,
    "one_euro_mincutoff": 1.5,
    "one_euro_beta": 0.3,
    "one_euro_dcutoff": 1.0,
}

# Canonical defaults snapshot captured before persisted overrides are loaded.
# UI-facing default payloads must derive from this structure so Reset to
# Defaults cannot drift from the module's actual built-in defaults.
DEFAULT_SETTINGS = {
    'CAMERA_INDEX': CAMERA_INDEX,
    'CAMERA_SOURCE': CAMERA_SOURCE,
    'FRAME_WIDTH': FRAME_WIDTH,
    'FRAME_HEIGHT': FRAME_HEIGHT,
    'SENSITIVITY_X': SENSITIVITY_X,
    'SENSITIVITY_Y': SENSITIVITY_Y,
    'SMOOTHING': SMOOTHING,
    'ACCELERATION': ACCELERATION,
    'DEADZONE': DEADZONE,
    'GESTURE_MAPPINGS': dict(GESTURE_MAPPINGS),
    'GESTURE_CALIBRATION': {
        gesture: dict(values) for gesture, values in GESTURE_CALIBRATION.items()
    },
    'MEDIA_AUTO_PAUSE': MEDIA_AUTO_PAUSE,
    'SCROLL_ENABLED': SCROLL_ENABLED,
    'MOUSE_CONTROL_ENABLED': MOUSE_CONTROL_ENABLED,
    'PINCH_COPY_PASTE': PINCH_COPY_PASTE,
    'HAND_SWAP_WINDOW_SWITCH': HAND_SWAP_WINDOW_SWITCH,
    'FACE_LOCK_ENABLED': FACE_LOCK_ENABLED,
    'FACE_LOCK_TIMEOUT': FACE_LOCK_TIMEOUT,
    'FACE_LOCK_ON_UNKNOWN': FACE_LOCK_ON_UNKNOWN,
    'MOTION_ENGINE': dict(MOTION_ENGINE),
    'MOTION_ENGINE_PHONE': dict(MOTION_ENGINE_PHONE),
}

def get_default_ui_config():
    """Returns canonical default settings formatted for the frontend UI.
    This serves as the single source of truth for both the Reset to Defaults
    button and initial schema assumptions."""
    defaults = DEFAULT_SETTINGS
    return {
        'sens_x': defaults['SENSITIVITY_X'],
        'sens_y': defaults['SENSITIVITY_Y'],
        'smoothing': defaults['SMOOTHING'],
        'acceleration': defaults['ACCELERATION'],
        'deadzone': defaults['DEADZONE'],
        'lclick': defaults['GESTURE_MAPPINGS']['left_click'],
        'rclick': defaults['GESTURE_MAPPINGS']['right_click'],
        'dclick': defaults['GESTURE_MAPPINGS']['double_click'],
        'media_pp': defaults['GESTURE_MAPPINGS']['media_play_pause'],
        'drag': defaults['GESTURE_MAPPINGS']['drag_drop'],
        'scroll': defaults['GESTURE_MAPPINGS']['scroll'],
        'media_auto_pause': defaults['MEDIA_AUTO_PAUSE'],
        'scroll_enabled': defaults['SCROLL_ENABLED'],
        'mouse_control_enabled': defaults['MOUSE_CONTROL_ENABLED'],
        'pinch_copy_paste': defaults['PINCH_COPY_PASTE'],
        'hand_swap_window': defaults['HAND_SWAP_WINDOW_SWITCH'],
        'face_lock_enabled': defaults['FACE_LOCK_ENABLED'],
        'face_lock_timeout': defaults['FACE_LOCK_TIMEOUT'],
        'face_lock_on_unknown': defaults['FACE_LOCK_ON_UNKNOWN'],
        'gesture_calibration': {
            gesture: dict(values)
            for gesture, values in defaults['GESTURE_CALIBRATION'].items()
        },
        'camera_source': defaults['CAMERA_SOURCE'],
    }



# ─── Shared JSON Config Persistence ────────────────────────────────────────
# Both dashboard.py and main.py import this module, so both see the same
# overrides when load_config() is called at import time below.

import os
import sys
import json
import tempfile


def _default_phone_camera_ice_servers():
    """Build the default ICE server list, optionally augmented by TURN env vars."""
    servers = [
        {"urls": ["stun:stun.l.google.com:19302", "stun:stun.cloudflare.com:3478"]},
    ]

    turn_urls_raw = os.environ.get("POINTE_PHONE_CAMERA_TURN_URLS", "").strip()
    turn_username = os.environ.get("POINTE_PHONE_CAMERA_TURN_USERNAME", "").strip()
    turn_password = os.environ.get("POINTE_PHONE_CAMERA_TURN_PASSWORD", "").strip()

    if turn_urls_raw:
        turn_urls = [url.strip() for url in turn_urls_raw.split(",") if url.strip()]
        turn_server = {"urls": turn_urls}
        if turn_username:
            turn_server["username"] = turn_username
        if turn_password:
            turn_server["credential"] = turn_password
        servers.append(turn_server)

    return servers


def _normalize_ice_servers(value):
    """Return a sanitized ICE server list or defaults if the input is invalid."""
    if not isinstance(value, list):
        return _default_phone_camera_ice_servers()

    normalized = []
    for entry in value:
        if not isinstance(entry, dict):
            continue

        urls = entry.get("urls")
        if isinstance(urls, str):
            urls = [urls]
        if not isinstance(urls, list):
            continue

        clean_urls = [url for url in urls if isinstance(url, str) and url.strip()]
        if not clean_urls:
            continue

        normalized_entry = {"urls": clean_urls}
        username = entry.get("username")
        credential = entry.get("credential")
        if isinstance(username, str) and username.strip():
            normalized_entry["username"] = username
        if isinstance(credential, str) and credential.strip():
            normalized_entry["credential"] = credential
        normalized.append(normalized_entry)

    return normalized or _default_phone_camera_ice_servers()


PHONE_CAMERA_PUBLIC_URL = os.environ.get("POINTE_PHONE_CAMERA_PUBLIC_URL", "").strip()
PHONE_CAMERA_SIGNAL_URL = os.environ.get("POINTE_PHONE_CAMERA_SIGNAL_URL", "").strip()
PHONE_CAMERA_ICE_SERVERS = _default_phone_camera_ice_servers()

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
    'PHONE_CAMERA_PUBLIC_URL', 'PHONE_CAMERA_SIGNAL_URL', 'PHONE_CAMERA_ICE_SERVERS',
    'SENSITIVITY_X', 'SENSITIVITY_Y',
    'SMOOTHING', 'ACCELERATION', 'DEADZONE',
    'GESTURE_MAPPINGS', 'GESTURE_CALIBRATION',
    'MEDIA_AUTO_PAUSE', 'SCROLL_ENABLED', 'MOUSE_CONTROL_ENABLED',
    'PINCH_COPY_PASTE', 'HAND_SWAP_WINDOW_SWITCH',
    'FACE_LOCK_ENABLED', 'FACE_LOCK_TIMEOUT', 'FACE_LOCK_ON_UNKNOWN',
    'MOTION_ENGINE', 'MOTION_ENGINE_PHONE',
}

# Expected types for validation (key -> allowed types)
_CONFIG_TYPES = {
    'CAMERA_INDEX': (int,),
    'CAMERA_SOURCE': (int, str),  # int for webcam index, 'phone' for phone
    'FRAME_WIDTH': (int,),
    'FRAME_HEIGHT': (int,),
    'PHONE_CAMERA_PUBLIC_URL': (str,),
    'PHONE_CAMERA_SIGNAL_URL': (str,),
    'PHONE_CAMERA_ICE_SERVERS': (list,),
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
    'MOTION_ENGINE_PHONE': (dict,),
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
        elif key == 'PHONE_CAMERA_ICE_SERVERS':
            value = _normalize_ice_servers(value)
        setattr(_this, key, value)


def save_config(config_dict):
    """Atomically write config dict to CONFIG_PATH.
    Writes to a temp file first, then renames to avoid corruption on crash."""
    os.makedirs(CONFIG_DIR, exist_ok=True)

    # Normalize calibration before saving
    data = dict(config_dict)
    if 'GESTURE_CALIBRATION' in data:
        data['GESTURE_CALIBRATION'] = _normalize_calibration(data['GESTURE_CALIBRATION'])
    if 'PHONE_CAMERA_ICE_SERVERS' in data:
        data['PHONE_CAMERA_ICE_SERVERS'] = _normalize_ice_servers(data['PHONE_CAMERA_ICE_SERVERS'])

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
