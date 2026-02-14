"""Tests for the sparsify module — pure Python, no embedding model needed."""

from __future__ import annotations

import math

import pytest

from vecfs_embed.sparsify import (
    l2_normalise,
    magnitude_stats,
    sparsity_at_thresholds,
    to_sparse_threshold,
    to_sparse_topk,
)


class TestL2Normalise:
    def test_unit_vector_unchanged(self) -> None:
        vec = [1.0, 0.0, 0.0]
        result = l2_normalise(vec)
        assert result == pytest.approx([1.0, 0.0, 0.0])

    def test_normalises_to_unit_length(self) -> None:
        vec = [3.0, 4.0]
        result = l2_normalise(vec)
        assert result == pytest.approx([0.6, 0.8])
        assert math.isclose(sum(v * v for v in result), 1.0)

    def test_zero_vector_returns_zero(self) -> None:
        result = l2_normalise([0.0, 0.0, 0.0])
        assert result == [0.0, 0.0, 0.0]

    def test_negative_values(self) -> None:
        vec = [-3.0, 4.0]
        result = l2_normalise(vec)
        assert result == pytest.approx([-0.6, 0.8])


class TestToSparseThreshold:
    def test_drops_below_threshold(self) -> None:
        dense = [0.5, 0.0, 0.0, 0.5]  # after L2 norm: [~0.707, 0, 0, ~0.707]
        sparse = to_sparse_threshold(dense, threshold=0.01)
        assert "1" not in sparse
        assert "2" not in sparse
        assert len(sparse) == 2

    def test_threshold_zero_keeps_all_nonzero(self) -> None:
        dense = [0.001, 0.0, 0.999]
        sparse = to_sparse_threshold(dense, threshold=0.0)
        assert "0" in sparse
        assert "1" not in sparse
        assert "2" in sparse

    def test_empty_vector(self) -> None:
        assert to_sparse_threshold([], threshold=0.01) == {}

    def test_keys_are_strings(self) -> None:
        sparse = to_sparse_threshold([1.0, 0.0, 1.0], threshold=0.0)
        for key in sparse:
            assert isinstance(key, str)

    def test_no_normalise_flag(self) -> None:
        dense = [0.005, 0.0, 1.0]
        sparse = to_sparse_threshold(dense, threshold=0.01, normalise=False)
        # 0.005 < 0.01, should be dropped
        assert "0" not in sparse
        assert "2" in sparse


class TestToSparseTopK:
    def test_keeps_k_largest(self) -> None:
        dense = [0.1, 0.9, 0.3, 0.7, 0.5]
        sparse = to_sparse_topk(dense, k=2)
        assert len(sparse) == 2

    def test_k_larger_than_vector(self) -> None:
        dense = [1.0, 2.0]
        sparse = to_sparse_topk(dense, k=10)
        assert len(sparse) == 2

    def test_excludes_zeros_even_within_k(self) -> None:
        dense = [0.0, 0.0, 1.0]
        sparse = to_sparse_topk(dense, k=3)
        assert "0" not in sparse
        assert "1" not in sparse
        assert "2" in sparse


class TestMagnitudeStats:
    def test_single_vector(self) -> None:
        vectors = [[3.0, 4.0]]  # normalised: [0.6, 0.8]
        stats = magnitude_stats(vectors)
        assert stats["min"] == pytest.approx(0.6)
        assert stats["max"] == pytest.approx(0.8)

    def test_empty_input(self) -> None:
        assert magnitude_stats([]) == {}

    def test_percentiles_are_ordered(self) -> None:
        vectors = [[float(i) for i in range(1, 101)]]
        stats = magnitude_stats(vectors)
        assert stats["p10"] <= stats["p25"] <= stats["p50"]
        assert stats["p50"] <= stats["p75"] <= stats["p90"]


class TestSparsityAtThresholds:
    def test_higher_threshold_retains_less(self) -> None:
        vectors = [[0.01, 0.05, 0.1, 0.5, 1.0]]
        result = sparsity_at_thresholds(vectors, thresholds=[0.001, 0.1])
        low = result["0.001"]["mean_retained_pct"]
        high = result["0.1"]["mean_retained_pct"]
        assert low >= high

    def test_zero_threshold_retains_all_nonzero(self) -> None:
        vectors = [[1.0, 0.0, 1.0]]
        result = sparsity_at_thresholds(vectors, thresholds=[0.0])
        # After normalisation both non-zero values are ~0.707, which is > 0
        assert result["0.0"]["mean_retained_pct"] == pytest.approx(66.7, abs=0.1)
