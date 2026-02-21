"""
Integration tests for the vecfs-embed pipeline.

These tests use real Markdown documents from docs/ as input and run
them through the full embedding pipeline (Sentence Transformers model).
They are slower than unit tests because they load the model, but they
verify the end-to-end behaviour that an agent would rely on.
"""

from __future__ import annotations

import json
import math
import os
import subprocess
import sys
from pathlib import Path

import pytest

from vecfs_embed.embed import calibrate, embed_batch, embed_single
from vecfs_embed.sparsify import l2_normalise

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

DOCS_DIR = Path(__file__).resolve().parent.parent.parent / "docs"
MODEL = "sentence-transformers:all-MiniLM-L6-v2"
EXPECTED_DIMS = 384


@pytest.fixture(scope="module")
def doc_texts() -> list[str]:
    """Read every Markdown file in docs/ and return their contents."""
    paths = sorted(DOCS_DIR.rglob("*.md"))
    assert len(paths) >= 3, f"Expected at least 3 docs, found {len(paths)}"
    texts = []
    for p in paths:
        content = p.read_text(encoding="utf-8").strip()
        if content:
            texts.append(content)
    return texts


@pytest.fixture(scope="module")
def first_doc(doc_texts: list[str]) -> str:
    """The first document, used for single-text tests."""
    return doc_texts[0]


# ---------------------------------------------------------------------------
# Single embedding tests
# ---------------------------------------------------------------------------


class TestEmbedSingle:
    @pytest.mark.asyncio
    async def test_returns_sparse_vector(self, first_doc: str) -> None:
        result = await embed_single(first_doc, model=MODEL, mode="document")
        assert result.dense_dimensions == EXPECTED_DIMS
        assert result.non_zero_count == len(result.vector)
        assert result.non_zero_count > 0
        assert result.model == MODEL

    @pytest.mark.asyncio
    async def test_vector_keys_are_valid_dimension_indices(
        self, first_doc: str
    ) -> None:
        result = await embed_single(first_doc, model=MODEL, mode="document")
        for key in result.vector:
            idx = int(key)
            assert 0 <= idx < EXPECTED_DIMS, f"Dimension {idx} out of range"

    @pytest.mark.asyncio
    async def test_vector_values_are_finite(self, first_doc: str) -> None:
        result = await embed_single(first_doc, model=MODEL, mode="document")
        for val in result.vector.values():
            assert math.isfinite(val), f"Non-finite value: {val}"

    @pytest.mark.asyncio
    async def test_higher_threshold_yields_fewer_components(
        self, first_doc: str
    ) -> None:
        low = await embed_single(
            first_doc, model=MODEL, mode="document", threshold=0.01
        )
        high = await embed_single(
            first_doc, model=MODEL, mode="document", threshold=0.05
        )
        assert high.non_zero_count <= low.non_zero_count

    @pytest.mark.asyncio
    async def test_query_mode_produces_valid_output(self, first_doc: str) -> None:
        result = await embed_single(first_doc, model=MODEL, mode="query")
        assert result.dense_dimensions == EXPECTED_DIMS
        assert result.non_zero_count > 0

    @pytest.mark.asyncio
    async def test_to_dict_is_json_serialisable(self, first_doc: str) -> None:
        result = await embed_single(first_doc, model=MODEL, mode="document")
        output = json.dumps(result.to_dict())
        parsed = json.loads(output)
        assert "vector" in parsed
        assert isinstance(parsed["vector"], dict)


# ---------------------------------------------------------------------------
# Batch embedding tests
# ---------------------------------------------------------------------------


