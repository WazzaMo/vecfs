"""
Sparse vector math for search ranking.

Matches ts-src/sparse-vector.ts: dot product, norm, cosine similarity.
Vectors are dicts mapping dimension index (int or str) to float.
"""

from __future__ import annotations

from typing import Any


def _normalize_keys(v: dict[str | int, float]) -> dict[int, float]:
    """Convert string keys to int for consistent iteration."""
    return {int(k): float(x) for k, x in v.items()}


def dot_product(v1: dict[str | int, float], v2: dict[str | int, float]) -> float:
    """Dot product of two sparse vectors. Iterates over the smaller."""
    a, b = _normalize_keys(v1), _normalize_keys(v2)
    if len(a) > len(b):
        a, b = b, a
    return sum(a[i] * b[i] for i in a if i in b)


def norm(v: dict[str | int, float]) -> float:
    """Euclidean norm of a sparse vector."""
    total = sum(x * x for x in _normalize_keys(v).values())
    return total ** 0.5


def cosine_similarity(
    v1: dict[str | int, float],
    v2: dict[str | int, float],
    v1_norm: float | None = None,
) -> float:
    """Cosine similarity between two sparse vectors (0 to 1)."""
    n1 = v1_norm if v1_norm is not None else norm(v1)
    n2 = norm(v2)
    if n1 == 0 or n2 == 0:
        return 0.0
    return dot_product(v1, v2) / (n1 * n2)


def normalize_vector_input(raw: Any) -> dict[int, float]:
    """
    Normalise tool input to sparse dict[int, float].
    Accepts: list of floats (dense) or dict of dimension -> value (sparse).
    Dense is converted by dropping zeros (no L2 here; embedding path does L2).
    """
    if isinstance(raw, list):
        return {i: float(x) for i, x in enumerate(raw) if x != 0}
    if isinstance(raw, dict):
        return _normalize_keys({k: float(v) for k, v in raw.items()})
    raise TypeError("vector must be a list of numbers or a dict of dimension->value")
