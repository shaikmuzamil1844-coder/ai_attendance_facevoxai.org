"""
pipelines/liveness_pipeline.py — Production liveness & anti-spoofing
Stripped of all streamlit dependencies — pure Python/NumPy/dlib
"""

import numpy as np
from functools import lru_cache

import dlib
import face_recognition_models


@lru_cache(maxsize=1)
def load_liveness_pose_predictor():
    """Replaces @st.cache_resource"""
    try:
        return dlib.shape_predictor(
            face_recognition_models.pose_predictor_model_location()
        )
    except Exception as e:
        print(f"Liveness pose predictor load error: {e}")
        return None


def calculate_eye_aspect_ratio(eye_landmarks):
    """EAR = (|p2-p6| + |p3-p5|) / (2 * |p1-p4|)"""
    p1, p2, p3, p4, p5, p6 = eye_landmarks
    v1 = np.linalg.norm(p2 - p6)
    v2 = np.linalg.norm(p3 - p5)
    h = np.linalg.norm(p1 - p4)
    if h < 1e-6:
        return 0.0
    return (v1 + v2) / (2.0 * h)


def detect_liveness_and_spoofing(image_np, face_box=None):
    """
    Passive Liveness & Anti-Spoofing Detection for single frame:
    1. FFT Frequency Spectrum Analysis (detects moire, screen pixels)
    2. YCbCr Skin Chrominance Gamut Analysis (detects paper prints & screens)
    3. Specular Glare / Screen Highlight Detection
    """
    if image_np is None or image_np.size == 0:
        return {"is_live": False, "confidence": 0.0, "spoof_reasons": ["Empty image"], "details": {}}

    img_rgb = image_np.astype(np.uint8) if image_np.dtype != np.uint8 else image_np
    if img_rgb.ndim == 3 and img_rgb.shape[2] == 4:
        img_rgb = img_rgb[:, :, :3]

    h_img, w_img = img_rgb.shape[:2]

    # Crop to face region
    if face_box is not None:
        if hasattr(face_box, 'left'):
            left, top = max(0, face_box.left()), max(0, face_box.top())
            right, bottom = min(w_img, face_box.right()), min(h_img, face_box.bottom())
        else:
            left, top, right, bottom = (
                max(0, face_box[0]), max(0, face_box[1]),
                min(w_img, face_box[2]), min(h_img, face_box[3])
            )
        face_crop = img_rgb[top:bottom, left:right] if (right > left + 10 and bottom > top + 10) else img_rgb
    else:
        face_crop = img_rgb

    spoof_reasons = []
    confidence_scores = []

    # 1. FFT Frequency Analysis
    gray_crop = np.dot(face_crop[..., :3], [0.2989, 0.5870, 0.1140]).astype(np.float32)
    ch, cw = gray_crop.shape[:2]
    freq_ratio = 0.1

    if ch >= 32 and cw >= 32:
        fft_shift = np.fft.fftshift(np.fft.fft2(gray_crop))
        magnitude_spectrum = np.abs(fft_shift)
        cy, cx = ch // 2, cw // 2
        r_inner, r_outer = min(cy, cx) // 4, min(cy, cx) // 2
        y, x = np.ogrid[:ch, :cw]
        dist = np.sqrt((x - cx)**2 + (y - cy)**2)
        low_freq_energy = np.sum(magnitude_spectrum[dist <= r_inner])
        high_freq_energy = np.sum(magnitude_spectrum[(dist > r_inner) & (dist <= r_outer)])
        freq_ratio = high_freq_energy / (low_freq_energy + 1e-6)

        if freq_ratio > 0.95:
            spoof_reasons.append("Digital screen pixel pattern / Moire effect detected.")
            fft_score = 0.3
        elif freq_ratio < 0.005:
            spoof_reasons.append("Unnaturally flat texture (printed photo or smoothed screen).")
            fft_score = 0.4
        else:
            fft_score = 0.95
    else:
        fft_score = 0.85
    confidence_scores.append(fft_score)

    # 2. Skin Chrominance (YCbCr)
    r = face_crop[:, :, 0].astype(np.float32)
    g = face_crop[:, :, 1].astype(np.float32)
    b = face_crop[:, :, 2].astype(np.float32)
    cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b
    cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b
    skin_mask = (cb >= 70) & (cb <= 135) & (cr >= 125) & (cr <= 180)
    skin_ratio = np.mean(skin_mask)

    if skin_ratio < 0.10:
        spoof_reasons.append("Skin color distribution invalid (suspected print or display).")
        chroma_score = max(0.2, skin_ratio / 0.10)
    else:
        chroma_score = 1.0
    confidence_scores.append(chroma_score)

    # 3. Specular Glare
    max_channel = np.maximum(np.maximum(r, g), b)
    specular_pixels = (max_channel >= 252) & ((np.abs(r - g) < 8) & (np.abs(g - b) < 8))
    glare_ratio = np.mean(specular_pixels)
    if glare_ratio > 0.25:
        spoof_reasons.append("High specular reflection / glass glare detected.")
        glare_score = max(0.2, 1.0 - (glare_ratio / 0.25))
    else:
        glare_score = 1.0
    confidence_scores.append(glare_score)

    overall_confidence = float(np.mean(confidence_scores))
    # Legitimate live face has high overall confidence and at most 0 or 1 edge condition
    is_live = overall_confidence >= 0.50 and len(spoof_reasons) <= 1

    return {
        "is_live": is_live,
        "confidence": round(overall_confidence, 3),
        "spoof_reasons": spoof_reasons,
        "details": {
            "fft_freq_ratio": round(float(freq_ratio), 4),
            "skin_chroma_ratio": round(float(skin_ratio), 4),
            "glare_ratio": round(float(glare_ratio), 4),
        }
    }


