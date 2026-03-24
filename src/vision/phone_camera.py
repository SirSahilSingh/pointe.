"""
Phone camera transport for Pointe.

This keeps the existing QR-code onboarding flow, but swaps the media path
from raw JPEG-over-WebSocket to WebRTC video with STUN-backed ICE.

Important limitation:
    The phone still needs to reach Pointe's signaling URL. STUN improves the
    peer-to-peer media path, but it does not make the desktop's local HTTPS/WSS
    endpoint globally reachable by itself. For true any-network pairing, this
    transport still needs a public signaling route (or relay/tunnel).
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
import settings

try:
    import qrcode
except ImportError:
    qrcode = None

try:
    import websockets
except ImportError:
    websockets = None

try:
    from aiortc import (
        RTCConfiguration,
        RTCIceServer,
        RTCPeerConnection,
        RTCSessionDescription,
    )
    from aiortc.sdp import candidate_from_sdp, candidate_to_sdp
except ImportError:
    RTCConfiguration = None
    RTCIceServer = None
    RTCPeerConnection = None
    RTCSessionDescription = None
    candidate_from_sdp = None
    candidate_to_sdp = None


def get_local_ip():
    """Return the LAN IP the phone should connect to."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("8.8.8.8", 80))
        return sock.getsockname()[0]
    except Exception:
        return "127.0.0.1"
    finally:
        sock.close()


def generate_qr_base64(url: str) -> str:
    """Return a base64 PNG QR code for the provided URL."""
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
    """Create or reuse a short-lived self-signed cert for the local HTTPS/WSS endpoints."""
    cert_dir = os.path.join(tempfile.gettempdir(), "pointe_certs")
    os.makedirs(cert_dir, exist_ok=True)
    cert_path = os.path.join(cert_dir, "cert.pem")
    key_path = os.path.join(cert_dir, "key.pem")

    if (
        os.path.exists(cert_path)
        and os.path.exists(key_path)
        and time.time() - os.path.getmtime(cert_path) < 86400
    ):
        return cert_path, key_path

    try:
        from cryptography import x509
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import rsa
        from cryptography.x509.oid import NameOID
        import datetime

        key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        ip = get_local_ip()
        subject = issuer = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, ip)])
        cert = (
            x509.CertificateBuilder()
            .subject_name(subject)
            .issuer_name(issuer)
            .public_key(key.public_key())
            .serial_number(x509.random_serial_number())
            .not_valid_before(datetime.datetime.utcnow())
            .not_valid_after(datetime.datetime.utcnow() + datetime.timedelta(days=365))
            .add_extension(
                x509.SubjectAlternativeName(
                    [x509.IPAddress(ipaddress.ip_address(ip))]
                ),
                critical=False,
            )
            .sign(key, hashes.SHA256())
        )
        with open(cert_path, "wb") as cert_file:
            cert_file.write(cert.public_bytes(serialization.Encoding.PEM))
        with open(key_path, "wb") as key_file:
            key_file.write(
                key.private_bytes(
                    serialization.Encoding.PEM,
                    serialization.PrivateFormat.TraditionalOpenSSL,
                    serialization.NoEncryption(),
                )
            )
        return cert_path, key_path
    except ImportError:
        pass

    subprocess.run(
        [
            "openssl",
            "req",
            "-x509",
            "-newkey",
            "rsa:2048",
            "-keyout",
            key_path,
            "-out",
            cert_path,
            "-days",
            "365",
            "-nodes",
            "-subj",
            f"/CN={get_local_ip()}",
        ],
        check=True,
        capture_output=True,
    )
    return cert_path, key_path


def _make_ssl_context():
    cert_path, key_path = _generate_self_signed_cert()
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(cert_path, key_path)
    return context


def _serialize_candidate(candidate):
    if candidate is None:
        return {"type": "candidate", "candidate": None}
    return {
        "type": "candidate",
        "candidate": {
            "candidate": f"candidate:{candidate_to_sdp(candidate)}",
            "sdpMid": candidate.sdpMid,
            "sdpMLineIndex": candidate.sdpMLineIndex,
        },
    }


