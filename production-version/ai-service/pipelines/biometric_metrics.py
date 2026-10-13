"""
pipelines/biometric_metrics.py — Production biometric metrics
Stripped of all streamlit dependencies — pure Python/NumPy
"""

import numpy as np
from itertools import combinations


def evaluate_matching_performance(X_embeddings, y_labels, thresholds=None):
    """Evaluate FAR, FRR, EER and optimal threshold for stored embeddings."""
    if not X_embeddings or not y_labels or len(X_embeddings) < 2:
        return {"optimal_threshold": 0.60, "eer": 0.0, "best_f1": 0.0, "metrics_by_threshold": []}

    X = [np.array(e, dtype=np.float32) for e in X_embeddings]
    y = list(y_labels)

    X_norm = []
    for vec in X:
        norm = np.linalg.norm(vec)
        X_norm.append(vec / norm if norm > 1e-10 else vec)

    pairs = list(combinations(range(len(y)), 2))
    pos_distances, neg_distances = [], []

    for i, j in pairs:
        dist = float(np.linalg.norm(X_norm[i] - X_norm[j]))
        (pos_distances if y[i] == y[j] else neg_distances).append(dist)

    if not pos_distances or not neg_distances:
        return {"optimal_threshold": 0.60, "eer": 0.0, "best_f1": 1.0 if pos_distances else 0.0, "metrics_by_threshold": []}

    if thresholds is None:
        thresholds = np.linspace(0.30, 0.90, 61)

    results = []
    best_f1 = -1.0
    optimal_thresh = 0.60
    min_far_frr_diff = 1.0
    eer_val = 0.0
    num_pos, num_neg = len(pos_distances), len(neg_distances)

    for t in thresholds:
        tp = sum(1 for d in pos_distances if d <= t)
        fn = num_pos - tp
        fp = sum(1 for d in neg_distances if d <= t)
        tn = num_neg - fp

        far = fp / float(num_neg) if num_neg > 0 else 0.0
        frr = fn / float(num_pos) if num_pos > 0 else 0.0
        precision = tp / float(tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / float(tp + fn) if (tp + fn) > 0 else 0.0
        f1 = (2 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0

        diff = abs(far - frr)
        if diff < min_far_frr_diff:
            min_far_frr_diff = diff
            eer_val = (far + frr) / 2.0

        if f1 > best_f1:
            best_f1 = f1
            optimal_thresh = float(t)

        results.append({"threshold": round(float(t), 3), "far": round(far, 4), "frr": round(frr, 4),
                        "f1": round(f1, 4), "tp": tp, "fp": fp, "fn": fn, "tn": tn})

    return {"optimal_threshold": round(optimal_thresh, 3), "eer": round(eer_val, 4),
            "best_f1": round(best_f1, 4), "metrics_by_threshold": results}


def calibrate_adaptive_threshold(X_embeddings, y_labels, default_threshold=0.60):
    """Compute adaptive distance threshold for DB embeddings."""
    res = evaluate_matching_performance(X_embeddings, y_labels)
    opt_t = res.get("optimal_threshold", default_threshold)
    return opt_t, 0.12
