"""
VecFS MCP server using FastMCP.

Exposes tools: search, memorize, feedback, delete.
Optional in-process embedding via vecfs_embed when enabled.
"""

from __future__ import annotations

import json
from typing import Any, Callable, Awaitable

from mcp.server.fastmcp import FastMCP

from .sparse import normalize_vector_input
from .storage import VecFSStorage

# Optional embedder: async (text, mode) -> dict[int, float] (sparse vector)
EmbedderFn = Callable[[str, str], Awaitable[dict[int, float]]]


def create_app(
    storage: VecFSStorage,
    embedder: EmbedderFn | None = None,
) -> FastMCP:
    """Create FastMCP app with VecFS tools bound to the given storage and optional embedder."""
    mcp = FastMCP(name="vecfs-server")

    @mcp.tool()
    async def search(
        vector: dict[str, float] | list[float] | str | None = None,
        query: str | None = None,
        limit: int = 5,
    ) -> str:
        """Search memory by natural-language query. Prefer sending query (text); VecFS embeds it. Returns text-only results: id, metadata (including stored text), score, timestamp, similarity. No vectors in the response."""
        if vector is not None:
            if isinstance(vector, str):
                vector = json.loads(vector)
            sparse = normalize_vector_input(vector)
        elif query is not None and embedder is not None:
            sparse = await embedder(query, "query")
        else:
            raise ValueError(
                "search requires either 'vector' or 'query' (query requires embedder to be enabled)."
            )
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
        text: str | None = None,
        vector: dict[str, float] | list[float] | str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> str:
        """Store a lesson, fact, or decision in memory. Prefer sending id and text; VecFS embeds the text. Updates the entry if the ID already exists."""
        if vector is not None:
            if isinstance(vector, str):
                vector = json.loads(vector)
            sparse = normalize_vector_input(vector)
        elif text is not None and embedder is not None:
            sparse = await embedder(text, "document")
        else:
            raise ValueError(
                "memorize requires either 'vector' or 'text' (text requires embedder to be enabled)."
            )
        meta = dict(metadata) if metadata else {}
        if text is not None:
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
