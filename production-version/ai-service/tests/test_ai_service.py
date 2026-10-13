"""
tests/test_ai_service.py — FaceVoxAI AI Service Tests
Run: python tests/test_ai_service.py

Tests:
  ✅ Health endpoint
  ✅ Face extract (valid base64 image)
  ✅ Liveness check
  ✅ Voice extract (valid WAV bytes)
  ✅ Internal secret auth rejection
  ✅ Invalid base64 rejection
"""

import sys
import json
import base64
import io
import time
import urllib.request
import urllib.error
import struct
from PIL import Image

# Fix Windows console UTF-8 encoding
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

BASE    = "http://localhost:8000"
SECRET  = "facevoxai_internal_ai_service_secret_key_2025"
passed  = 0
failed  = 0


def make_request(method, path, body=None, token=None):
    """Simple HTTP helper — no external deps."""
    url = BASE + path
    headers = {"Content-Type": "application/json"}
    if token:
        headers["x-internal-secret"] = token

    data = json.dumps(body).encode() if body else None
    req  = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode())
        except Exception:
            return e.code, {}
    except urllib.error.URLError as e:
        raise ConnectionError(f"Cannot connect to AI service at {BASE}: {e.reason}")


def _run_test(name, fn):
    global passed, failed
    try:
        fn()
        print(f"  ✅ PASS: {name}")
        passed += 1
    except Exception as e:
        print(f"  ❌ FAIL: {name}\n     {e}")
        failed += 1


def assert_(cond, msg="Assertion failed"):
    if not cond:
        raise AssertionError(msg)


# ─── Valid Test Media ────────────────────────────────────────────────────────
def make_test_image_b64(width=64, height=64, color=(200, 180, 160)):
    """Generate a valid test JPEG image."""
    img = Image.new("RGB", (width, height), color=color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return base64.b64encode(buf.getvalue()).decode()

TEST_IMAGE_B64 = make_test_image_b64()


def make_silent_wav(duration_s=1, sample_rate=16000):
    """Generate a minimal valid silent WAV file."""
    n_samples = sample_rate * duration_s
    data_size  = n_samples * 2  # 16-bit
    header = struct.pack('<4sI4s4sIHHIIHH4sI',
        b'RIFF', 36 + data_size, b'WAVE',
        b'fmt ', 16, 1, 1,
        sample_rate, sample_rate * 2, 2, 16,
        b'data', data_size,
    )
    samples = bytes(data_size)
    wav = header + samples
    return base64.b64encode(wav).decode()

SILENT_WAV_B64 = make_silent_wav(duration_s=1)


# ─── Tests ─────────────────────────────────────────────────────────────────────

def _record_pass(name):
    global passed
    print(f"  ✅ PASS: {name}")
    passed += 1

def test_health():
    print("\n📡 Health Check")
    status, body = make_request("GET", "/api/v1/health")
    assert_(status == 200, f"Expected 200, got {status}")
    assert_(body.get("status") == "ok", "Expected status: ok")
    assert_(body.get("version"), "Expected version field")
    _record_pass("GET /api/v1/health returns 200")

    models = body.get("models", {})
    assert_("face" in models, "Expected face model info")
    assert_("voice" in models, "Expected voice model info")
    _record_pass("Health includes model metadata")


def test_auth():
    print("\n🔐 Internal Auth")
    status, body = make_request("POST", "/api/v1/liveness/check", {"image_b64": TEST_IMAGE_B64})
    assert_(status == 403, f"Expected 403 without secret, got {status}")
    _record_pass("Endpoints reject requests without internal secret")

    status, body = make_request("POST", "/api/v1/liveness/check", {"image_b64": TEST_IMAGE_B64}, token="wrong_secret")
    assert_(status == 403, f"Expected 403 with wrong secret, got {status}")
    _record_pass("Endpoints reject requests with wrong secret")


def test_face():
    print("\n📸 Face Endpoints")
    status, body = make_request("POST", "/api/v1/face/extract", {"image_b64": TEST_IMAGE_B64, "check_liveness": False}, token=SECRET)
    assert_(status in (200, 400, 422), f"Expected 200, 400 or 422, got {status}")
    _record_pass("POST /api/v1/face/extract handles blank image gracefully")

    status, body = make_request("POST", "/api/v1/face/extract", {"image_b64": "NOT_VALID_BASE64!!!"}, token=SECRET)
    assert_(status == 400, f"Expected 400 for invalid base64, got {status}")
    _record_pass("POST /api/v1/face/extract rejects invalid base64")

    status, body = make_request("POST", "/api/v1/face/extract-multiframe", {"frames_b64": [TEST_IMAGE_B64]}, token=SECRET)
    assert_(status == 400, f"Expected 400 for <2 frames, got {status}")
    _record_pass("POST /api/v1/face/extract-multiframe requires ≥2 frames")


def test_voice():
    print("\n🎤 Voice Endpoints")
    status, body = make_request("POST", "/api/v1/voice/extract", {"audio_b64": SILENT_WAV_B64}, token=SECRET)
    assert_(status in (200, 422), f"Expected 200 or 422, got {status}")
    _record_pass("POST /api/v1/voice/extract handles silent WAV gracefully")

    status, body = make_request("POST", "/api/v1/voice/extract", {"audio_b64": "INVALID_AUDIO_DATA"}, token=SECRET)
    assert_(status in (400, 422), f"Expected 400 or 422 for invalid audio, got {status}")
    _record_pass("POST /api/v1/voice/extract rejects invalid audio data")


def test_liveness():
    print("\n👁 Liveness Endpoint")
    status, body = make_request("POST", "/api/v1/liveness/check", {"image_b64": TEST_IMAGE_B64}, token=SECRET)
    assert_(status == 200, f"Expected 200, got {status}")
    assert_("is_live" in body, "Expected is_live field")
    assert_("confidence" in body, "Expected confidence field")
    assert_("spoof_reasons" in body, "Expected spoof_reasons field")
    _record_pass("POST /api/v1/liveness/check returns liveness analysis")

    assert_(isinstance(body.get("is_live"), bool), "is_live should be bool")
    assert_(0.0 <= body.get("confidence", -1) <= 1.0, "confidence should be 0.0–1.0")
    _record_pass("Liveness confidence is in range [0.0, 1.0]")


# ─── Main ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("═══════════════════════════════════════════════")
    print("  FaceVoxAI AI Service Tests v2")
    print(f"  Target: {BASE}")
    print("═══════════════════════════════════════════════")

    try:
        test_health()
        test_auth()
        test_face()
        test_voice()
        test_liveness()
    except ConnectionError as e:
        print(f"\n❌ Cannot connect: {e}")
        print("   Make sure the AI service is running: uvicorn main:app --port 8000")
        sys.exit(1)

    print("\n═══════════════════════════════════════════════")
    print(f"  Results: {passed} passed, {failed} failed")
    print("═══════════════════════════════════════════════\n")

    sys.exit(1 if failed > 0 else 0)
