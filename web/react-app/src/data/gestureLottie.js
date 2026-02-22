// Gesture Lottie file mappings — uses existing files from web/gestures/
// These are copied to public/gestures/ during build

export const GESTURE_LOTTIE = {
    left_wink: {
        // No dedicated left_wink file — we mirror right_wink
        lottieFile: './gestures/right_wink.json',
        mirror: true,
        color: '#60a5fa',
        label: 'Left Wink',
        action: 'Left Click',
    },
    right_wink: {
        lottieFile: './gestures/right_wink.json',
        mirror: false,
        color: '#818cf8',
        label: 'Right Wink',
        action: 'Right Click',
    },
    pucker: {
        lottieFile: './gestures/pout.json',
        mirror: false,
        color: '#f472b6',
        label: 'Pucker',
        action: 'Double Click',
    },
    jaw_drop: {
        lottieFile: './gestures/jaw_drop.json',
        mirror: false,
        color: '#fbbf24',
        label: 'Jaw Drop',
        action: 'Drag & Drop',
    },
    both_closed: {
        lottieFile: './gestures/dual_blink.json',
        mirror: false,
        color: '#34d399',
        label: 'Both Eyes Closed',
        action: 'Scroll Mode',
    },
    open_palm: {
        lottieFile: './gestures/palm.json',
        mirror: false,
        color: '#fb923c',
        label: 'Open Palm',
        action: 'Media Play/Pause',
    },
}

// Extra gesture files available:
// head_shake.json, pinch.json, wave_hand.json
