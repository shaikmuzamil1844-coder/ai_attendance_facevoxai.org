"""
pipelines/voice_pipeline.py — Production voice recognition pipeline
Stripped of all streamlit dependencies — pure Python/NumPy/resemblyzer
"""

import numpy as np
import io
from functools import lru_cache

import librosa
from resemblyzer import VoiceEncoder, preprocess_wav

from .biometric_quality import assess_voice_quality


@lru_cache(maxsize=1)
def load_voice_encoder():
    """Load Resemblyzer encoder once — replaces @st.cache_resource"""
    return VoiceEncoder()


def _normalize(vec):
    """L2-normalize a vector for cosine similarity."""
    arr = np.array(vec, dtype=np.float32)
    norm = np.linalg.norm(arr)
    return arr if norm < 1e-10 else arr / norm


def get_voice_embedding(audio_bytes: bytes) -> dict:
    """
    Extract 256-D voice embedding from raw audio bytes.

    Returns:
      { "embedding": list[float] | None, "quality": dict, "error": str | None }
    """
    if not audio_bytes:
        return {"embedding": None, "quality": {}, "error": "No audio data received."}

    try:
        encoder = load_voice_encoder()
        audio, sr = librosa.load(io.BytesIO(audio_bytes), sr=16000)

        quality_res = assess_voice_quality(audio, sr)

        wav = preprocess_wav(audio)
        if len(wav) < sr * 0.5:
            return {"embedding": None, "quality": quality_res, "error": "Speech too short for reliable verification."}

        embedding = encoder.embed_utterance(wav)
        return {"embedding": embedding.tolist(), "quality": quality_res, "error": None}

    except Exception as e:
        return {"embedding": None, "quality": {}, "error": f"Voice embedding error: {e}"}


def identify_speaker(new_embedding, candidates_dict: dict) -> dict:
    """
    Compare a new voice embedding against multiple candidates.
    Returns cosine similarity scores for each candidate.
    """
    if new_embedding is None or not candidates_dict:
        return {}

    new_vec = _normalize(new_embedding)
    scores = {}

    for sid, stored_embedding in candidates_dict.items():
        if stored_embedding:
            if isinstance(stored_embedding, list) and len(stored_embedding) > 0 and isinstance(stored_embedding[0], list):
                sample_scores = [float(np.dot(new_vec, _normalize(sample))) for sample in stored_embedding]
                scores[sid] = max(sample_scores)
            else:
                scores[sid] = float(np.dot(new_vec, _normalize(stored_embedding)))
        else:
            scores[sid] = 0.0

    return scores


def verify_voice_against_embedding(probe_bytes: bytes, stored_embedding: list, threshold: float = 0.68) -> dict:
    """
    1:1 voice verification — compare probe audio against one stored embedding.

    Returns:
      { "match": bool, "similarity": float, "quality": dict, "error": str | None }
    """
    result = get_voice_embedding(probe_bytes)
    if result["error"] or result["embedding"] is None:
        return {"match": False, "similarity": 0.0, "quality": result.get("quality", {}), "error": result["error"]}

    probe_vec = _normalize(result["embedding"])
    stored_vec = _normalize(stored_embedding)
    similarity = float(np.dot(probe_vec, stored_vec))
    match = similarity >= threshold

    return {
        "match": match,
        "similarity": round(similarity, 4),
        "quality": result["quality"],
        "error": None,
    }


def process_bulk_voice(audio_bytes: bytes, candidates_dict: dict, threshold: float = 0.68) -> dict:
    """
    Process classroom audio: evaluate full utterance + speech segments.
    Returns highest similarity score per student across segments.
    """
    if not audio_bytes or not candidates_dict:
        return {}

    try:
        encoder = load_voice_encoder()
        audio, sr = librosa.load(io.BytesIO(audio_bytes), sr=16000)
        if len(audio) == 0:
            return {}

        quality_res = assess_voice_quality(audio, sr)
        detected_scores = {sid: 0.0 for sid in candidates_dict.keys()}

        def evaluate_chunk(chunk_audio):
            try:
                wav = preprocess_wav(chunk_audio)
                if len(wav) < sr * 0.4:
                    return
                emb = encoder.embed_utterance(wav)
                scores = identify_speaker(emb.tolist(), candidates_dict)
                for sid, score in scores.items():
                    if score > detected_scores[sid]:
                        detected_scores[sid] = float(score)
            except Exception as e:
                print(f"Voice segment error: {e}")

        evaluate_chunk(audio)

        try:
            segments = librosa.effects.split(audio, top_db=20)
            for start, end in segments:
                if (end - start) >= sr * 0.4:
                    evaluate_chunk(audio[start:end])
        except Exception as e:
            print(f"Speech split error: {e}")

        return detected_scores

    except Exception as e:
        print(f"Voice processing error: {e}")
        return {}