# --- CAMERA SETTINGS ---
CAMERA_INDEX = 0             
CAMERA_SOURCE = 'phone'
FRAME_WIDTH = 1280            
FRAME_HEIGHT = 720

# --- HEAD TRACKING SENSITIVITY ---
SENSITIVITY_X = 2.00         
SENSITIVITY_Y = 2.00          

# --- MOVEMENT PHYSICS ---
SMOOTHING = 0.05
ACCELERATION = 1.4
DEADZONE = 0.04

# --- CUSTOM GESTURE MAPPINGS ---
GESTURE_MAPPINGS = {
    "left_click": "left_wink",
    "right_click": "right_wink",
    "double_click": "pucker",
    "media_play_pause": "open_palm",
    "drag_drop": "jaw_drop",
    "scroll": "both_closed"
}

# --- GESTURE CALIBRATION ---
GESTURE_CALIBRATION = {
    "left_wink": {"threshold": 0.6, "hold_duration": 0.15},
    "right_wink": {"threshold": 0.6, "hold_duration": 0.15},
    "pucker": {"threshold": 0.85, "hold_duration": 0.2},
    "jaw_drop": {"threshold": 0.25, "hold_duration": 0.2},
    "both_closed": {"threshold": 0.6, "hold_duration": 0.5},
    "open_palm": {"threshold": 0.6, "hold_duration": 0.2},
}

# --- FEATURE TOGGLES ---
MEDIA_AUTO_PAUSE = True
SCROLL_ENABLED = True
MOUSE_CONTROL_ENABLED = True
PINCH_COPY_PASTE = True
HAND_SWAP_WINDOW_SWITCH = True

# --- FACE LOCK ---
FACE_LOCK_ENABLED = False
FACE_LOCK_TIMEOUT = 15
FACE_LOCK_ON_UNKNOWN = False
