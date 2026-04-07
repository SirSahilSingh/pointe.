# Pointe - QA Test Plan

> **Date**: 2026-03-23
> **Scope**: launch -> settings hydration -> live feed -> source selection -> engine -> calibration -> gesture mapping -> face lock -> recovery

---

## Machine Matrix

| Field | Value |
|---|---|
| Machine name | |
| OS / Build | |
| Webcam type | Built-in / USB (make & model) |
| Lighting | Good / Dim / Backlit / Off-center |
| Result | Pass / Fail |
| Screenshot / Recording | *(attach)* |
| Console / Log output | *(attach if relevant)* |

**Minimum rigs**: Windows laptop (built-in cam) - Windows desktop or 2nd laptop (USB cam) - Phone on same Wi-Fi

---

## Execution Order

### Wave 1 - Blockers
| TC-01 | Fresh launch / settings hydration |
|---|---|
| TC-02 | Default webcam path |
| TC-03 | Phone camera connect / disconnect / relaunch |
| TC-05 | Settings persistence |
| TC-09 | Face registration & thumbnails |
| TC-10 | Face lock runtime |

### Wave 2 - High Priority
| TC-08 | Controls / shortcut flow |
|---|---|
| TC-07 | Calibration flow |
| TC-06 | Gesture mapping flow |
| TC-04 | Engine start / stop stress |
| TC-11 | Recovery / reconnect edge cases |
| TC-12 | Low-light / poor-angle realism |

---

## Test Cases

### TC-01 Fresh Launch / Settings Hydration

**Goal**: App opens cleanly and loads persisted settings.

| # | Step | Expected |
|---|---|---|
| 1 | `python dashboard.py` | Window opens at 1100x700, no import/runtime errors |
| 2 | Observe console | `[SYSTEM] Serving UI from: ...`, camera opens |
| 3 | Check live feed | Feed renders, not blank/loading |
| 4 | Open Settings | All values match `%APPDATA%\Pointe\config.json` |
| 5 | Delete config file, relaunch | App starts with defaults, no crash |

**Pass**: app launches - feed appears - settings hydrate - first-run fallback works

---

### TC-02 Default Webcam Path

**Goal**: Webcam works before and after engine launch.

| # | Step | Expected |
|---|---|---|
| 1 | Launch app with webcam source | Local webcam feed starts |
| 2 | Click **Launch Engine** | Feed continues through engine IPC |
| 3 | Click **Stop Engine** | Dashboard webcam feed resumes |

**Pass**: no black screen - no frozen feed - no stale engine state

---

### TC-03 Phone Camera Connect / Disconnect / Relaunch

**Goal**: Phone source switches cleanly and persists correctly.

| # | Step | Expected |
|---|---|---|
| 1 | Open phone camera modal | Modal with QR placeholder |
| 2 | Start phone camera | QR appears, URL shown, polling starts |
| 3 | Scan QR, connect phone | Status -> connected, camera source -> `'phone'` |
| 4 | Launch engine while phone active | Phone server stops, engine uses phone source |
| 5 | Stop engine | Phone server restarts, dashboard feed resumes |
| 6 | Disconnect phone camera | Camera source -> `0`, webcam resumes |
| 7 | Relaunch engine after disconnect | Engine uses webcam, not phone |
| 8 | Fully close app, relaunch | Last saved source is respected |

**Pass**: no wrong source after reconnect/relaunch - no dead phone state - source persists across full restart

---

### TC-04 Engine Start / Stop Stress

**Goal**: Repeated cycles leave no orphan processes or port contention.

| # | Step | Expected |
|---|---|---|
| 1 | Webcam: launch -> wait 5s -> stop, repeat 5x | Each cycle clean |
| 2 | Phone: launch -> wait 5s -> stop, repeat 3x | Phone server stops/restarts correctly |
| 3 | Check Task Manager | No orphan `python main.py` |

**Pass**: no orphan process - no stuck UI - no duplicate stream or port conflict

---

### TC-05 Settings Persistence

**Goal**: All important values survive reopen and restart.

| # | Step | Expected |
|---|---|---|
| 1 | Change sensitivity, smoothing, acceleration, deadzone | Values update in UI |
| 2 | Change feature toggles | |
| 3 | Change gesture mappings | |
| 4 | Change gesture calibration values | |
| 5 | Change face-lock settings | |
| 6 | Change camera source | |
| 7 | Close and reopen Settings | All values match |
| 8 | Fully restart app | All values still match |
| 9 | Inspect `%APPDATA%\Pointe\config.json` | JSON correct; `holdDuration` -> `hold_duration` |

**Pass**: values match last saved state - calibration keys correct - face-lock and camera-source survive restart

---

### TC-06 Gesture Mapping Flow

**Goal**: Remapped gestures match UI and runtime behavior.

| # | Step | Expected |
|---|---|---|
| 1 | Remap 3 or more actions in Settings | Dropdowns update |
| 2 | Launch engine | |
| 3 | Check dashboard mapping display | Shows new mappings |
| 4 | Perform remapped gestures | Actions trigger as remapped |

