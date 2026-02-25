"""
Optional in-process embedder using vecfs_embed.

Provides an async (text, mode) -> dict[int, float] for the MCP server.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .server import EmbedderFn


def get_embedder_fn() -> EmbedderFn | None:
    """
    Return an embedder function if vecfs_embed is available and config enables it.
    Otherwise return None (tools will require vector input).
    """
    try:
        from vecfs_embed.config import load_config
        from vecfs_embed.embed import embed_single
    except ImportError:
        return None

    async def _embed(text: str, mode: str) -> dict[int, float]:
        config = load_config()
        result = await embed_single(
            text,
            model=config.embed.model,
            mode=mode,
            dims=config.embed.dims,
            threshold=config.embed.threshold,
        )
        # vecfs_embed returns vector with string keys; convert to int for storage
        return {int(k): v for k, v in result.vector.items()}

    return _embed
