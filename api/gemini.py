from http.server import BaseHTTPRequestHandler
import json
import os

from google import genai

DEFAULT_MODEL = "gemini-3.5-flash"


def _is_paused():
    """Return True when the endpoint is paused via SERVICE_PAUSED."""
    return (os.environ.get("SERVICE_PAUSED") or "").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    )


def _get_api_key():
    """Return the configured Gemini API key, or None if unset or 'null'."""
    raw_key = (os.environ.get("GEMINI_API_KEY") or "").strip()
    if not raw_key or raw_key.lower() == "null":
        return None
    return raw_key


def get_service_status():
    """Return (status_code, payload) reflecting Gemini key and pause state."""
    model = (os.environ.get("GEMINI_MODEL") or DEFAULT_MODEL).strip() or DEFAULT_MODEL
    api_key = _get_api_key()
    paused = _is_paused()

    if paused or not api_key:
        reason = "Service is paused." if paused else "GEMINI_API_KEY is null or not set."
        return 503, {
            "ok": False,
            "api": None,
            "status": "paused",
            "configured": bool(api_key),
            "model": model,
            "error": reason,
        }

    return 200, {
        "ok": True,
        "status": "ok",
        "configured": True,
        "model": model,
    }


def generate_gemini_reply(prompt):
    """Send prompt to Gemini and return (status_code, payload)."""
    status_code, status_payload = get_service_status()
    if status_code != 200:
        return status_code, status_payload

    if not isinstance(prompt, str) or not prompt.strip():
        return 400, {
            "ok": False,
            "error": "Request JSON must include a non-empty 'prompt' string.",
        }

    api_key = _get_api_key()
    model = status_payload["model"]

    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model=model,
            contents=prompt.strip(),
        )
        text = (response.text or "").strip()
        if not text:
            return 502, {
                "ok": False,
                "api": None,
                "error": "Gemini returned an empty response.",
            }
        return 200, {
            "ok": True,
            "status": "ok",
            "response": text,
        }
    except Exception as exc:
        print("CareerAI-API Error:", exc)
        return 502, {
            "ok": False,
            "api": None,
            "error": "Upstream Gemini service failed.",
        }


def _send_json(handler_instance, status_code, payload):
    """Write a JSON HTTP response with CORS headers."""
    body = json.dumps(payload).encode("utf-8")
    handler_instance.send_response(status_code)
    handler_instance.send_header("Content-Type", "application/json; charset=utf-8")
    handler_instance.send_header("Content-Length", str(len(body)))
    handler_instance.send_header("Access-Control-Allow-Origin", "*")
    handler_instance.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    handler_instance.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
    handler_instance.end_headers()
    handler_instance.wfile.write(body)


class handler(BaseHTTPRequestHandler):
    """Vercel Python serverless handler for /api/gemini."""

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_GET(self):
        status_code, payload = get_service_status()
        _send_json(self, status_code, payload)

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length") or 0)
        raw_body = self.rfile.read(content_length) if content_length > 0 else b""
        try:
            data = json.loads(raw_body.decode("utf-8")) if raw_body else {}
        except (UnicodeDecodeError, json.JSONDecodeError):
            _send_json(self, 400, {"ok": False, "error": "Invalid JSON body."})
            return

        if not isinstance(data, dict):
            _send_json(self, 400, {"ok": False, "error": "JSON body must be an object."})
            return

        status_code, payload = generate_gemini_reply(data.get("prompt"))
        _send_json(self, status_code, payload)

