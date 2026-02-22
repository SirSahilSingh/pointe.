/**
 * Sensitivity Presets — mapped to actual backend parameters.
 *
 * sensitivity → settings.SENSITIVITY_X/Y
 * smoothing   → mouse.py dynamic_smooth base
 * acceleration → mouse.py acceleration_curve exponent
 * deadzone    → mouse.py dead_zone_norm
 */

export const PRESETS = [
    {
        id: 'accessibility',
        name: 'Accessibility',
        description: 'Relaxed, large movements',
        gradient: 'linear-gradient(135deg, #34d39920, #06b6d420)',
        accentColor: '#34d399',
        values: { sensitivity: 1.50, smoothing: 0.08, acceleration: 1.2, deadzone: 0.05 },
    },
    {
        id: 'browsing',
        name: 'Browsing',
        description: 'Web, reading, casual use',
        gradient: 'linear-gradient(135deg, #60a5fa20, #818cf820)',
        accentColor: '#60a5fa',
        values: { sensitivity: 2.00, smoothing: 0.05, acceleration: 1.4, deadzone: 0.04 },
    },
    {
        id: 'productivity',
        name: 'Productivity',
        description: 'Office, multitasking',
        gradient: 'linear-gradient(135deg, #a78bfa20, #c084fc20)',
        accentColor: '#a78bfa',
        values: { sensitivity: 2.50, smoothing: 0.03, acceleration: 1.6, deadzone: 0.03 },
    },
    {
        id: 'gaming',
        name: 'Gaming',
        description: 'Fast response, minimal lag',
        gradient: 'linear-gradient(135deg, #f4727220, #fb923c20)',
        accentColor: '#f47272',
        values: { sensitivity: 3.50, smoothing: 0.02, acceleration: 1.8, deadzone: 0.02 },
    },
    {
        id: 'design',
        name: 'Design',
        description: 'Pixel-precise control',
        gradient: 'linear-gradient(135deg, #fbbf2420, #f59e0b20)',
        accentColor: '#fbbf24',
        values: { sensitivity: 5.00, smoothing: 0.01, acceleration: 2.0, deadzone: 0.01 },
    },
];

export const DEFAULT_CUSTOM = {
    sensitivity: 2.50,
    smoothing: 0.03,
    acceleration: 1.6,
    deadzone: 0.03,
};

/**
 * Available gestures for mapping  — no emojis
 */
export const GESTURES = [
    { value: 'left_wink', label: 'Left Wink' },
    { value: 'right_wink', label: 'Right Wink' },
    { value: 'pucker', label: 'Pucker' },
    { value: 'jaw_drop', label: 'Jaw Drop' },
    { value: 'both_closed', label: 'Both Eyes Closed' },
    { value: 'open_palm', label: 'Open Palm' },
    { value: 'none', label: 'Disabled' },
];

/**
 * Gesture actions that can be mapped
 */
export const GESTURE_ACTIONS = [
    { id: 'left_click', label: 'Left Click', key: 'lclick' },
    { id: 'right_click', label: 'Right Click', key: 'rclick' },
    { id: 'double_click', label: 'Double Click', key: 'dclick' },
    { id: 'media_play_pause', label: 'Media Play/Pause', key: 'media_pp' },
    { id: 'drag_drop', label: 'Drag & Drop', key: 'drag' },
    { id: 'scroll', label: 'Scroll Mode', key: 'scroll' },
];

/**
 * Default gesture calibration — per-gesture threshold & hold duration
 */
export const DEFAULT_GESTURE_CALIBRATION = {
    left_wink: { threshold: 0.60, holdDuration: 0.15 },
    right_wink: { threshold: 0.60, holdDuration: 0.15 },
    pucker: { threshold: 0.85, holdDuration: 0.20 },
    jaw_drop: { threshold: 0.25, holdDuration: 0.20 },
    both_closed: { threshold: 0.60, holdDuration: 0.50 },
    open_palm: { threshold: 0.60, holdDuration: 0.20 },
};
