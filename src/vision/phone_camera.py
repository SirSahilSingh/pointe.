"""
Phone Camera — WebSocket-based streaming from a phone's camera.

Architecture:
  1. A tiny HTTP server serves `phone_client.html` to the phone.
  2. A WebSocket server receives JPEG frames from the phone.
  3. BufferlessCapture exposes a cv2-compatible read() that always
     returns the latest frame with zero buffering lag.
"""

import asyncio
import base64
import io
import ipaddress
import json
import os
import socket
import ssl
import subprocess
import tempfile
import threading
import time
from http.server import HTTPServer, SimpleHTTPRequestHandler

import cv2
import numpy as np

try:
    import qrcode
except ImportError:
    qrcode = None

try:
    import websockets
    import websockets.server
except ImportError:
    websockets = None


# ─── Utility ────────────────────────────────────────────────

def get_local_ip():
    """Return the machine's LAN IP (the one reachable by the phone)."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"
    finally:
        s.close()


def generate_qr_base64(url: str) -> str:
    """Return a base64 PNG of a QR code encoding *url*."""
    if qrcode is None:
        raise RuntimeError("qrcode library is not installed")
    qr = qrcode.QRCode(box_size=8, border=2)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="white", back_color="#0a0a0a")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def _generate_self_signed_cert():
    """
    Generate a self-signed cert+key pair and return paths to the
    temporary PEM files.  Uses the `cryptography` library if available,
    otherwise falls back to OpenSSL CLI.
    """
    cert_dir = os.path.join(tempfile.gettempdir(), "pointe_certs")
    os.makedirs(cert_dir, exist_ok=True)
    cert_path = os.path.join(cert_dir, "cert.pem")
    key_path = os.path.join(cert_dir, "key.pem")

    # Re-use existing cert if it's less than 24 hours old
    if (os.path.exists(cert_path) and os.path.exists(key_path)
            and time.time() - os.path.getmtime(cert_path) < 86400):
        return cert_path, key_path

    try:
        from cryptography import x509
        from cryptography.x509.oid import NameOID
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import rsa
        import datetime

        key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        ip = get_local_ip()
        subject = issuer = x509.Name([
            x509.NameAttribute(NameOID.COMMON_NAME, ip),
        ])
        san = x509.SubjectAlternativeName([
            x509.IPAddress(ipaddress.ip_address(ip)),
        ])
        cert = (
            x509.CertificateBuilder()
            .subject_name(subject)
            .issuer_name(issuer)
            .public_key(key.public_key())
            .serial_number(x509.random_serial_number())
            .not_valid_before(datetime.datetime.utcnow())
            .not_valid_after(datetime.datetime.utcnow() + datetime.timedelta(days=365))
            .add_extension(san, critical=False)
            .sign(key, hashes.SHA256())
        )
        with open(cert_path, "wb") as f:
            f.write(cert.public_bytes(serialization.Encoding.PEM))
        with open(key_path, "wb") as f:
            f.write(key.private_bytes(
                serialization.Encoding.PEM,
                serialization.PrivateFormat.TraditionalOpenSSL,
                serialization.NoEncryption()
            ))
        return cert_path, key_path
    except ImportError:
        pass

    # Fallback: use OpenSSL CLI
    subprocess.run([
        "openssl", "req", "-x509", "-newkey", "rsa:2048",
        "-keyout", key_path, "-out", cert_path,
        "-days", "365", "-nodes",
        "-subj", f"/CN={get_local_ip()}"
    ], check=True, capture_output=True)
    return cert_path, key_path


def _make_ssl_context():
    """Build an SSL context with a self-signed certificate."""
    cert_path, key_path = _generate_self_signed_cert()
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(cert_path, key_path)
    return ctx


# ─── Bufferless Capture ────────────────────────────────────

class BufferlessCapture:
    """
    Drop-in replacement for cv2.VideoCapture that keeps only
    the *single latest* frame.  read() never returns stale data.
    """

    def __init__(self):
        self._frame = None
        self._lock = threading.Lock()
        self._opened = True
        self._last_frame_time = 0

    # -- called by the WS handler when a new frame arrives --
    def push_frame(self, frame: np.ndarray):
        with self._lock:
            self._frame = frame
            self._last_frame_time = time.time()

    # -- cv2-compatible API --
    def read(self):
        with self._lock:
            if self._frame is None:
                return False, None
            return True, self._frame.copy()

    def isOpened(self):
        return self._opened

    def release(self):
        self._opened = False
        with self._lock:
            self._frame = None

    def set(self, prop, value):
        pass  # ignored — resolution is controlled by the phone

    def get_fps(self):
        """Approximate current FPS based on frame arrival times."""
        return 30  # nominal

    @property
    def has_recent_frame(self):
        return (time.time() - self._last_frame_time) < 2.0


# ─── Phone Client HTTP Server ──────────────────────────────

class _PhoneHTTPHandler(SimpleHTTPRequestHandler):
    """Serves phone_client.html and injects the WS URL."""

    ws_url = ""
    client_html_path = ""

    def do_GET(self):
        if self.path == "/" or self.path == "/index.html":
            self._serve_client_page()
        else:
            self.send_error(404)

    def _serve_client_page(self):
        try:
            with open(self.client_html_path, "r", encoding="utf-8") as f:
                html = f.read()
            # Inject the WebSocket URL
            html = html.replace("__WS_URL__", self.ws_url)
            data = html.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except Exception as e:
            self.send_error(500, str(e))

    def log_message(self, fmt, *args):
        pass  # silence logs


# ─── Phone Camera Server ───────────────────────────────────

class PhoneCameraServer:
    """
    Manages the HTTP + WebSocket servers and exposes a
    BufferlessCapture for the rest of pointe to read from.
    """

    HTTP_PORT = 8765
    WS_PORT = 8766

    def __init__(self):
        self.capture = BufferlessCapture()
        self._http_server = None
        self._http_thread = None
        self._ws_thread = None
        self._ws_loop = None
        self._ws_server = None
        self._running = False
        self._connected = False
        self._ip = get_local_ip()
        self._qr_base64 = None
        self._ssl_ctx = None

    @property
    def url(self):
        return f"https://{self._ip}:{self.HTTP_PORT}"

    @property
    def ws_url(self):
        return f"wss://{self._ip}:{self.WS_PORT}"

    @property
    def is_running(self):
        return self._running

    @property
    def is_connected(self):
        return self._connected and self.capture.has_recent_frame

    @property
    def qr_base64(self):
        return self._qr_base64

    # ── public API ────────────────────────────────────────

    def start(self):
        if self._running:
            return
        self._running = True
        self._connected = False

        # Generate SSL context (self-signed cert for getUserMedia)
        self._ssl_ctx = _make_ssl_context()

        # Generate QR
        self._qr_base64 = generate_qr_base64(self.url)

        # Start HTTPS server
        self._start_http()

        # Start WSS server
        self._start_ws()

        print(f"[PHONE-CAM] HTTPS → {self.url}")
        print(f"[PHONE-CAM] WSS   → {self.ws_url}")

    def stop(self):
        self._running = False
        self._connected = False

        # Stop WebSocket
        if self._ws_loop and self._ws_server:
            self._ws_loop.call_soon_threadsafe(self._ws_server.close)
        if self._ws_loop:
            self._ws_loop.call_soon_threadsafe(self._ws_loop.stop)
        if self._ws_thread and self._ws_thread.is_alive():
            self._ws_thread.join(timeout=3)

        # Stop HTTP
        if self._http_server:
            self._http_server.shutdown()
        if self._http_thread and self._http_thread.is_alive():
            self._http_thread.join(timeout=3)

        self.capture.release()
        self.capture = BufferlessCapture()  # fresh for next start

        self._ws_loop = None
        self._ws_server = None
        self._http_server = None
        print("[PHONE-CAM] Servers stopped.")

    def get_status(self):
        if not self._running:
            return "idle"
        if self._connected and self.capture.has_recent_frame:
            return "streaming"
        if self._connected:
            return "connected"
        return "waiting"

    # ── HTTP ──────────────────────────────────────────────

    def _start_http(self):
        handler = _PhoneHTTPHandler
        handler.ws_url = self.ws_url
        handler.client_html_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "..", "..", "web", "phone_client.html"
        )

        self._http_server = HTTPServer(("0.0.0.0", self.HTTP_PORT), handler)
        # Wrap with SSL so phone browser gets HTTPS → getUserMedia works
        self._http_server.socket = self._ssl_ctx.wrap_socket(
            self._http_server.socket, server_side=True
        )
        self._http_thread = threading.Thread(
            target=self._http_server.serve_forever, daemon=True
        )
        self._http_thread.start()

    # ── WebSocket ─────────────────────────────────────────

    def _start_ws(self):
        self._ws_thread = threading.Thread(target=self._ws_main, daemon=True)
        self._ws_thread.start()

    def _ws_main(self):
        self._ws_loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._ws_loop)

        async def run():
            self._ws_server = await websockets.server.serve(
                self._ws_handler,
                "0.0.0.0",
                self.WS_PORT,
                max_size=2 ** 22,          # ~4 MB per message
                ping_interval=20,
                ping_timeout=60,
                ssl=self._ssl_ctx,         # WSS
            )
            await self._ws_server.wait_closed()

        try:
            self._ws_loop.run_until_complete(run())
        except Exception:
            pass

    async def _ws_handler(self, ws):
        self._connected = True
        print("[PHONE-CAM] Phone connected!")
        try:
            async for message in ws:
                if not self._running:
                    break
                if isinstance(message, bytes):
                    # Raw JPEG bytes
                    arr = np.frombuffer(message, np.uint8)
                    frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
                    if frame is not None:
                        self.capture.push_frame(frame)
                elif isinstance(message, str):
                    # Could be base64 JSON
                    try:
                        data = json.loads(message)
                        if "frame" in data:
                            raw = base64.b64decode(data["frame"])
                            arr = np.frombuffer(raw, np.uint8)
                            frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
                            if frame is not None:
                                self.capture.push_frame(frame)
                    except (json.JSONDecodeError, Exception):
                        pass
        except Exception as e:
            print(f"[PHONE-CAM] Connection closed: {e}")
        finally:
            self._connected = False
            print("[PHONE-CAM] Phone disconnected.")
