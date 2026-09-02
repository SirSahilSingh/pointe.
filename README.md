# Pointe.

Control your PC with head movements and facial gestures. No special hardware, no wearables - just your webcam or phone camera.

Pointe uses real-time face tracking to translate subtle head tilts into cursor movement and facial expressions into mouse clicks, scrolls, drag-and-drop, and media controls. Everything runs locally on your machine. No data is sent anywhere.

> Currently in beta. Windows only for now.

## Features

### Cursor Control
- Move your cursor by tilting your head in any direction
- Two motion modes: **Direct** (trackpad-like, follows frame-to-frame face movement) and **Velocity** (joystick-like, tilt angle controls speed)
- Adjustable sensitivity, smoothing, deadzone, and acceleration
- Built-in presets (low, medium, high sensitivity) or full manual tuning
- Auto-calibration on startup: Pointe scans your resting face for a few frames to establish personalized baselines for each gesture

### Gesture Actions
- **Left wink** for left click
- **Right wink** for right click
- **Lip pucker** for double click
- **Jaw drop** for drag and drop
- **Both eyes closed** for scroll mode (head tilt controls scroll direction and speed)
- **Open palm** for media play/pause
- **Pinch gesture** for copy/paste
- **Hand swipe** to switch windows (Alt+Tab)
- All gesture-to-action mappings are fully customizable through the dashboard
- Per-gesture threshold and hold duration calibration to avoid false triggers and accommodate different facial structures

### Phone Camera
- Use your phone as a wireless camera instead of or alongside your webcam
- Pairing via QR code scan from the dashboard
- Video streams over WebRTC with STUN-backed ICE for a direct peer-to-peer connection
- Phone-specific motion tuning with heavier smoothing and wider deadzones to absorb WebRTC transport noise
- Automatic fallback to webcam when the phone disconnects

### Face Lock
- Locks your screen when your face is absent for a configurable timeout period
- Optionally locks when an unregistered face is detected
- Uses MediaPipe Face Mesh 468-landmark embeddings for face recognition (no additional dependencies)
- Register up to 5 trusted faces
- Unlock by showing your registered face to the camera

### Interface
- Dashboard with live camera preview, real-time telemetry (FPS, latency, face detection status, brightness), and one-click engine launch
- Floating HUD overlay (Dynamic Island style) that shows triggered actions in real time using PyQt6
- Settings panel with full control over sensitivity curves, gesture mappings, gesture calibration, feature toggles, and camera source
- Controls page with keyboard shortcut reference and live shortcut triggering
- Debug telemetry overlay showing raw/filtered motion signals, velocity vectors, deadzone visualization, and FPS timing

### Performance
- Threaded camera capture (BufferlessCapture) for zero-latency frame access - the main loop always gets the most recent frame
- Background MediaPipe processing thread rate-limited to ~55fps
- Adaptive performance tiers: automatically reduces tracking resolution and hand detection frequency when FPS drops, and recovers when conditions improve
- Hand landmarks processed every 3rd frame (normal) or 5th frame (degraded) to keep cursor response time low
- Native Win32 cursor API (SetCursorPos, mouse_event) for lower latency mouse control on Windows
- Low-light detection with brightness monitoring

## Architecture

### Signal Pipeline

    Camera -> BufferlessCapture (threaded reader, always latest frame)
           -> MediaPipe Face Mesh (468 landmarks, background thread)
           -> Yaw/Pitch extraction (face center vs ear/chin ratios)
           -> FaceMotionTracker (Lucas-Kanade optical flow on stable facial features)
           -> MotionEngine (deadzone -> quadratic speed curve -> 1-Euro filter)
           -> MouseController (cursor position, screen clamping, Win32 API)

### Motion Engine Modes

**Direct mode** is used with optical flow tracking. The cursor follows actual frame-to-frame face displacement with minimal filtering, similar to how a trackpad works. A 1-Euro filter is applied to the output deltas for stability.

**Velocity mode** treats head tilt like a joystick. The amount of tilt beyond the deadzone maps to cursor speed through a quadratic curve: small tilts produce precise, slow movement, while larger tilts accelerate quickly up to a configurable maximum speed. Velocity decays smoothly when you return to center.

Both modes use a 1-Euro filter (Casiez et al. 2012), a speed-adaptive low-pass filter that stays smooth during slow movements and responsive during fast ones.

### Auto-Calibration

When the engine starts, the MouseController collects resting-face samples over the first few frames. It measures your natural eye aspect ratio, brow-to-eye distance, mouth aspect ratio, and mouth width, then uses these as personalized baselines. Gesture detection is always relative to your face, not hardcoded thresholds.