def _deserialize_candidate(candidate_data):
    if not candidate_data or not candidate_data.get("candidate"):
        return None
    raw = candidate_data["candidate"]
    if raw.startswith("candidate:"):
        raw = raw[len("candidate:") :]
    candidate = candidate_from_sdp(raw)
    candidate.sdpMid = candidate_data.get("sdpMid")
    candidate.sdpMLineIndex = candidate_data.get("sdpMLineIndex")
    return candidate


class BufferlessCapture:
    """cv2-compatible latest-frame capture surface."""

    def __init__(self):
        self._frame = None
        self._frame_id = 0
        self._last_frame_time = 0.0
        self._opened = True
        self._lock = threading.Lock()

    def push_frame(self, frame: np.ndarray):
        with self._lock:
            self._frame = frame
            self._frame_id += 1
            self._last_frame_time = time.time()

    def read(self):
        with self._lock:
            if self._frame is None:
                return False, None, self._frame_id
            return True, self._frame.copy(), self._frame_id

    def isOpened(self):
        return self._opened

    def release(self):
        self._opened = False
        with self._lock:
            self._frame = None

    def set(self, prop, value):
        return False

    def get_fps(self):
        return 30

    @property
    def has_recent_frame(self):
        return (time.time() - self._last_frame_time) < 2.0

    @property
    def last_frame_shape(self):
        with self._lock:
            if self._frame is None:
                return None
            return self._frame.shape


class _PhoneHTTPHandler(SimpleHTTPRequestHandler):
    """Serve the mobile phone client with injected signaling config."""

    signal_url = ""
    client_html_path = ""
    ice_servers_json = "[]"

    def do_GET(self):
        if self.path in ("/", "/index.html"):
            self._serve_client_page()
            return
        if self.path == "/logo.png":
            self._serve_logo()
            return
        self.send_error(404)

    def _serve_client_page(self):
        try:
            with open(self.client_html_path, "r", encoding="utf-8") as client_file:
                html = client_file.read()
            html = html.replace("__SIGNAL_URL__", self.signal_url)
            html = html.replace("__ICE_SERVERS__", self.ice_servers_json)
            payload = html.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
        except Exception as exc:
            self.send_error(500, str(exc))

    def _serve_logo(self):
        try:
            logo_path = os.path.join(
                os.path.dirname(os.path.abspath(__file__)),
                "..",
                "..",
                "web",
                "logo.png",
            )
            with open(logo_path, "rb") as logo_file:
                payload = logo_file.read()
            self.send_response(200)
            self.send_header("Content-Type", "image/png")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
        except Exception as exc:
            self.send_error(500, str(exc))

    def log_message(self, fmt, *args):
        pass