def evaluate_multiframe_liveness(image_list, face_boxes=None):
    """Multi-frame liveness: checks natural micro-motion + EAR blink variation."""
    if not image_list or len(image_list) < 2:
        single_img = image_list[0] if image_list else None
        single_box = face_boxes[0] if (face_boxes and len(face_boxes) > 0) else None
        return detect_liveness_and_spoofing(single_img, single_box)

    sp = load_liveness_pose_predictor()
    ear_values, landmarks_centers, frame_confidences, all_reasons = [], [], [], set()

    for idx, img in enumerate(image_list):
        box = face_boxes[idx] if (face_boxes and idx < len(face_boxes)) else None
        res = detect_liveness_and_spoofing(img, box)
        frame_confidences.append(res["confidence"])
        for r in res["spoof_reasons"]:
            all_reasons.add(r)

        if sp is not None and box is not None and hasattr(box, 'left'):
            try:
                landmarks = sp(img, box)
                l_eye = np.array([[landmarks.part(i).x, landmarks.part(i).y] for i in range(36, 42)])
                r_eye = np.array([[landmarks.part(i).x, landmarks.part(i).y] for i in range(42, 48)])
                ear_values.append((calculate_eye_aspect_ratio(l_eye) + calculate_eye_aspect_ratio(r_eye)) / 2.0)
                landmarks_centers.append([landmarks.part(30).x, landmarks.part(30).y])
            except Exception:
                pass

    ear_var = float(np.var(ear_values)) if len(ear_values) >= 2 else 0.0
    mean_motion = float(np.mean([
        np.linalg.norm(np.array(landmarks_centers[i]) - np.array(landmarks_centers[i-1]))
        for i in range(1, len(landmarks_centers))
    ])) if len(landmarks_centers) >= 2 else 0.0

    avg_confidence = float(np.mean(frame_confidences)) if frame_confidences else 0.0

    if len(image_list) >= 3 and mean_motion < 0.1 and ear_var < 1e-5:
        all_reasons.add("Static photo presentation detected (zero natural motion).")
        is_live = False
        avg_confidence = min(avg_confidence, 0.4)
    else:
        is_live = avg_confidence >= 0.65 and len(all_reasons) == 0

    return {
        "is_live": is_live,
        "confidence": round(avg_confidence, 3),
        "spoof_reasons": list(all_reasons),
        "details": {"ear_variance": round(ear_var, 6), "mean_micro_motion": round(mean_motion, 2), "frames_analyzed": len(image_list)}
    }
