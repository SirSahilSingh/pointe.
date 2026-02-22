/**
 * useEel — Eel (Python ↔ JS) bridge.
 * 
 * eel.js is loaded via a script tag in index.html (served by Eel).
 * It may take a moment to initialize, so we wait for it.
 */

let _eelReady = null;

// Global frame callback — set early so Python can push frames immediately
let _imageCallback = null;
let _telemetryCallback = null;
let _lightCallback = null;

function waitForEel(timeout = 5000) {
    if (_eelReady) return _eelReady;
    _eelReady = new Promise((resolve) => {
        if (window.eel) { resolve(window.eel); return; }
        const start = Date.now();
        const check = setInterval(() => {
            if (window.eel) { clearInterval(check); resolve(window.eel); }
            else if (Date.now() - start > timeout) { clearInterval(check); resolve(null); }
        }, 50);
    });
    return _eelReady;
}

// Register core callbacks as soon as eel is ready
// This runs once on module load — before any React component mounts
waitForEel().then(eel => {
    if (!eel) return;

    // Camera frames
    eel.expose(function updateImage(base64Img) {
        if (_imageCallback) _imageCallback(base64Img);
    }, 'updateImage');

    // Face detection status
    eel.expose(function updateTelemetry(detected) {
        if (_telemetryCallback) _telemetryCallback(detected);
    }, 'updateTelemetry');

    // Low light warning
    eel.expose(function updateLightWarning(isLow) {
        if (_lightCallback) _lightCallback(isLow);
    }, 'updateLightWarning');

    console.log('[useEel] Core callbacks registered');
});

/**
 * Subscribe to camera frame updates.
 * Call from LiveFeed useEffect — the actual eel.expose
 * already happened at module load time above.
 */
export function onImageFrame(cb) {
    _imageCallback = cb;
}

export function onTelemetry(cb) {
    _telemetryCallback = cb;
}

export function onLightWarning(cb) {
    _lightCallback = cb;
}

/**
 * Call an Eel-exposed Python function.
 * Returns null if Eel is not available.
 */
export async function callEel(funcName, ...args) {
    const eel = await waitForEel();
    if (!eel || typeof eel[funcName] !== 'function') {
        console.warn(`[useEel] ${funcName} not available`);
        return null;
    }
    try {
        return await eel[funcName](...args)();
    } catch (err) {
        console.error(`[useEel] ${funcName} failed:`, err);
        return null;
    }
}

/**
 * Expose a JS function to Python.
 * Must be called early (e.g. in useEffect) so Python can push data to JS.
 */
export function exposeToEel(funcName, fn) {
    // Try immediately
    if (window.eel) {
        window.eel.expose(fn, funcName);
        return;
    }
    // Wait for eel
    waitForEel().then(eel => {
        if (eel) eel.expose(fn, funcName);
    });
}

/**
 * Check if Eel is available.
 */
export function isEelAvailable() {
    return !!window.eel;
}
