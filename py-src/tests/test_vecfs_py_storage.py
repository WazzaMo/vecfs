"""Tests for vecfs_py storage and sparse math."""

from __future__ import annotations

import asyncio
import tempfile
from pathlib import Path

import pytest

from vecfs_py.sparse import cosine_similarity, dot_product, norm, normalize_vector_input
from vecfs_py.storage import VecFSStorage


@pytest.mark.asyncio
async def test_sparse_norm_and_dot() -> None:
    v = {0: 3.0, 1: 4.0}
    assert norm(v) == 5.0
    assert dot_product({0: 1.0, 1: 0.0}, {0: 1.0, 1: 0.0}) == 1.0
    assert dot_product({0: 1.0, 1: 0.0}, {0: 0.0, 1: 1.0}) == 0.0


@pytest.mark.asyncio
async def test_cosine_similarity() -> None:
    v1 = {0: 1.0, 1: 0.0}
    v2 = {0: 1.0, 1: 0.0}
    assert abs(cosine_similarity(v1, v2) - 1.0) < 1e-9
    v3 = {0: 0.0, 1: 1.0}
    assert abs(cosine_similarity(v1, v3)) < 1e-9


@pytest.mark.asyncio
async def test_normalize_vector_input() -> None:
    assert normalize_vector_input([1.0, 0.0, 2.0]) == {0: 1.0, 2: 2.0}
    assert normalize_vector_input({"0": 1.0, "1": 2.0}) == {0: 1.0, 1: 2.0}


@pytest.mark.asyncio
async def test_storage_store_and_search() -> None:
    with tempfile.NamedTemporaryFile(suffix=".jsonl", delete=False) as f:
        path = f.name
    try:
        storage = VecFSStorage(path)
        await storage.ensure_file()
        await storage.store("id1", {0: 1.0, 1: 0.5}, metadata={"text": "hello"}, score=0.0)
        results = await storage.search({0: 1.0, 1: 0.5}, limit=5)
        assert len(results) == 1
        assert results[0]["id"] == "id1"
        assert results[0]["metadata"].get("text") == "hello"
        assert results[0]["similarity"] > 0.99
    finally:
        Path(path).unlink(missing_ok=True)


@pytest.mark.asyncio
async def test_storage_update_score_and_delete() -> None:
    with tempfile.NamedTemporaryFile(suffix=".jsonl", delete=False) as f:
        path = f.name
    try:
        storage = VecFSStorage(path)
        await storage.ensure_file()
        await storage.store("id1", {0: 1.0}, metadata={}, score=0.0)
        ok = await storage.update_score("id1", 2.0)
        assert ok is True
        ok = await storage.update_score("nonexistent", 1.0)
        assert ok is False
        ok = await storage.delete("id1")
        assert ok is True
        ok = await storage.delete("id1")
        assert ok is False
    finally:
        Path(path).unlink(missing_ok=True)
