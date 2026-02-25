"""
VecFS MCP server using FastMCP.

Exposes tools: search, memorize, feedback, delete.
Optional in-process embedding via vecfs_embed when enabled.
"""

from __future__ import annotations

import json
from typing import Any, Callable, Awaitable

from mcp.server.fastmcp import FastMCP

from .storage import VecFSStorage

# Optional embedder: async (text, mode) -> dict[int, float] (sparse vector)
EmbedderFn = Callable[[str, str], Awaitable[dict[int, float]]]


def create_app(
    storage: VecFSStorage,
    embedder: EmbedderFn | None = None,
) -> FastMCP:
    """Create FastMCP app with VecFS tools bound to the given storage and embedder (required for text-only API)."""
    if embedder is None:
        raise ValueError("embedder is required (text-only API)")

    mcp = FastMCP(name="vecfs-server")

    @mcp.tool()
    async def search(query: str, limit: int = 5) -> str:
        """Semantic search: find entries with similar meaning to the query text. Vectorisation happens inside VecFS. Returns id, metadata, score, timestamp, similarity (no vectors in response)."""
        sparse = await embedder(query, "query")
        results = await storage.search(sparse, limit=limit)
        # Omit vector from response (text-only results)
        out = [
            {
                "id": r["id"],
                "metadata": r.get("metadata"),
                "score": r.get("score"),
                "timestamp": r.get("timestamp"),
                "similarity": r.get("similarity"),
            }
            for r in results
        ]
        return json.dumps(out, indent=2)

    @mcp.tool()
    async def memorize(
        id: str,
        text: str,
        metadata: dict[str, Any] | None = None,
    ) -> str:
        """Store a lesson, fact, or decision in memory by text. Vectorisation happens inside VecFS. Updates the entry if the ID already exists."""
        sparse = await embedder(text, "document")
        meta = dict(metadata) if metadata else {}
        meta["text"] = text
        await storage.store(id=id, vector=sparse, metadata=meta, score=0.0)
        return f"Stored entry: {id}"

    @mcp.tool()
    async def feedback(id: str, scoreAdjustment: float) -> str:
        """Record feedback for a specific memory entry."""
        found = await storage.update_score(id, scoreAdjustment)
        if not found:
            return f"Entry not found: {id}"
        return f"Updated score for entry: {id}"

    @mcp.tool()
    async def delete(id: str) -> str:
        """Delete an entry from the vector space by its unique ID."""
        found = await storage.delete(id)
        if not found:
            return f"Entry not found: {id}"
        return f"Deleted entry: {id}"

    return mcp
