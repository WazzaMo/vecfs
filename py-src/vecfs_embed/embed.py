"""
Core embedding logic wrapping Pydantic AI's Embedder.

Handles provider instantiation, dimension settings, and the
dense → sparse pipeline.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Sequence

from pydantic_ai import Embedder
from pydantic_ai.embeddings import EmbeddingSettings

from .sparsify import (
    magnitude_stats,
    sparsity_at_thresholds,
    to_sparse_threshold,
)


@dataclass
class EmbedResult:
    """The output of a single text embedding, ready for VecFS."""

    vector: dict[str, float]
    model: str
    dense_dimensions: int
    non_zero_count: int
    threshold: float

    def to_dict(self) -> dict[str, Any]:
        return {
            "vector": self.vector,
            "model": self.model,
            "dense_dimensions": self.dense_dimensions,
            "non_zero_count": self.non_zero_count,
            "threshold": self.threshold,
        }


@dataclass
class CalibrateResult:
    """The output of a calibration run."""

    model: str
    dense_dimensions: int
    sample_count: int
    magnitude_stats: dict[str, float]
    sparsity_at_thresholds: dict[str, dict[str, float]]

    def to_dict(self) -> dict[str, Any]:
        return {
            "model": self.model,
            "dense_dimensions": self.dense_dimensions,
            "sample_count": self.sample_count,
            "magnitude_stats": {
                k: round(v, 6) for k, v in self.magnitude_stats.items()
            },
            "sparsity_at_thresholds": self.sparsity_at_thresholds,
        }


def _build_embedder(
    model: str,
    dims: int | None = None,
) -> Embedder:
    """Create a Pydantic AI Embedder with optional dimension reduction."""
    settings: EmbeddingSettings | None = None
    if dims is not None:
        settings = {"dimensions": dims}
    return Embedder(model, settings=settings)


async def embed_single(
    text: str,
    *,
    model: str,
    mode: str = "query",
    dims: int | None = None,
    threshold: float = 0.01,
) -> EmbedResult:
    """Embed a single text and return a sparse vector result."""
    embedder = _build_embedder(model, dims)

    if mode == "query":
        result = await embedder.embed_query(text)
    else:
        result = await embedder.embed_documents(text)

    dense = list(result.embeddings[0])
    sparse = to_sparse_threshold(dense, threshold, normalise=True)

    return EmbedResult(
        vector=sparse,
        model=model,
        dense_dimensions=len(dense),
        non_zero_count=len(sparse),
        threshold=threshold,
    )


async def embed_batch(
    texts: Sequence[str],
    *,
    model: str,
    mode: str = "document",
    dims: int | None = None,
    threshold: float = 0.01,
) -> list[EmbedResult]:
    """Embed multiple texts in one call and return sparse vector results."""
    embedder = _build_embedder(model, dims)
    result = await embedder.embed_documents(list(texts))

    results: list[EmbedResult] = []
    for embedding in result.embeddings:
        dense = list(embedding)
        sparse = to_sparse_threshold(dense, threshold, normalise=True)
        results.append(
            EmbedResult(
                vector=sparse,
                model=model,
                dense_dimensions=len(dense),
                non_zero_count=len(sparse),
                threshold=threshold,
            )
        )
    return results


async def calibrate(
    texts: Sequence[str],
    *,
    model: str,
    dims: int | None = None,
) -> CalibrateResult:
    """
    Embed a batch of sample texts and report magnitude statistics
    to help choose a sparsification threshold.
    """
    embedder = _build_embedder(model, dims)
    result = await embedder.embed_documents(list(texts))

    dense_vectors = [list(e) for e in result.embeddings]
    stats = magnitude_stats(dense_vectors)
    sparsity = sparsity_at_thresholds(dense_vectors)

    return CalibrateResult(
        model=model,
        dense_dimensions=len(dense_vectors[0]) if dense_vectors else 0,
        sample_count=len(texts),
        magnitude_stats=stats,
        sparsity_at_thresholds=sparsity,
    )
