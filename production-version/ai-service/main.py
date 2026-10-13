"""
main.py — FaceVoxAI AI Microservice
FastAPI server exposing face recognition, voice recognition,
liveness detection, and dual-biometric verification endpoints.

Run: uvicorn main:app --host 0.0.0.0 --port 8000 --reload
"""

import os
import base64
import io
import logging
from typing import Optional

import numpy as np
from PIL import Image
from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

# ── Load environment ────────────────────────────────────────────────────────
load_dotenv()

# ── Pipelines ───────────────────────────────────────────────────────────────
from pipelines.face_pipeline import (
    get_face_embeddings_detailed,
    get_multiframe_face_embeddings,
    verify_face_against_embedding,
)
from pipelines.voice_pipeline import (
    get_voice_embedding,
    verify_voice_against_embedding,
)
from pipelines.liveness_pipeline import detect_liveness_and_spoofing

# ── Logging ─────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("facevoxai-ai-service")

# ── FastAPI App ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="FaceVoxAI AI Microservice",
    description="Real-time face recognition, voice verification, and liveness detection API",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

ALLOWED_ORIGINS = [
    os.getenv("FRONTEND_ORIGIN", "http://localhost:5173"),
    "http://localhost:4000",
    "http://localhost:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

INTERNAL_SECRET    = os.getenv("INTERNAL_API_SECRET", "")
FACE_THRESHOLD     = float(os.getenv("FACE_DISTANCE_THRESHOLD", "0.58"))
VOICE_THRESHOLD    = float(os.getenv("VOICE_SIMILARITY_THRESHOLD", "0.68"))
LIVENESS_REQUIRED  = os.getenv("LIVENESS_REQUIRED", "true").lower() == "true"
LIVENESS_THRESHOLD = float(os.getenv("LIVENESS_CONFIDENCE_THRESHOLD", "0.50"))


# ── Startup: warm up all models ──────────────────────────────────────────────
@app.on_event("startup")
async def warmup_models():
    """Pre-load all biometric models on startup to avoid cold-start latency."""
    logger.info("🔥 Warming up AI models...")
    try:
        from pipelines.face_pipeline import load_dlib_models
        load_dlib_models()
        logger.info("  ✅ Face recognition models loaded (dlib ArcFace 128-D)")
    except Exception as e:
        logger.error(f"  ❌ Face model load failed: {e}")

    try:
        from pipelines.voice_pipeline import load_voice_encoder
        load_voice_encoder()
        logger.info("  ✅ Voice recognition model loaded (Resemblyzer GE2E 256-D)")
    except Exception as e:
        logger.error(f"  ❌ Voice model load failed: {e}")

    logger.info("🚀 FaceVoxAI AI Microservice v2.0.0 ready")

# ── Internal Auth ────────────────────────────────────────────────────────────
def verify_internal_secret(x_internal_secret: Optional[str] = Header(None)):
    """Only Node.js backend can call this service using the shared secret."""
    if INTERNAL_SECRET and x_internal_secret != INTERNAL_SECRET:
        raise HTTPException(status_code=403, detail="Invalid internal API secret.")
    return True


# ── Helpers ──────────────────────────────────────────────────────────────────
def decode_base64_image(b64_string: str) -> np.ndarray:
    """Decode base64-encoded image string to numpy RGB array."""
    try:
        # Strip data URI prefix if present
        if "," in b64_string:
            b64_string = b64_string.split(",", 1)[1]
        img_bytes = base64.b64decode(b64_string)
        img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        return np.array(img, dtype=np.uint8)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image data: {e}")


def decode_base64_audio(b64_string: str) -> bytes:
    """Decode base64-encoded audio string to raw bytes."""
    try:
        if "," in b64_string:
            b64_string = b64_string.split(",", 1)[1]
        return base64.b64decode(b64_string)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid audio data: {e}")


# ════════════════════════════════════════════════════════════════════════════
# REQUEST / RESPONSE MODELS
# ════════════════════════════════════════════════════════════════════════════

class FaceExtractRequest(BaseModel):
    image_b64: str = Field(..., description="Base64-encoded image (JPEG/PNG), with or without data URI prefix")
    check_liveness: bool = Field(default=True)
    enforce_quality: bool = Field(default=False)

class FaceVerifyRequest(BaseModel):
    image_b64: str
    stored_embedding: list[float] = Field(..., description="128-D face embedding stored in DB")
    threshold: Optional[float] = None
    check_liveness: bool = Field(default=True)

class MultiFrameFaceRequest(BaseModel):
    frames_b64: list[str] = Field(..., description="List of 3-5 base64-encoded frames")

class VoiceExtractRequest(BaseModel):
    audio_b64: str = Field(..., description="Base64-encoded audio file (WAV/MP3/OGG)")

class VoiceVerifyRequest(BaseModel):
    audio_b64: str
    stored_embedding: list[float] = Field(..., description="256-D voice embedding stored in DB")
    threshold: Optional[float] = None

class LivenessRequest(BaseModel):
    image_b64: str

class DualVerifyRequest(BaseModel):
    image_b64: str
    audio_b64: str
    face_embedding: list[float]
    voice_embedding: list[float]
    face_threshold: Optional[float] = None
    voice_threshold: Optional[float] = None
    check_liveness: bool = Field(default=True)


# ════════════════════════════════════════════════════════════════════════════
# HEALTH
# ════════════════════════════════════════════════════════════════════════════

@app.get("/api/v1/health", tags=["Health"])
def health_check():
    """Service health check — also warms up model loading."""
    return {
        "status": "ok",
        "service": "FaceVoxAI AI Microservice",
        "version": "2.0.0",
        "models": {
            "face":      "dlib ArcFace (128-D)",
            "voice":     "Resemblyzer GE2E (256-D)",
            "liveness":  "FFT + YCbCr + Glare (passive, no GPU required)",
        },
        "thresholds": {
            "face_distance":         FACE_THRESHOLD,
            "voice_similarity":      VOICE_THRESHOLD,
            "liveness_required":     LIVENESS_REQUIRED,
            "liveness_confidence":   LIVENESS_THRESHOLD,
        },
        "allowed_origins": ALLOWED_ORIGINS,
    }


# ════════════════════════════════════════════════════════════════════════════
# FACE ENDPOINTS
# ════════════════════════════════════════════════════════════════════════════

@app.post("/api/v1/face/extract", tags=["Face"])
def face_extract(req: FaceExtractRequest, _: bool = Depends(verify_internal_secret)):
    """
    Extract 128-D face embedding from a single image.
    Used during ENROLLMENT (registering a new student's face).

    Returns embedding + quality + liveness scores.
    """
    image_np = decode_base64_image(req.image_b64)
    faces = get_face_embeddings_detailed(
        image_np,
        enforce_quality=req.enforce_quality,
        check_liveness=req.check_liveness,
    )

    if not faces:
        raise HTTPException(status_code=422, detail="No face detected in the image.")

    if len(faces) > 1:
        logger.warning(f"Multiple faces ({len(faces)}) detected — returning all embeddings")

    results = []
    for face in faces:
        results.append({
            "embedding": face["encoding"].tolist(),
            "quality": face["quality"],
            "liveness": face["liveness"],
        })

    return {
        "faces_detected": len(results),
        "faces": results,
    }


@app.post("/api/v1/face/verify", tags=["Face"])
def face_verify(req: FaceVerifyRequest, _: bool = Depends(verify_internal_secret)):
    """
    Verify a probe image against a stored embedding (1:1 check).
    Used during ATTENDANCE — compare live face against enrolled embedding.
    """
    image_np = decode_base64_image(req.image_b64)
    faces = get_face_embeddings_detailed(
        image_np,
        enforce_quality=False,
        check_liveness=req.check_liveness,
    )

    if not faces:
        raise HTTPException(status_code=422, detail="No face detected in the image.")

    face = faces[0]
    threshold = req.threshold if req.threshold is not None else FACE_THRESHOLD

    # Liveness gate
    if LIVENESS_REQUIRED and req.check_liveness and not face["liveness"]["is_live"]:
        return {
            "match": False,
            "liveness_failed": True,
            "spoof_reasons": face["liveness"]["spoof_reasons"],
            "distance": None,
            "confidence": 0,
        }

    result = verify_face_against_embedding(face["encoding"], req.stored_embedding, threshold)
    return {
        **result,
        "liveness": face["liveness"],
        "quality": face["quality"],
    }


@app.post("/api/v1/face/extract-multiframe", tags=["Face"])
def face_extract_multiframe(req: MultiFrameFaceRequest, _: bool = Depends(verify_internal_secret)):
    """
    Process 3-5 consecutive frames for high-confidence enrollment.
    Averages embeddings across frames for better accuracy.
    """
    if not req.frames_b64 or len(req.frames_b64) < 2:
        raise HTTPException(status_code=400, detail="At least 2 frames required.")

    image_sequence = [decode_base64_image(f) for f in req.frames_b64]
    results = get_multiframe_face_embeddings(image_sequence)

    if not results:
        raise HTTPException(status_code=422, detail="No face detected across frames.")

    face = results[0]
    return {
        "embedding": face["encoding"].tolist(),
        "liveness": face["liveness"],
        "quality": face["quality"],
        "frames_processed": len(req.frames_b64),
    }


# ════════════════════════════════════════════════════════════════════════════
# VOICE ENDPOINTS
# ════════════════════════════════════════════════════════════════════════════

@app.post("/api/v1/voice/extract", tags=["Voice"])
def voice_extract(req: VoiceExtractRequest, _: bool = Depends(verify_internal_secret)):
    """
    Extract 256-D voice embedding from audio.
    Used during ENROLLMENT — register student's voice print.
    """
    audio_bytes = decode_base64_audio(req.audio_b64)
    result = get_voice_embedding(audio_bytes)

    if result["error"]:
        raise HTTPException(status_code=422, detail=result["error"])

    return {
        "embedding": result["embedding"],
        "quality": result["quality"],
    }


@app.post("/api/v1/voice/verify", tags=["Voice"])
def voice_verify(req: VoiceVerifyRequest, _: bool = Depends(verify_internal_secret)):
    """
    Verify probe audio against a stored voice embedding (1:1 check).
    Used during ATTENDANCE — compare live voice against enrolled voice print.
    """
    audio_bytes = decode_base64_audio(req.audio_b64)
    threshold = req.threshold if req.threshold is not None else VOICE_THRESHOLD
    result = verify_voice_against_embedding(audio_bytes, req.stored_embedding, threshold)

    if result["error"]:
        raise HTTPException(status_code=422, detail=result["error"])

    return result


# ════════════════════════════════════════════════════════════════════════════
# LIVENESS ENDPOINT
# ════════════════════════════════════════════════════════════════════════════

@app.post("/api/v1/liveness/check", tags=["Liveness"])
def liveness_check(req: LivenessRequest, _: bool = Depends(verify_internal_secret)):
    """
    Standalone liveness / anti-spoofing check.
    Detects: printed photos, screen replays, digital moire patterns.
    """
    image_np = decode_base64_image(req.image_b64)
    result = detect_liveness_and_spoofing(image_np)
    return result


# ════════════════════════════════════════════════════════════════════════════
# DUAL VERIFICATION (Face + Voice Combined)
# ════════════════════════════════════════════════════════════════════════════

@app.post("/api/v1/dual/verify", tags=["Dual"])
def dual_verify(req: DualVerifyRequest, _: bool = Depends(verify_internal_secret)):
    """
    Combined face + voice biometric verification.
    Both must pass for a positive identity confirmation.
    This is the MOST SECURE attendance mode.

    Logic:
      - Face match  ✅  AND  Voice match  ✅  → dual_match = True  (high confidence)
      - Face match  ✅  AND  Voice fail   ❌  → dual_match = False (security alert)
      - Face fail   ❌  AND  Voice match  ✅  → dual_match = False
      - Both fail   ❌❌                    → dual_match = False
    """
    # ── Face verification ──
    image_np = decode_base64_image(req.image_b64)
    faces = get_face_embeddings_detailed(image_np, enforce_quality=False, check_liveness=req.check_liveness)

    if not faces:
        return {
            "dual_match": False,
            "face": {"match": False, "error": "No face detected"},
            "voice": {"match": False},
            "combined_confidence": 0,
        }

    face = faces[0]
    face_threshold = req.face_threshold if req.face_threshold is not None else FACE_THRESHOLD
    face_result = verify_face_against_embedding(face["encoding"], req.face_embedding, face_threshold)

    # Liveness gate
    if LIVENESS_REQUIRED and req.check_liveness and not face["liveness"]["is_live"]:
        return {
            "dual_match": False,
            "face": {**face_result, "liveness_failed": True, "spoof_reasons": face["liveness"]["spoof_reasons"]},
            "voice": {"match": False, "reason": "skipped — liveness failed"},
            "combined_confidence": 0,
        }

    # ── Voice verification ──
    audio_bytes = decode_base64_audio(req.audio_b64)
    voice_threshold = req.voice_threshold if req.voice_threshold is not None else VOICE_THRESHOLD
    voice_result = verify_voice_against_embedding(audio_bytes, req.voice_embedding, voice_threshold)

    # ── Combined decision ──
    dual_match = face_result["match"] and voice_result.get("match", False)
    face_conf = face_result.get("confidence", 0)
    voice_sim = voice_result.get("similarity", 0.0)
    combined_confidence = int((face_conf * 0.6) + (voice_sim * 100 * 0.4)) if dual_match else 0

    return {
        "dual_match": dual_match,
        "face": {**face_result, "liveness": face["liveness"], "quality": face["quality"]},
        "voice": voice_result,
        "combined_confidence": combined_confidence,
    }
