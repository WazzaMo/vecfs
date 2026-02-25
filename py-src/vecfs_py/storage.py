"""
VecFS storage: JSONL file with in-memory cache and file mutex.

Matches ts-src/storage.ts and go-src storage: same entry shape and ranking.
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any

from .sparse import cosine_similarity, norm

FEEDBACK_RANK_WEIGHT = 0.1


def _feedback_boost(score: float) -> float:
    """Bounded contribution of reinforcement score to ranking."""
    return FEEDBACK_RANK_WEIGHT * (score / (1 + abs(score)))


def _combined_rank(similarity: float, score: float) -> float:
    """Higher is better; used to sort search results."""
    return similarity + _feedback_boost(score)


def _entry_to_jsonl_line(entry: dict[str, Any]) -> str:
    """Serialize entry for JSONL; vector keys as strings for JSON."""
    out = dict(entry)
    if "vector" in out and out["vector"]:
        out["vector"] = {str(k): v for k, v in out["vector"].items()}
    return json.dumps(out) + "\n"


def _parse_line(line: str) -> dict[str, Any] | None:
    """Parse one JSONL line; convert vector keys to int for internal use."""
    line = line.strip()
    if not line:
        return None
    try:
        entry = json.loads(line)
    except json.JSONDecodeError:
        return None
    if "vector" in entry and isinstance(entry["vector"], dict):
        entry["vector"] = {int(k): v for k, v in entry["vector"].items()}
    return entry


class VecFSStorage:
    """
    Manages VecFS entries in a local JSONL file.
    Entries cached in memory; mutations persist under a mutex.
    """

    def __init__(self, file_path: str) -> None:
        self._path = Path(file_path)
        self._entries: list[dict[str, Any]] | None = None
        self._initialized = False
        self._lock = asyncio.Lock()

    async def ensure_file(self) -> None:
        """Ensure the storage file and parent directory exist."""
        if self._initialized:
            return
        self._path.parent.mkdir(parents=True, exist_ok=True)
        if not self._path.exists():
            self._path.write_text("", encoding="utf-8")
        self._initialized = True

    async def _load_entries(self) -> list[dict[str, Any]]:
        """Load all entries from file into cache."""
        if self._entries is not None:
            return self._entries
        await self.ensure_file()
        text = self._path.read_text(encoding="utf-8")
        self._entries = []
        for line in text.splitlines():
            if not line:
                continue
            entry = _parse_line(line)
            if entry is not None:
                self._entries.append(entry)
        return self._entries

    async def _persist_all(self) -> None:
        """Rewrite the file from the in-memory cache."""
        if self._entries is None:
            return
        content = "".join(_entry_to_jsonl_line(e) for e in self._entries)
        self._path.write_text(content, encoding="utf-8")

    async def _persist_append(self, entry: dict[str, Any]) -> None:
        """Append one entry to the file."""
        with self._path.open("a", encoding="utf-8") as f:
            f.write(_entry_to_jsonl_line(entry))

    async def store(
        self,
        id: str,
        vector: dict[int, float],
        metadata: dict[str, Any] | None = None,
        score: float = 0.0,
    ) -> bool:
        """Upsert an entry. Returns True if new, False if updated."""
        import time

        async with self._lock:
            entries = await self._load_entries()
            full: dict[str, Any] = {
                "id": id,
                "metadata": metadata or {},
                "vector": vector,
                "score": score,
                "timestamp": int(time.time() * 1000),
            }
            for i, e in enumerate(entries):
                if e.get("id") == id:
                    entries[i] = full
                    await self._persist_all()
                    return False
            entries.append(full)
            await self._persist_append(full)
            return True

    async def search(
        self,
        query_vector: dict[int, float],
        limit: int = 5,
    ) -> list[dict[str, Any]]:
        """Return entries sorted by combined rank (similarity + feedback boost)."""
        entries = await self._load_entries()
        query_norm = norm(query_vector)
        results: list[dict[str, Any]] = []
        for e in entries:
            vec = e.get("vector") or {}
            if isinstance(vec, dict) and vec:
                sim = cosine_similarity(
                    query_vector,
                    vec,
                    v1_norm=query_norm,
                )
            else:
                sim = 0.0
            results.append(
                {
                    **e,
                    "similarity": sim,
                }
            )
        results.sort(
            key=lambda r: _combined_rank(r["similarity"], r.get("score") or 0),
            reverse=True,
        )
        return results[:limit]

    async def update_score(self, id: str, score_adjustment: float) -> bool:
        """Adjust reinforcement score for an entry. Returns True if found."""
        async with self._lock:
            entries = await self._load_entries()
            for e in entries:
                if e.get("id") == id:
                    e["score"] = (e.get("score") or 0) + score_adjustment
                    await self._persist_all()
                    return True
            return False

    async def delete(self, id: str) -> bool:
        """Remove an entry by id. Returns True if found."""
        async with self._lock:
            entries = await self._load_entries()
            for i, e in enumerate(entries):
                if e.get("id") == id:
                    entries.pop(i)
                    await self._persist_all()
                    return True
            return False
