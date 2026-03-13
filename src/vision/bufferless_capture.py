"""
BufferlessCapture — Threaded camera reader for low-latency frame access.

OpenCV's VideoCapture.read() blocks until the camera delivers a frame.
When the processing pipeline is slower than the camera's frame rate,
frames queue up and cap.read() returns stale data with increasing latency.

This wrapper reads frames in a background thread so the main loop always
gets the most recent frame instantly (~0 ms instead of 30–70 ms).
"""

import cv2
import threading


class BufferlessCapture:
    """Drop-in replacement for cv2.VideoCapture with threaded reads."""

    def __init__(self, source, backend=None):
        if backend is not None:
            self._cap = cv2.VideoCapture(source, backend)
        else:
            self._cap = cv2.VideoCapture(source)

        self._lock = threading.Lock()
        self._frame = None
        self._ok = False
        self._running = True
        self._frame_id = 0  # incremented on each genuinely new frame

        # Start reader thread
        self._thread = threading.Thread(target=self._reader, daemon=True)
        self._thread.start()

    def _reader(self):
        """Continuously grab frames in background."""
        while self._running:
            ok, frame = self._cap.read()
            with self._lock:
                self._ok = ok
                self._frame = frame
                if ok:
                    self._frame_id += 1

    def set(self, prop, value):
        """Proxy to underlying VideoCapture.set()."""
        return self._cap.set(prop, value)

    def get(self, prop):
        """Proxy to underlying VideoCapture.get()."""
        return self._cap.get(prop)

    def read(self):
        """Return the most recent frame instantly (non-blocking).

        Returns (ok, frame, frame_id) — frame_id increments on each
        genuinely new camera frame so callers can skip processing duplicates.
        """
        with self._lock:
            return (self._ok,
                    self._frame.copy() if self._frame is not None else None,
                    self._frame_id)

    def release(self):
        """Stop the reader thread and release the camera."""
        self._running = False
        self._thread.join(timeout=2)
        self._cap.release()