Frames where you are blinking, talking, or making expressions during calibration are automatically discarded.

### Adaptive Performance

The MediaPipe background thread monitors its own processing FPS over a 2-second sliding window:

- If FPS drops below 18 for 3 seconds, the system enters **degraded tier**: tracking resolution is reduced and hand detection runs less often
- If FPS rises above 28 for 4 seconds, the system returns to **normal tier**
- The motion engine configuration (smoothing, deadzone, speed curve) is never changed by tier transitions - only the input resolution and hand detection cadence are affected

## Project Structure

    pointe/
      main.py                     # Headless tracking engine (no UI, keyboard shortcuts only)
      dashboard.py                # Full desktop app with dashboard UI (Eel + React)
      settings.py                 # All configurable settings and JSON config persistence
      requirements.txt            # Python dependencies
      VERSION                     # Current version (1.0.0)
      src/
        vision/
          face_mesh.py            # MediaPipe Face Mesh detector wrapper
          face_motion.py          # Optical flow tracker (Lucas-Kanade on facial features)
          face_lock.py            # Face recognition and screen lock module
          phone_camera.py         # WebRTC phone camera transport with QR pairing
          bufferless_capture.py   # Threaded camera reader for zero-latency frames
        controllers/
          mouse.py                # Cursor control, gesture detection, auto-calibration
          hud.py                  # Dynamic Island floating HUD (PyQt6, separate process)
          parallax.py             # Head parallax shift calculator
        math_utils/
          filters.py              # MotionEngine (velocity + direct modes) and 1-Euro filter
          geometry.py             # Geometric helper functions
        debug/
          telemetry.py            # Real-time debug overlay (tkinter)
          signal_logger.py        # Motion signal CSV logger
          noise_measurement.py    # Noise analysis tools
      web/
        react-app/                # Dashboard frontend (React + Vite + Tailwind CSS)
          src/
            pages/                # Dashboard, Settings, Controls, PhoneCamera pages
            components/           # Sidebar, GlassCard, gesture animations, ornaments
            contexts/             # Auth context (currently disabled for local dev)
            hooks/                # Eel bridge hooks
            data/                 # Gesture Lottie animation data
        dist/                     # Built frontend (served by Eel)

## Setup

### Requirements

- Python 3.10 or newer
- A webcam (built-in or USB), or a phone with a camera
- Windows 10 or Windows 11
- Node.js 18+ (only if you need to modify the dashboard UI)

### Installation

1. Clone the repository:

        git clone https://github.com/SirSahilSingh/pointe.git
        cd pointe

2. Create and activate a virtual environment:

        python -m venv .venv
        .venv\Scripts\activate

3. Install Python dependencies:

        pip install -r requirements.txt

4. (Optional) If you want to modify the dashboard UI, build the frontend:

        cd web/react-app
        npm install
        npm run build
        cd ../..

   The built files go to `web/dist/`, which is what `dashboard.py` serves.

### Running

**Dashboard mode** (recommended):

    python dashboard.py

Opens a desktop window on port 8170 with:
- Live camera preview
- Gesture mapping configuration
- Sensitivity and smoothing controls
- One-click engine launch and stop
- Phone camera pairing
- Real-time telemetry

**Headless mode** (no UI):

    python main.py

Runs the tracking engine directly with keyboard shortcuts for control. Useful for lower overhead or when you just want to use the tracking without the dashboard.

### Phone Camera Setup

1. Open the dashboard and click "Connect Phone" in the sidebar
2. A QR code will appear on screen
3. Scan the QR code with your phone's camera app or browser
4. The phone opens a web page that requests camera access
5. Once connected, the phone camera feed streams to Pointe over WebRTC

Both devices need to be on the same local network. For connections across different networks, you can configure a TURN relay server using environment variables:

    POINTE_PHONE_CAMERA_TURN_URLS=turn:your-server.com:3478
    POINTE_PHONE_CAMERA_TURN_USERNAME=user
    POINTE_PHONE_CAMERA_TURN_PASSWORD=pass

## Configuration

All settings are persisted to a JSON file at:
- **Windows**: `%APPDATA%\Pointe\config.json`
- **macOS**: `~/Library/Application Support/Pointe/config.json`
- **Linux**: `~/.config/Pointe/config.json`

You can edit this file directly or use the dashboard UI. Changes are applied immediately.

### Sensitivity and Movement

| Setting        | Description                                                         | Default |
|----------------|---------------------------------------------------------------------|---------|
| `SENSITIVITY_X`| Horizontal sensitivity multiplier                                   | 2.00    |
| `SENSITIVITY_Y`| Vertical sensitivity multiplier                                     | 6.50    |
| `SMOOTHING`    | EMA smoothing factor (lower = more responsive, higher = smoother)   | 0.05    |
| `ACCELERATION` | Power curve exponent for movement amplification                     | 1.4     |
| `DEADZONE`     | Minimum head displacement before cursor moves                       | 0.04    |

