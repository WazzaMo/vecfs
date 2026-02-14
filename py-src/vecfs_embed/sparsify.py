"""
Dense-to-sparse vector conversion and calibration utilities.

This module mirrors the logic of ts-src/sparse-vector.ts in Python
and operates independently of any embedding model.
"""

from __future__ import annotations

import math
from typing import Sequence


def l2_normalise(dense: Sequence[float]) -> list[float]:
    """
    L2-normalise a dense vector so its magnitude is 1.

    Returns a zero vector unchanged to avoid division by zero.
    """
    norm = math.sqrt(sum(v * v for v in dense))
    if norm == 0.0:
        return list(dense)
    return [v / norm for v in dense]


def to_sparse_threshold(
    dense: Sequence[float],
    threshold: float = 0.01,
    *,
    normalise: bool = True,
) -> dict[str, float]:
    """
    Convert a dense vector to a sparse dict by dropping components
    whose absolute value falls below *threshold*.

    Keys are stringified dimension indices (matching VecFS JSON format).
    If *normalise* is True the vector is L2-normalised first.
    """
    values = l2_normalise(dense) if normalise else list(dense)
    return {
        str(i): v
        for i, v in enumerate(values)
        if abs(v) > threshold
    }


def to_sparse_topk(
    dense: Sequence[float],
    k: int,
    *,
    normalise: bool = True,
) -> dict[str, float]:
    """
    Convert a dense vector to a sparse dict by keeping only the *k*
    largest-magnitude components.

    Keys are stringified dimension indices.
    """
    values = l2_normalise(dense) if normalise else list(dense)
    indexed = sorted(enumerate(values), key=lambda iv: abs(iv[1]), reverse=True)
    return {str(i): v for i, v in indexed[:k] if v != 0.0}


def magnitude_stats(vectors: list[list[float]]) -> dict:
    """
    Compute magnitude statistics across a batch of dense vectors.

    Used by the ``--calibrate`` mode to help choose a threshold.
    Each vector is L2-normalised before collecting magnitudes.
    """
    all_magnitudes: list[float] = []
    for dense in vectors:
        normed = l2_normalise(dense)
        all_magnitudes.extend(abs(v) for v in normed)

    if not all_magnitudes:
        return {}

    all_magnitudes.sort()
    n = len(all_magnitudes)

    def percentile(p: float) -> float:
        idx = int(p / 100.0 * (n - 1))
        return all_magnitudes[idx]

    return {
        "min": all_magnitudes[0],
        "max": all_magnitudes[-1],
        "mean": sum(all_magnitudes) / n,
        "p10": percentile(10),
        "p25": percentile(25),
        "p50": percentile(50),
        "p75": percentile(75),
        "p90": percentile(90),
    }


def sparsity_at_thresholds(
    vectors: list[list[float]],
    thresholds: Sequence[float] = (0.001, 0.005, 0.01, 0.02, 0.05),
) -> dict[str, dict[str, float]]:
    """
    For each threshold, report the mean percentage of dimensions retained
    across a batch of vectors.
    """
    results: dict[str, dict[str, float]] = {}
    for t in thresholds:
        retained_pcts: list[float] = []
        for dense in vectors:
            normed = l2_normalise(dense)
            total = len(normed)
            kept = sum(1 for v in normed if abs(v) > t)
            retained_pcts.append((kept / total * 100) if total else 0.0)
        mean_pct = sum(retained_pcts) / len(retained_pcts) if retained_pcts else 0.0
        results[str(t)] = {"mean_retained_pct": round(mean_pct, 1)}
    return results