class TestEmbedBatch:
    @pytest.mark.asyncio
    async def test_returns_one_result_per_doc(self, doc_texts: list[str]) -> None:
        results = await embed_batch(doc_texts, model=MODEL, mode="document")
        assert len(results) == len(doc_texts)

    @pytest.mark.asyncio
    async def test_all_results_have_correct_dimensions(
        self, doc_texts: list[str]
    ) -> None:
        results = await embed_batch(doc_texts, model=MODEL, mode="document")
        for r in results:
            assert r.dense_dimensions == EXPECTED_DIMS

    @pytest.mark.asyncio
    async def test_different_docs_produce_different_vectors(
        self, doc_texts: list[str]
    ) -> None:
        results = await embed_batch(doc_texts, model=MODEL, mode="document")
        vectors = [r.vector for r in results]
        # At least some pairs should differ
        differ_count = 0
        for i in range(len(vectors)):
            for j in range(i + 1, len(vectors)):
                if vectors[i] != vectors[j]:
                    differ_count += 1
        assert differ_count > 0, "All documents produced identical vectors"

    @pytest.mark.asyncio
    async def test_batch_to_dict_is_json_array(self, doc_texts: list[str]) -> None:
        results = await embed_batch(doc_texts, model=MODEL, mode="document")
        output = json.dumps([r.to_dict() for r in results])
        parsed = json.loads(output)
        assert isinstance(parsed, list)
        assert len(parsed) == len(doc_texts)


# ---------------------------------------------------------------------------
# Calibrate tests
# ---------------------------------------------------------------------------


class TestCalibrate:
    @pytest.mark.asyncio
    async def test_returns_stats_for_all_docs(self, doc_texts: list[str]) -> None:
        result = await calibrate(doc_texts, model=MODEL)
        assert result.sample_count == len(doc_texts)
        assert result.dense_dimensions == EXPECTED_DIMS

    @pytest.mark.asyncio
    async def test_magnitude_stats_are_ordered(self, doc_texts: list[str]) -> None:
        result = await calibrate(doc_texts, model=MODEL)
        s = result.magnitude_stats
        assert s["min"] <= s["p10"] <= s["p25"] <= s["p50"]
        assert s["p50"] <= s["p75"] <= s["p90"] <= s["max"]

    @pytest.mark.asyncio
    async def test_sparsity_decreases_with_threshold(
        self, doc_texts: list[str]
    ) -> None:
        result = await calibrate(doc_texts, model=MODEL)
        thresholds = sorted(result.sparsity_at_thresholds.keys(), key=float)
        retained = [
            result.sparsity_at_thresholds[t]["mean_retained_pct"] for t in thresholds
        ]
        # Retained percentage should be non-increasing as threshold grows
        for i in range(1, len(retained)):
            assert retained[i] <= retained[i - 1] + 0.1  # small tolerance

    @pytest.mark.asyncio
    async def test_calibrate_to_dict_is_json_serialisable(
        self, doc_texts: list[str]
    ) -> None:
        result = await calibrate(doc_texts, model=MODEL)
        output = json.dumps(result.to_dict())
        parsed = json.loads(output)
        assert "magnitude_stats" in parsed
        assert "sparsity_at_thresholds" in parsed


# ---------------------------------------------------------------------------
# CLI integration tests (subprocess)
# ---------------------------------------------------------------------------


