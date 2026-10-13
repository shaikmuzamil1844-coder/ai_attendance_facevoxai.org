"""
pipelines/biometric_quality.py — Production quality assessment
Stripped of all streamlit dependencies — pure Python/NumPy/dlib
"""

import numpy as np
from functools import lru_cache
from PIL import Image

import dlib
import face_recognition_models


@lru_cache(maxsize=1)
def load_pose_predictor():
    """Replaces @st.cache_resource"""
    try:
        return dlib.shape_predictor(
            face_recognition_models.pose_predictor_model_location()
        )
    except Exception as e:
        print(f"Error loading pose predictor: {e}")
        return None


def assess_face_quality(image_np, face_box=None):
    """
    Assess quality of a face image or subframe.
    Checks: Blurriness, Brightness, Contrast, Face size, Pose tilt
    """
    if image_np is None or image_np.size == 0:
        return {"score": 0.0, "is_pass": False, "reasons": ["Empty image"], "details": {}}

    if image_np.ndim == 2:
        gray = image_np.astype(np.float32)
    elif image_np.ndim == 3:
        if image_np.shape[2] == 4:
            image_np = image_np[:, :, :3]
        gray = np.dot(image_np[..., :3], [0.2989, 0.5870, 0.1140]).astype(np.float32)
    else:
        return {"score": 0.0, "is_pass": False, "reasons": ["Unsupported image shape"], "details": {}}

    reasons = []
    scores = []

    # 1. Blurriness Check
    if gray.shape[0] > 4 and gray.shape[1] > 4:
        laplacian = (
            gray[:-2, 1:-1] + gray[2:, 1:-1] +
            gray[1:-1, :-2] + gray[1:-1, 2:] -
            4 * gray[1:-1, 1:-1]
        )
        blur_variance = float(np.var(laplacian))
    else:
        blur_variance = 0.0

    if blur_variance < 45.0:
        reasons.append("Image is too blurry. Ensure camera focus and hold still.")
        blur_score = max(0.0, blur_variance / 45.0)
    else:
        blur_score = min(1.0, 0.8 + (blur_variance - 45.0) / 500.0)
    scores.append(blur_score)

    # 2. Brightness & Contrast
    mean_brightness = float(np.mean(gray))
    std_contrast = float(np.std(gray))

    if mean_brightness < 40.0:
        reasons.append("Lighting is too dark.")
        bright_score = max(0.0, mean_brightness / 40.0)
    elif mean_brightness > 225.0:
        reasons.append("Image is overexposed/glared.")
        bright_score = max(0.0, (255.0 - mean_brightness) / 30.0)
    else:
        bright_score = 1.0
    scores.append(bright_score)

    if std_contrast < 18.0:
        reasons.append("Low contrast image.")
        contrast_score = max(0.0, std_contrast / 18.0)
    else:
        contrast_score = 1.0
    scores.append(contrast_score)

    # 3. Face Size Check
    h, w = gray.shape[:2]
    face_area_ratio = 1.0
    if face_box is not None:
        if hasattr(face_box, 'left'):
            fb_w = face_box.width()
            fb_h = face_box.height()
        else:
            fb_left, fb_top, fb_right, fb_bottom = face_box
            fb_w = fb_right - fb_left
            fb_h = fb_bottom - fb_top

        face_area_ratio = (fb_w * fb_h) / (w * h)
        if face_area_ratio < 0.02 or fb_w < 40 or fb_h < 40:
            reasons.append("Face is too far from camera. Move closer.")
            size_score = max(0.0, face_area_ratio / 0.02)
        else:
            size_score = 1.0
        scores.append(size_score)

    # 4. Pose/Tilt Check
    pose_score = 1.0
    if face_box is not None and hasattr(face_box, 'left'):
        sp = load_pose_predictor()
        if sp is not None:
            try:
                img_rgb = image_np.astype(np.uint8) if image_np.dtype != np.uint8 else image_np
                landmarks = sp(img_rgb, face_box)
                left_eye = np.array([landmarks.part(36).x, landmarks.part(36).y])
                right_eye = np.array([landmarks.part(45).x, landmarks.part(45).y])
                eye_delta = right_eye - left_eye
                angle = np.abs(np.degrees(np.arctan2(eye_delta[1], eye_delta[0])))
                if angle > 25.0:
                    reasons.append("Head tilted excessively. Keep head straight.")
                    pose_score = max(0.0, 1.0 - (angle - 25.0) / 45.0)
            except Exception:
                pass
    scores.append(pose_score)

    overall_score = float(np.mean(scores))
    is_pass = overall_score >= 0.65 and len(reasons) == 0

    return {
        "score": round(overall_score, 3),
        "is_pass": is_pass,
        "reasons": reasons,
        "details": {
            "blur_variance": round(blur_variance, 2),
            "mean_brightness": round(mean_brightness, 2),
            "std_contrast": round(std_contrast, 2),
            "face_area_ratio": round(face_area_ratio, 4),
        }
    }


def assess_voice_quality(audio_array, sr=16000):
    """Assess audio signal quality — duration, energy, SNR."""
    if audio_array is None or len(audio_array) == 0:
        return {"score": 0.0, "is_pass": False, "reasons": ["Empty audio stream."], "details": {}}

    audio_array = np.array(audio_array, dtype=np.float32)
    duration = len(audio_array) / float(sr)
    reasons = []

    if duration < 0.6:
        reasons.append(f"Audio too short ({duration:.1f}s). Speak at least 1-2 seconds.")

    rms_energy = float(np.sqrt(np.mean(audio_array ** 2)))
    if rms_energy < 0.005:
        reasons.append("Audio too quiet. Speak closer to the microphone.")

    signal_power = rms_energy ** 2
    noise_est = float(np.percentile(np.abs(audio_array), 10)) ** 2
    snr_db = 10 * np.log10((signal_power + 1e-10) / (noise_est + 1e-10))
    if snr_db < 6.0:
        reasons.append("High background noise detected.")

    is_pass = len(reasons) == 0
    score = 1.0 if is_pass else max(0.2, 1.0 - (0.3 * len(reasons)))

    return {
        "score": round(score, 3),
        "is_pass": is_pass,
        "reasons": reasons,
        "details": {"duration": round(duration, 2), "rms_energy": round(rms_energy, 4), "snr_db": round(snr_db, 2)}
    }