class PhoneCameraServer:
    """
    Local HTTPS + WSS signaling server for the phone camera flow.

    The phone streams camera video over WebRTC. Incoming video frames are
    converted into numpy arrays and pushed into a BufferlessCapture so the rest
    of Pointe can continue treating the phone as a cv2-like camera source.
    """

    HTTP_PORT = 8765
    SIGNAL_PORT = 8766

    def __init__(self):
        self.capture = BufferlessCapture()
        self._http_server = None
        self._http_thread = None
        self._signal_thread = None
        self._signal_loop = None
        self._signal_server = None
        self._ssl_ctx = None
        self._running = False
        self._peer_connected = False
        self._ip = get_local_ip()
        self._qr_base64 = None
        self._peers = set()
        self._last_error = None
        self._has_streamed = False

    @property
    def local_url(self):
        return f"https://{self._ip}:{self.HTTP_PORT}"

    @property
    def local_signal_url(self):
        return f"wss://{self._ip}:{self.SIGNAL_PORT}"

    @property
    def remote_ready(self):
        return bool(
            getattr(settings, "PHONE_CAMERA_PUBLIC_URL", "").strip()
            and getattr(settings, "PHONE_CAMERA_SIGNAL_URL", "").strip()
        )

    @property
    def url(self):
        if self.remote_ready:
            return settings.PHONE_CAMERA_PUBLIC_URL.strip()
        return self.local_url

    @property
    def signal_url(self):
        if self.remote_ready:
            return settings.PHONE_CAMERA_SIGNAL_URL.strip()
        return self.local_signal_url

    @property
    def ice_servers(self):
        return getattr(settings, "PHONE_CAMERA_ICE_SERVERS", [])

    @property
    def network_scope(self):
        return "remote" if self.remote_ready else "local"

    @property
    def config_warning(self):
        public_url = getattr(settings, "PHONE_CAMERA_PUBLIC_URL", "").strip()
        signal_url = getattr(settings, "PHONE_CAMERA_SIGNAL_URL", "").strip()
        if public_url and not signal_url:
            return "Remote phone mode needs PHONE_CAMERA_SIGNAL_URL as well as PHONE_CAMERA_PUBLIC_URL."
        if signal_url and not public_url:
            return "Remote phone mode needs PHONE_CAMERA_PUBLIC_URL as well as PHONE_CAMERA_SIGNAL_URL."
        return ""

    @property
    def is_running(self):
        return self._running

    @property
    def is_connected(self):
        return self._peer_connected and self.capture.has_recent_frame

    @property
    def last_error(self):
        return self._last_error or ""

    @property
    def has_streamed(self):
        return self._has_streamed

    @property
    def frame_shape(self):
        return self.capture.last_frame_shape

    @property
    def qr_base64(self):
        return self._qr_base64

    def start(self):
        if self._running:
            return
        if websockets is None:
            raise RuntimeError("websockets is required for phone camera signaling")
        if RTCPeerConnection is None:
            raise RuntimeError("aiortc is required for WebRTC phone camera streaming")

        self.capture = BufferlessCapture()
        self._running = True
        self._peer_connected = False
        self._last_error = None
        self._has_streamed = False
        self._ssl_ctx = _make_ssl_context()
        self._qr_base64 = generate_qr_base64(self.url)

        self._start_http()
        self._start_signal_server()

        print(f"[PHONE-CAM] LOCAL HTTPS  -> {self.local_url}")
        print(f"[PHONE-CAM] LOCAL SIGNAL -> {self.local_signal_url}")
        if self.remote_ready:
            print(f"[PHONE-CAM] PUBLIC HTTPS -> {self.url}")
            print(f"[PHONE-CAM] PUBLIC SIGNAL -> {self.signal_url}")
        elif self.config_warning:
            print(f"[PHONE-CAM] Remote config warning: {self.config_warning}")

    def stop(self):
        self._running = False
        self._peer_connected = False

        if self._signal_loop:
            async def shutdown():
                for peer in list(self._peers):
                    try:
                        await peer.close()
                    except Exception:
                        pass
                self._peers.clear()
                if self._signal_server:
                    self._signal_server.close()
                    await self._signal_server.wait_closed()
            try:
                future = asyncio.run_coroutine_threadsafe(shutdown(), self._signal_loop)
                future.result(timeout=3)
            except Exception:
                pass
            self._signal_loop.call_soon_threadsafe(self._signal_loop.stop)

        if self._signal_thread and self._signal_thread.is_alive():
            self._signal_thread.join(timeout=3)

        if self._http_server:
            try:
                self._http_server.shutdown()
                self._http_server.server_close()
            except Exception:
                pass
        if self._http_thread and self._http_thread.is_alive():
            self._http_thread.join(timeout=3)

        self.capture.release()
        self.capture = BufferlessCapture()
        self._signal_loop = None
        self._signal_server = None
        self._http_server = None
        self._has_streamed = False
        print("[PHONE-CAM] Servers stopped.")

    def get_status(self):
        if not self._running:
            return "idle"
        if self._last_error:
            return "error"
        if self.capture.has_recent_frame:
            return "streaming"
        if self._peer_connected:
            return "connected"
        return "waiting"

    def _start_http(self):
        handler = _PhoneHTTPHandler
        handler.signal_url = self.signal_url
        handler.ice_servers_json = json.dumps(self.ice_servers)
        handler.client_html_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "..",
            "..",
            "web",
            "phone_client.html",
        )

        self._http_server = HTTPServer(("0.0.0.0", self.HTTP_PORT), handler)
        self._http_server.socket = self._ssl_ctx.wrap_socket(
            self._http_server.socket, server_side=True
        )
        self._http_thread = threading.Thread(
            target=self._http_server.serve_forever,
            daemon=True,
        )
        self._http_thread.start()

    def _start_signal_server(self):
        self._signal_thread = threading.Thread(target=self._signal_main, daemon=True)
        self._signal_thread.start()

    def _signal_main(self):
        self._signal_loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._signal_loop)

        async def _start_signal_server():
            return await websockets.serve(
                self._signal_handler,
                "0.0.0.0",
                self.SIGNAL_PORT,
                max_size=2 ** 22,
                ping_interval=20,
                ping_timeout=60,
                ssl=self._ssl_ctx,
            )

        try:
            self._signal_server = self._signal_loop.run_until_complete(_start_signal_server())
            self._signal_loop.run_forever()
        except Exception as exc:
            self._last_error = str(exc)
            print(f"[PHONE-CAM] Signal server error: {exc}")
        finally:
            pending = asyncio.all_tasks(self._signal_loop)
            for task in pending:
                task.cancel()
            if pending:
                try:
                    self._signal_loop.run_until_complete(
                        asyncio.gather(*pending, return_exceptions=True)
                    )
                except Exception:
                    pass
            self._signal_loop.close()

    async def _signal_handler(self, websocket):
        if not self._running:
            return

        for peer in list(self._peers):
            try:
                await peer.close()
            except Exception:
                pass
        self._peers.clear()

        pc = RTCPeerConnection(
            RTCConfiguration(
                iceServers=[
                    RTCIceServer(
                        urls=server["urls"],
                        username=server.get("username"),
                        credential=server.get("credential"),
                    )
                    for server in self.ice_servers
                ]
            )
        )
        self._peers.add(pc)
        self._peer_connected = False
        self._last_error = None

        @pc.on("icecandidate")
        async def on_icecandidate(candidate):
            try:
                await websocket.send(json.dumps(_serialize_candidate(candidate)))
            except Exception:
                pass

        @pc.on("connectionstatechange")
        async def on_connectionstatechange():
            state = pc.connectionState
            if state in ("connected", "completed"):
                self._peer_connected = True
            elif state in ("failed", "disconnected", "closed"):
                self._peer_connected = False
            if state == "failed":
                await pc.close()

        @pc.on("track")
        def on_track(track):
            if track.kind != "video":
                return
            self._peer_connected = True
            asyncio.create_task(self._consume_video(track))

        try:
            async for message in websocket:
                if not self._running:
                    break

                data = json.loads(message)
                msg_type = data.get("type")

                if msg_type == "offer":
                    offer = RTCSessionDescription(sdp=data["sdp"], type="offer")
                    await pc.setRemoteDescription(offer)
                    answer = await pc.createAnswer()
                    await pc.setLocalDescription(answer)
                    await websocket.send(
                        json.dumps(
                            {
                                "type": "answer",
                                "sdp": pc.localDescription.sdp,
                            }
                        )
                    )
                elif msg_type == "candidate":
                    candidate = _deserialize_candidate(data.get("candidate"))
                    await pc.addIceCandidate(candidate)
                elif msg_type == "bye":
                    break
        except Exception as exc:
            if self._running and not exc.__class__.__name__.startswith("ConnectionClosed"):
                self._last_error = str(exc)
                print(f"[PHONE-CAM] Signaling error: {exc}")
        finally:
            self._peer_connected = False
            self._peers.discard(pc)
            try:
                await pc.close()
            except Exception:
                pass
            print("[PHONE-CAM] Phone disconnected.")

    async def _consume_video(self, track):
        try:
            while self._running:
                frame = await track.recv()
                image = frame.to_ndarray(format="bgr24")
                self.capture.push_frame(image)
                self._peer_connected = True
                self._has_streamed = True
        except Exception:
            pass