### Motion Engine (Advanced)

| Setting         | Description                                    | Default |
|-----------------|------------------------------------------------|---------|
| `mode`          | `velocity` (joystick) or `direct` (trackpad)   | velocity|
| `dead_zone`     | Tilt deadzone for velocity mode                | 0.06    |
| `max_tilt`      | Maximum tilt range (normalized)                | 0.35    |
| `max_speed`     | Maximum cursor speed in pixels/second          | 900     |
| `damping`       | Velocity decay rate when returning to center   | 0.15    |
| `one_euro_mincutoff` | 1-Euro filter minimum cutoff frequency    | 2.2     |
| `one_euro_beta` | 1-Euro filter speed coefficient                | 0.45    |

### Feature Toggles

| Setting                 | Description                                     | Default |
|-------------------------|-------------------------------------------------|---------|
| `MOUSE_CONTROL_ENABLED` | Enable head-tracking cursor movement            | true    |
| `SCROLL_ENABLED`        | Enable scroll mode gesture                      | false   |
| `MEDIA_AUTO_PAUSE`      | Auto-pause media when face is absent for 2s     | true    |
| `PINCH_COPY_PASTE`      | Enable pinch gesture for copy/paste             | true    |
| `HAND_SWAP_WINDOW_SWITCH` | Enable hand swipe for window switching        | true    |
| `FACE_LOCK_ENABLED`     | Enable face-based screen lock                   | false   |
| `FACE_LOCK_TIMEOUT`     | Seconds before locking when face is absent      | 15      |
| `FACE_LOCK_ON_UNKNOWN`  | Lock when an unregistered face is detected      | false   |

## Default Gesture Mappings

| Action           | Gesture          | How it works                                            |
|------------------|------------------|---------------------------------------------------------|
| Left click       | Left wink        | Close your left eye briefly                             |
| Right click      | Right wink       | Close your right eye briefly                            |
| Double click     | Pucker           | Purse your lips together                                |
| Drag and drop    | Jaw drop         | Open your mouth wide, move cursor, close to release     |
| Scroll           | Both eyes closed | Close both eyes, then tilt head to scroll up/down       |
| Media play/pause | Open palm        | Show an open palm to the camera                         |
| Copy/Paste       | Pinch            | Pinch thumb and index finger together                   |
| Switch window    | Hand swipe       | Hold palm to one side, swipe across to the other side   |

All mappings can be reassigned through the Settings panel in the dashboard.

## Keyboard Shortcuts

| Shortcut       | Action                              |
|----------------|-------------------------------------|
| `Ctrl+C`       | Recalibrate face tracking center    |
| `Ctrl+M`       | Toggle mouse control on/off         |
| `Ctrl+Q`       | Quit the tracking engine            |
| `Ctrl+Shift+D` | Toggle debug telemetry overlay      |
| `Ctrl+N`       | Start noise measurement             |
| `Ctrl+D`       | Navigate to Dashboard (in-app)      |
| `Ctrl+S`       | Open Settings (in-app)              |
| `Ctrl+P`       | Open Phone Camera (in-app)          |
| `Ctrl+Shift+C` | Open Controls page (in-app)         |

## Tech Stack

| Layer              | Technologies                                              |
|--------------------|-----------------------------------------------------------|
| Face tracking      | MediaPipe Face Mesh, MediaPipe Hands, OpenCV              |
| Motion processing  | Lucas-Kanade optical flow, 1-Euro filter, numpy           |
| Cursor control     | PyAutoGUI, Win32 API (ctypes)                             |
| Desktop UI         | Eel (Python/JS bridge), React 19, Vite 7, Tailwind CSS 4 |
| Phone camera       | WebRTC (aiortc), WebSocket signaling, QR code pairing     |
| HUD overlay        | PyQt6 (hardware-accelerated, click-through, separate process) |
| Debug tools        | tkinter overlay, CSV signal logging                       |
| Configuration      | JSON file persistence with atomic writes                  |

## Known Limitations

- Windows only (macOS and Linux support is planned but not yet available)
- Requires a reasonably well-lit environment for reliable face tracking
- Phone camera requires both devices on the same network unless a TURN server is configured
- The 1-Euro filter parameters may need per-user tuning for optimal cursor feel depending on camera quality and distance
- Hand gesture detection (palm, pinch, swipe) runs at a lower cadence than face tracking to preserve cursor responsiveness

## License

[To be added]
