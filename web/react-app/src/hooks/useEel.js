/**
 * useEel — Eel (Python ↔ JS) bridge.
 * 
 * eel.js is loaded via a script tag in index.html (served by Eel).
 * Core callbacks (updateImage, updateTelemetry, updateLightWarning) are
 * exposed to Python via a SYNCHRONOUS <script> in index.html so they
 * are available immediately. React sets the window._eel* callbacks below.
 */

let _eelReady = null;

function waitForEel(timeout = 10000) {
    if (_eelReady) return _eelReady;
    _eelReady = new Promise((resolve) => {
        if (window.eel) {
            console.log('[useEel] window.eel found immediately');
            resolve(window.eel);
            return;
        }
        const start = Date.now();
        console.log('[useEel] Waiting for window.eel...');
        const check = setInterval(() => {
            if (window.eel) {
                clearInterval(check);
                console.log(`[useEel] window.eel found after ${Date.now() - start}ms`);
                resolve(window.eel);
            } else if (Date.now() - start > timeout) {
                clearInterval(check);
                console.warn('[useEel] window.eel NOT found after timeout');
                resolve(null);
            }
        }, 50);
    });
    return _eelReady;
}

/**
 * Subscribe to camera frame updates.
 * Sets the window callback that the sync <script> in index.html calls.
 */
export function onImageFrame(cb) {
    window._eelFrameCallback = cb;
    console.log('[useEel] onImageFrame callback set');
}

export function onTelemetry(cb) {
    window._eelTelemetryCallback = cb;
    console.log('[useEel] onTelemetry callback set');
}

export function onLightWarning(cb) {
    window._eelLightCallback = cb;
    console.log('[useEel] onLightWarning callback set');
}

export function onCameraMeta(cb) {
    window._eelCameraMetaCallback = cb;
    console.log('[useEel] onCameraMeta callback set');
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