class TestCLI:
    """Run the CLI as a subprocess to verify end-to-end behaviour."""

    def _run_cli(self, *args: str, stdin: str | None = None) -> dict | list:
        """Invoke vecfs_embed CLI and parse JSON stdout."""
        cmd = [sys.executable, "-m", "vecfs_embed", *args]
        proc = subprocess.run(
            cmd,
            input=stdin,
            capture_output=True,
            text=True,
            timeout=120,
            cwd=str(Path(__file__).resolve().parent.parent),
        )
        assert proc.returncode == 0, f"CLI failed: {proc.stderr}"
        return json.loads(proc.stdout)

    def test_single_doc_via_stdin(self, first_doc: str) -> None:
        result = self._run_cli("--mode", "document", stdin=first_doc)
        assert isinstance(result, dict)
        assert "vector" in result
        assert result["dense_dimensions"] == EXPECTED_DIMS
        assert result["non_zero_count"] > 0

    def test_batch_mode_with_docs(self, doc_texts: list[str]) -> None:
        stdin = "\n".join(
            text.replace("\n", " ")[:500] for text in doc_texts[:3]
        )
        result = self._run_cli("--batch", "--mode", "document", stdin=stdin)
        assert isinstance(result, list)
        assert len(result) == 3

    def test_calibrate_mode_with_docs(self, doc_texts: list[str]) -> None:
        stdin = "\n".join(
            text.replace("\n", " ")[:500] for text in doc_texts[:3]
        )
        result = self._run_cli("--calibrate", stdin=stdin)
        assert isinstance(result, dict)
        assert result["sample_count"] == 3
        assert "magnitude_stats" in result

    def test_custom_threshold_via_flag(self, first_doc: str) -> None:
        low = self._run_cli(
            "--mode", "document", "--threshold", "0.01", stdin=first_doc
        )
        high = self._run_cli(
            "--mode", "document", "--threshold", "0.1", stdin=first_doc
        )
        assert high["non_zero_count"] <= low["non_zero_count"]


# ---------------------------------------------------------------------------
# Configuration file (vecfs.yaml) integration tests
# ---------------------------------------------------------------------------


class TestCLIConfig:
    """CLI with vecfs.yaml: config file and env override."""

    def _run_cli(
        self,
        *args: str,
        stdin: str | None = None,
        cwd: Path | None = None,
        env: dict[str, str] | None = None,
    ) -> dict | list:
        """Invoke vecfs_embed CLI and parse JSON stdout."""
        cmd = [sys.executable, "-m", "vecfs_embed", *args]
        run_env = os.environ.copy()
        if env:
            run_env.update(env)
        proc = subprocess.run(
            cmd,
            input=stdin,
            capture_output=True,
            text=True,
            timeout=120,
            cwd=str(cwd) if cwd else str(Path(__file__).resolve().parent.parent),
            env=run_env,
        )
        assert proc.returncode == 0, f"CLI failed: {proc.stderr}"
        return json.loads(proc.stdout)

    def test_threshold_from_config_file(self, first_doc: str, tmp_path: Path) -> None:
        """When vecfs.yaml sets embed.threshold, CLI uses it unless overridden."""
        config_file = tmp_path / "vecfs.yaml"
        config_file.write_text(
            "storage:\n  file: ./data.jsonl\n"
            "embed:\n  model: sentence-transformers:all-MiniLM-L6-v2\n  threshold: 0.1\n"
        )
        # Run with --config so we use this file; higher threshold => sparser output
        result = self._run_cli(
            "--config", str(config_file),
            "--mode", "document",
            stdin=first_doc[:500],
            cwd=tmp_path,
        )
        assert isinstance(result, dict)
        assert "non_zero_count" in result
        # With threshold 0.1 we expect fewer components than default 0.01
        result_high = result["non_zero_count"]

        # Same input with default threshold (no config) should have more components
        result_low = self._run_cli(
            "--mode", "document", "--threshold", "0.01",
            stdin=first_doc[:500],
        )
        assert result_low["non_zero_count"] >= result_high

    def test_env_threshold_overrides_config_file(
        self, first_doc: str, tmp_path: Path
    ) -> None:
        """VECFS_EMBED_THRESHOLD overrides embed.threshold from vecfs.yaml."""
        config_file = tmp_path / "vecfs.yaml"
        config_file.write_text(
            "embed:\n  threshold: 0.01\n"
        )
        # Config says 0.01; env says 0.1 => env wins, sparser output
        env = os.environ.copy()
        env["VECFS_EMBED_THRESHOLD"] = "0.1"
        result = self._run_cli(
            "--config", str(config_file),
            "--mode", "document",
            stdin=first_doc[:500],
            cwd=tmp_path,
            env=env,
        )
        assert isinstance(result, dict)
        # Should be sparse (high threshold)
        assert result["non_zero_count"] < 200
