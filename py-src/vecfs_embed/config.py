"""
Load VecFS common configuration from vecfs.yaml.

Lookup order: VECFS_CONFIG env, --config in argv, then ./vecfs.yaml,
./.vecfs.yaml, ~/.config/vecfs/vecfs.yaml. Environment variables override
values from the file (VECFS_FILE, VECFS_EMBED_MODEL, etc.).
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

DEFAULT_STORAGE_FILE = "./vecfs-data.jsonl"
DEFAULT_MCP_PORT = 3000
DEFAULT_EMBED_MODEL = "sentence-transformers:all-MiniLM-L6-v2"
DEFAULT_EMBED_THRESHOLD = 0.01


@dataclass
class EmbedConfig:
    """Embedding-related config (vecfs_embed)."""

    model: str
    dims: int | None
    threshold: float


@dataclass
class VecFSConfig:
    """Resolved VecFS config with env overrides applied."""

    storage_file: str
    mcp_port: int
    embed: EmbedConfig


def get_config_path(argv: list[str] | None = None) -> Path | None:
    """
    Resolve path to config file in lookup order.
    Returns the first path that exists, or None.
    """
    if argv is None:
        argv = __import__("sys").argv
    env_path = os.environ.get("VECFS_CONFIG")
    if env_path:
        p = Path(env_path)
        if p.exists():
            return p.resolve()
    try:
        idx = argv.index("--config")
        if idx + 1 < len(argv):
            p = Path(argv[idx + 1]).resolve()
            if p.exists():
                return p
    except ValueError:
        pass
    cwd = Path.cwd()
    candidates = [
        cwd / "vecfs.yaml",
        cwd / ".vecfs.yaml",
        Path.home() / ".config" / "vecfs" / "vecfs.yaml",
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate.resolve()
    return None


def _read_yaml(path: Path) -> dict[str, Any]:
    """Parse YAML file; return empty dict on error."""
    try:
        text = path.read_text(encoding="utf-8")
        data = yaml.safe_load(text)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def load_config(argv: list[str] | None = None) -> VecFSConfig:
    """
    Load VecFS config from the first found config file, then apply env overrides.
    """
    if argv is None:
        argv = __import__("sys").argv
    raw: dict[str, Any] = {}
    config_path = get_config_path(argv)
    if config_path:
        raw = _read_yaml(config_path)

    storage = raw.get("storage") or {}
    mcp = raw.get("mcp") or {}
    embed_raw = raw.get("embed") or {}

    storage_file = storage.get("file")
    if not isinstance(storage_file, str):
        storage_file = DEFAULT_STORAGE_FILE
    if os.environ.get("VECFS_FILE"):
        storage_file = os.environ["VECFS_FILE"]

    mcp_port = mcp.get("port")
    if isinstance(mcp_port, str):
        mcp_port = int(mcp_port)
    if not isinstance(mcp_port, int):
        mcp_port = DEFAULT_MCP_PORT
    if os.environ.get("PORT") not in (None, ""):
        try:
            mcp_port = int(os.environ["PORT"])
        except ValueError:
            pass

    model = embed_raw.get("model")
    if not isinstance(model, str):
        model = os.environ.get("VECFS_EMBED_MODEL", DEFAULT_EMBED_MODEL)
    else:
        model = os.environ.get("VECFS_EMBED_MODEL", model)

    dims = embed_raw.get("dims")
    if dims is not None and not isinstance(dims, int):
        if isinstance(dims, str):
            try:
                dims = int(dims)
            except ValueError:
                dims = None
        else:
            dims = None
    if dims is None and os.environ.get("VECFS_EMBED_DIMS"):
        try:
            dims = int(os.environ["VECFS_EMBED_DIMS"])
        except ValueError:
            dims = None

    threshold = embed_raw.get("threshold")
    if isinstance(threshold, str):
        try:
            threshold = float(threshold)
        except ValueError:
            threshold = DEFAULT_EMBED_THRESHOLD
    if not isinstance(threshold, (int, float)):
        threshold = DEFAULT_EMBED_THRESHOLD
    if os.environ.get("VECFS_EMBED_THRESHOLD") not in (None, ""):
        try:
            threshold = float(os.environ["VECFS_EMBED_THRESHOLD"])
        except ValueError:
            pass

    return VecFSConfig(
        storage_file=storage_file,
        mcp_port=mcp_port,
        embed=EmbedConfig(model=model, dims=dims, threshold=float(threshold)),
    )
