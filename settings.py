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
