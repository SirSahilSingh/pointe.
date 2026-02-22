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
        accentColor: '#34d399',
        // Universal access / person figure
        bgSvg: 'M12 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm0 8c-3 0-5 1.5-5 3v1h10v-1c0-1.5-2-3-5-3zm-3 6l1 6h1.5l1-4 1 4H15l1-6H9z',
        values: { sensitivity: 1.50, smoothing: 0.08, acceleration: 1.2, deadzone: 0.05 },
    },
    {
        id: 'browsing',
        name: 'Browsing',
        description: 'Web, reading, casual use',
        accentColor: '#60a5fa',
        // Globe
        bgSvg: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z',
        values: { sensitivity: 2.00, smoothing: 0.05, acceleration: 1.4, deadzone: 0.04 },
    },
    {
        id: 'productivity',
        name: 'Productivity',
        description: 'Office, multitasking',
        accentColor: '#a78bfa',
        // Briefcase
        bgSvg: 'M20 7h-4V5c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zM10 5h4v2h-4V5zm10 14H4v-7h4v1c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-1h4v7z',
        values: { sensitivity: 2.50, smoothing: 0.03, acceleration: 1.6, deadzone: 0.03 },
    },
    {
        id: 'gaming',
        name: 'Gaming',
        description: 'Fast response, minimal lag',
        accentColor: '#f47272',
        // Gamepad
        bgSvg: 'M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3v2zm4.5 2c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4-3c-.83 0-1.5-.67-1.5-1.5S18.67 9 19.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z',
        values: { sensitivity: 3.50, smoothing: 0.02, acceleration: 1.8, deadzone: 0.02 },
    },
    {
        id: 'design',
        name: 'Design',
        description: 'Pixel-precise control',
        accentColor: '#fbbf24',
        // Pen tool / compass
        bgSvg: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
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