**Pass**: dashboard shows new mappings - runtime behavior matches

---

### TC-07 Calibration Flow

**Goal**: Threshold / hold-duration changes affect real detection.

| # | Step | Expected |
|---|---|---|
| 1 | Adjust thresholds and hold durations | Values update |
| 2 | Launch engine | |
| 3 | Verify easier/harder triggering | Sensitivity change is noticeable |
| 4 | Press **Ctrl+C** (recalibrate) | Calibration resets to current position |

**Pass**: runtime sensitivity changes noticeable - recalibrate works - no UI/engine mismatch

---

### TC-08 Controls / Shortcut Flow

**Goal**: All documented shortcuts work from keyboard and UI.

| # | Step | Expected |
|---|---|---|
| 1 | Open Controls page | Gesture reference + shortcuts section visible |
| 2 | Press **Ctrl+M** | Card highlights, `toggle_mouse` fires |
| 3 | Press **Ctrl+C** | Card highlights, `recalibrate` fires |
| 4 | Press **Ctrl+Q** | Card highlights, `quit_engine` fires |
| 5 | Click each shortcut card | Same actions fire |

**Pass**: card highlight + action both occur - keyboard matches on-screen docs

---

### TC-09 Face Registration & Thumbnails

**Goal**: Multi-pose registration works and still produces a thumbnail even if one sampled frame is invalid.

| # | Step | Expected |
|---|---|---|
| 1 | Ensure engine is **stopped** | |
| 2 | Face Lock -> **Add Face** | `FaceRegisterModal` opens |
| 3 | Start scan, then briefly look away or move partly out of frame during the early part of the scan | Scan continues; no per-capture UI failure is required |
| 4 | Return to a valid face position for the remaining samples | Registration can still succeed |
| 5 | Complete registration | Success indicator |
| 6 | Check registry grid | **Thumbnail appears** |
| 7 | Delete face | Grid updates, face removed |

**Pass**: registration succeeds despite one bad sampled frame - thumbnail never blank after success - delete works

---

### TC-10 Face Lock Runtime

**Goal**: Face lock matches configured behavior.

| # | Step | Expected |
|---|---|---|
| 1 | Register 1 or more faces | |
| 2 | Enable face lock, set timeout (e.g. 10s) | |
| 3 | Launch engine with recognized face | Cursor active, no lock |
| 4 | Leave frame, wait for timeout | Cursor locks |
| 5 | Return to frame | Cursor unlocks |
| 6 | Enable **Lock on Unknown Face** | |
| 7 | Test with another person | Cursor locks on unknown |
| 8 | Disable toggle, retest | Unknown face does **not** lock |

**Pass**: recognized face stays unlocked - absent locks after timeout - unknown-face follows setting - no false triggers

---

### TC-11 Recovery / Reconnect Edge Cases

**Goal**: Failures are recoverable and do not crash the app.

| # | Step | Expected |
|---|---|---|
| 1 | Unplug webcam while running | No crash, fallback or stable failure state |
| 2 | Reconnect webcam | Feed recovers or can be recovered without reinstall/manual cleanup |
| 3 | Disconnect phone during active session | Status updates, recoverable |
| 4 | Kill engine process externally | Dashboard detects exit, restarts camera |

**Pass**: no crash - no permanent freeze - feed recovers or fails recoverably - no manual cleanup needed

---

### TC-12 Low-Light / Poor-Angle Realism

**Goal**: Product remains usable in realistic bad conditions.

| # | Step | Expected |
|---|---|---|
| 1 | Dim light | Feed visible, detection works (may degrade) |
| 2 | Backlit (window behind user) | Feed renders, face mesh detectable |
| 3 | Off-center face position | Cursor control still functions |

**Pass**: no catastrophic failure - behavior understandable - detection may degrade but not become erratic

---

## Pre-QA Automated Check

```powershell
cd C:\PROJECTS\pointe
python -m unittest discover -s tests -v
```

---

## Release-Blocking Failures

| # | Criteria |
|---|---|
| 1 | App fails to open or hydrate settings |
| 2 | Camera feed stays blank or freezes |
| 3 | Engine start/stop leaves app stuck |
| 4 | Wrong camera source persists across relaunch |
| 5 | Gesture mappings shown in UI do not match runtime behavior |
| 6 | Face registration succeeds but thumbnail/registry is broken |
| 7 | Face lock locks incorrectly or unreliably |
| 8 | Phone camera flow cannot recover cleanly after disconnect |

---

## Result Log Template

| TC | Machine | Webcam | Lighting | Result | Notes |
|---|---|---|---|---|---|
| TC-01 | | | | | |
| TC-02 | | | | | |
| TC-03 | | | | | |
| TC-04 | | | | | |
| TC-05 | | | | | |
| TC-06 | | | | | |
| TC-07 | | | | | |
| TC-08 | | | | | |
| TC-09 | | | | | |
| TC-10 | | | | | |
| TC-11 | | | | | |
| TC-12 | | | | | |
