"""
Command-line interface for vecfs-embed.

Supports three modes:
  - Single text embedding (default)
  - Batch embedding (--batch)
  - Calibration (--calibrate)

Configuration: vecfs.yaml (or .vecfs.yaml, or VECFS_CONFIG / --config).
Env vars override: VECFS_FILE, VECFS_EMBED_MODEL, VECFS_EMBED_DIMS, VECFS_EMBED_THRESHOLD.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys

from .config import load_config
from .embed import calibrate, embed_batch, embed_single

DEFAULT_MODEL = "sentence-transformers:all-MiniLM-L6-v2"
DEFAULT_THRESHOLD = 0.01


def _parse_args() -> argparse.Namespace:
    config = load_config(sys.argv)
    embed = config.embed

    parser = argparse.ArgumentParser(
        prog="vecfs-embed",
        description="Convert text to VecFS sparse vectors using any embedding model.",
    )

    parser.add_argument(
        "--config",
        metavar="PATH",
        help="Path to vecfs.yaml (or set VECFS_CONFIG).",
    )
    parser.add_argument(
        "text",
        nargs="?",
        default=None,
        help="Text to embed (reads from stdin if omitted).",
    )
    parser.add_argument(
        "--mode",
        choices=["query", "document"],
        default="query",
        help="Embedding mode: 'query' for search, 'document' for memorisation (default: query).",
    )
    parser.add_argument(
        "--batch",
        action="store_true",
        help="Batch mode: read one text per line from stdin, output a JSON array.",
    )
    parser.add_argument(
        "--calibrate",
        action="store_true",
        help="Calibrate mode: read sample texts from stdin and report magnitude statistics.",
    )
    parser.add_argument(
        "--model",
        default=embed.model,
        help=f"Embedding model (default from config or {DEFAULT_MODEL}, env: VECFS_EMBED_MODEL).",
    )
    parser.add_argument(
        "--dims",
        type=int,
        default=embed.dims,
        help="Reduce output dimensions (config or env: VECFS_EMBED_DIMS).",
    )
    parser.add_argument(
        "--threshold",
        type=float,
        default=embed.threshold,
        help=f"Sparsification threshold (default from config or {DEFAULT_THRESHOLD}, env: VECFS_EMBED_THRESHOLD).",
    )

    return parser.parse_args()


def _read_stdin_lines() -> list[str]:
    """Read non-empty lines from stdin."""
    return [line.strip() for line in sys.stdin if line.strip()]


async def _run(args: argparse.Namespace) -> None:
    if args.calibrate:
        texts = _read_stdin_lines()
        if not texts:
            print("Error: --calibrate requires input on stdin (one text per line).", file=sys.stderr)
            sys.exit(1)
        result = await calibrate(texts, model=args.model, dims=args.dims)
        print(json.dumps(result.to_dict(), indent=2))
        return

    if args.batch:
        texts = _read_stdin_lines()
        if not texts:
            print("Error: --batch requires input on stdin (one text per line).", file=sys.stderr)
            sys.exit(1)
        results = await embed_batch(
            texts,
            model=args.model,
            mode=args.mode,
            dims=args.dims,
            threshold=args.threshold,
        )
        print(json.dumps([r.to_dict() for r in results], indent=2))
        return

    # Single text mode
    text = args.text
    if text is None:
        text = sys.stdin.read().strip()
    if not text:
        print("Error: no input text provided.", file=sys.stderr)
        sys.exit(1)

    result = await embed_single(
        text,
        model=args.model,
        mode=args.mode,
        dims=args.dims,
        threshold=args.threshold,
    )
    print(json.dumps(result.to_dict(), indent=2))


def main() -> None:
    args = _parse_args()
    asyncio.run(_run(args))


if __name__ == "__main__":
    main()
