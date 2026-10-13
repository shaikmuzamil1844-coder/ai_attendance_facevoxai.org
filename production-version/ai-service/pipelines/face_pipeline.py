"""
pipelines/face_pipeline.py — Production face recognition pipeline
Stripped of all streamlit dependencies — pure Python/NumPy/dlib
Same logic as original Streamlit project face_pipeline.py
"""

import numpy as np
from functools import lru_cache
from PIL import Image

import dlib
import face_recognition_models

from .biometric_quality import assess_face_quality
from .liveness_pipeline import detect_liveness_and_spoofing, evaluate_multiframe_liveness
from .biometric_metrics import calibrate_adaptive_threshold


@lru_cache(maxsize=1)
def load_dlib_models():
    """Load dlib models once and cache — replaces @st.cache_resource"""
    detector = dlib.get_frontal_face_detector()
    sp = dlib.shape_predictor(
        face_recognition_models.pose_predictor_model_location()
    )
    facerec = dlib.face_recognition_model_v1(
        face_recognition_models.face_recognition_model_location()
    )
    return detector, sp, facerec


def get_face_embeddings_detailed(image_np, enforce_quality=False, check_liveness=False):
    """
    Extract 128-D face embeddings along with quality scores & liveness checks.

    Returns:
      list of dicts: [
        {
          "encoding": np.ndarray (128,),
          "box": dlib.rectangle,
          "quality": dict,
          "liveness": dict
        }, ...
      ]
    """
    if image_np is None:
        return []

    # Ensure 3-channel uint8 RGB array
    if image_np.ndim == 2:
        image_np = np.stack([image_np] * 3, axis=-1)
    elif image_np.ndim == 3 and image_np.shape[2] == 4:
        image_np = image_np[:, :, :3]
    if image_np.dtype != np.uint8:
        image_np = image_np.astype(np.uint8)

    try:
        h, w = image_np.shape[:2]
        if w > 800:
            new_h = int(h * (800.0 / w))
            img_pil = Image.fromarray(image_np).resize((800, new_h), Image.Resampling.LANCZOS)
            detect_img = np.array(img_pil)
        else:
            detect_img = image_np

        detector, sp, facerec = load_dlib_models()
        faces = detector(detect_img, 1)
        if len(faces) == 0:
            faces = detector(detect_img, 2)
        if len(faces) == 0 and w > 800:
            faces = detector(image_np, 1)
            detect_img = image_np

        results = []
        for face in faces:
            quality_res = assess_face_quality(detect_img, face)
            liveness_res = (
                detect_liveness_and_spoofing(detect_img, face)
                if check_liveness
                else {"is_live": True, "confidence": 1.0, "spoof_reasons": []}
            )

            if enforce_quality and not quality_res["is_pass"]:
                continue

            shape = sp(detect_img, face)
            descriptor = facerec.compute_face_descriptor(detect_img, shape, 1)
            encoding = np.array(descriptor, dtype=np.float32)

            results.append({
                "encoding": encoding,
                "box": face,
                "quality": quality_res,
                "liveness": liveness_res,
            })

        return results

    except Exception as e:
        print(f"Face extraction detailed error: {e}")
        return []


def get_face_embeddings(image_np):
    """Legacy function — returns raw 128-D numpy encodings."""
    detailed = get_face_embeddings_detailed(image_np, enforce_quality=False, check_liveness=False)
    return [item["encoding"] for item in detailed]


def get_multiframe_face_embeddings(image_sequence):
    """
    Process multi-frame camera inputs for higher confidence liveness.
    Averages facial descriptors across 3-5 frames.
    """
    if not image_sequence:
        return []

    detailed_frames = []
    all_boxes = []

    for img in image_sequence:
        items = get_face_embeddings_detailed(img, enforce_quality=False, check_liveness=True)
        if items:
            detailed_frames.append(items[0]["encoding"])
            all_boxes.append(items[0]["box"])

    if not detailed_frames:
        return []

    liveness_multi = evaluate_multiframe_liveness(image_sequence, all_boxes)

    arr = np.array(detailed_frames, dtype=np.float32)
    mean_emb = np.mean(arr, axis=0)
    norm = np.linalg.norm(mean_emb)
    if norm > 1e-10:
        mean_emb = mean_emb / norm

    return [{
        "encoding": mean_emb,
        "box": all_boxes[0] if all_boxes else None,
        "quality": {"is_pass": True, "score": 0.95, "reasons": []},
        "liveness": liveness_multi,
    }]


def verify_face_against_embedding(probe_encoding: np.ndarray, stored_embedding: list, threshold: float = 0.58) -> dict:
    """
    Verify a probe face encoding against a single stored embedding.
    Used for 1:1 identity verification (not 1:N search).

    Returns:
      { "match": bool, "distance": float, "confidence": int (0-100) }
    """
    stored = np.array(stored_embedding, dtype=np.float32)
    norm_probe = probe_encoding / (np.linalg.norm(probe_encoding) + 1e-10)
    norm_stored = stored / (np.linalg.norm(stored) + 1e-10)
    distance = float(np.linalg.norm(norm_stored - norm_probe))
    match = distance <= threshold
    confidence = max(0, min(100, int((1.0 - (distance / threshold)) * 100))) if match else 0
    return {"match": match, "distance": round(distance, 4), "confidence": confidence}
