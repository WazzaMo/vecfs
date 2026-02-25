"""
vecfs-py CLI: run the VecFS MCP server (Python stack).

Usage:
  vecfs-py mcp           Run MCP server on stdio (default)
  vecfs-py mcp --http    Run MCP server on streamable HTTP (port from config)
  vecfs-py version       Print version

Configuration: vecfs.yaml (or .vecfs.yaml, VECFS_CONFIG). Env: VECFS_FILE, PORT.
Embedder: when vecfs_embed is installed, search/memorize accept query/text.
"""

from __future__ import annotations

import argparse
import asyncio
import sys

__version__ = "0.1.0"


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="vecfs-py",
        description="VecFS Python stack: MCP server and optional in-process embedder.",
    )
    sub = parser.add_subparsers(dest="command", required=True)
    mcp_parser = sub.add_parser("mcp", help="Run the MCP server")
    mcp_parser.add_argument(
        "--http",
        action="store_true",
        help="Use streamable HTTP transport instead of stdio.",
    )
    mcp_parser.add_argument(
        "--config",
        metavar="PATH",
        help="Path to vecfs.yaml (or set VECFS_CONFIG).",
    )
    sub.add_parser("version", help="Print version")
    return parser.parse_args()


def _run_mcp(http: bool, config_path: str | None) -> None:
    import os

    from vecfs_embed.config import load_config

    from .embedder_adapter import get_embedder_fn
    from .server import create_app
    from .storage import VecFSStorage

    argv = ["", "--config", config_path] if config_path else None
    config = load_config(argv)
    storage = VecFSStorage(config.storage_file)
    asyncio.run(storage.ensure_file())
    embedder = get_embedder_fn()
    if embedder is None:
        sys.exit(
            "vecfs-py: embedder required (text-only API). "
            "Install vecfs_embed (pip install vecfs-embed) and ensure embed config is set."
        )
    app = create_app(storage, embedder=embedder)
    if http:
        os.environ.setdefault("PORT", str(config.mcp_port))
        app.run(transport="streamable-http")
    else:
        app.run(transport="stdio")


def main() -> None:
    args = _parse_args()
    if args.command == "version":
        print(f"vecfs-py {__version__}")
        return
    if args.command == "mcp":
        config_path = getattr(args, "config", None)
        _run_mcp(http=getattr(args, "http", False), config_path=config_path)
        return
    raise SystemExit("Unknown command")


if __name__ == "__main__":
    main()
