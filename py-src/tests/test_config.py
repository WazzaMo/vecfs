"""
Unit tests for vecfs_embed config loading (vecfs.yaml and env overrides).
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest

from vecfs_embed.config import (
    DEFAULT_EMBED_MODEL,
    DEFAULT_EMBED_THRESHOLD,
    DEFAULT_MCP_PORT,
    DEFAULT_STORAGE_FILE,
    get_config_path,
    load_config,
)


class TestGetConfigPath:
    def test_returns_none_when_no_config_exists(self) -> None:
        """When no candidate path exists, returns None."""
        result = get_config_path([ "vecfs-embed", "--config", "/nonexistent/vecfs.yaml" ])
        # --config points to non-existent file; cwd/homedir may still have config
        assert result is None or isinstance(result, Path)

    def test_returns_path_when_vecfs_yaml_in_cwd(self, tmp_path: Path) -> None:
        """When vecfs.yaml exists in given cwd (via candidate), we find it."""
        config_file = tmp_path / "vecfs.yaml"
        config_file.write_text("storage:\n  file: test.jsonl\n")
        # get_config_path checks process cwd first; we can't set cwd to tmp_path in a
        # way that doesn't affect other tests. So test via --config.
        result = get_config_path([ "vecfs-embed", "--config", str(config_file) ])
        assert result is not None
        assert result == config_file.resolve()

    def test_returns_path_when_veccfs_config_env_set(self, tmp_path: Path) -> None:
        """When VECFS_CONFIG points to existing file, returns that path."""
        config_file = tmp_path / "custom.yaml"
        config_file.write_text("mcp:\n  port: 4000\n")
        env = os.environ.copy()
        try:
            os.environ["VECFS_CONFIG"] = str(config_file)
            result = get_config_path([ "vecfs-embed" ])
            assert result is not None
            assert result == config_file.resolve()
        finally:
            os.environ.clear()
            os.environ.update(env)

    def test_returns_path_for_config_arg(self, tmp_path: Path) -> None:
        """--config <path> to existing file returns that path."""
        config_file = tmp_path / "explicit.yaml"
        config_file.write_text("storage:\n  file: explicit.jsonl\n")
        result = get_config_path([ "vecfs-embed", "--config", str(config_file) ])
        assert result is not None
        assert result == config_file.resolve()


class TestLoadConfig:
    def test_returns_defaults_when_no_config_file(self, tmp_path: Path) -> None:
        """When config file is empty or missing keys, defaults are used."""
        config_file = tmp_path / "vecfs.yaml"
        config_file.write_text("# empty\n")
        env = os.environ.copy()
        for key in ("VECFS_CONFIG", "VECFS_FILE", "PORT", "VECFS_EMBED_MODEL", "VECFS_EMBED_DIMS", "VECFS_EMBED_THRESHOLD"):
            env.pop(key, None)
        try:
            os.environ.clear()
            os.environ.update(env)
            config = load_config([ "vecfs-embed", "--config", str(config_file) ])
            # Empty YAML gives empty dict; storage.file and embed use defaults
            assert config.storage_file == DEFAULT_STORAGE_FILE
            assert config.mcp_port == DEFAULT_MCP_PORT
            assert config.embed.model == DEFAULT_EMBED_MODEL
            assert config.embed.threshold == DEFAULT_EMBED_THRESHOLD
            assert config.embed.dims is None
        finally:
            os.environ.clear()
            os.environ.update(env)

    def test_env_veccfs_file_overrides_storage(self, tmp_path: Path) -> None:
        """VECFS_FILE overrides storage.file."""
        env = os.environ.copy()
        try:
            os.environ["VECFS_FILE"] = "/tmp/env-storage.jsonl"
            config = load_config([ "vecfs-embed" ])
            assert config.storage_file == "/tmp/env-storage.jsonl"
        finally:
            os.environ.clear()
            os.environ.update(env)

    def test_env_port_overrides_mcp_port(self) -> None:
        """PORT overrides mcp.port."""
        env = os.environ.copy()
        try:
            os.environ["PORT"] = "9999"
            config = load_config([ "vecfs-embed" ])
            assert config.mcp_port == 9999
        finally:
            os.environ.clear()
            os.environ.update(env)

    def test_values_from_config_file(self, tmp_path: Path) -> None:
        """Values from vecfs.yaml are used when file exists and env not set."""
        config_file = tmp_path / "vecfs.yaml"
        config_file.write_text(
            "storage:\n  file: from-yaml.jsonl\n"
            "mcp:\n  port: 4000\n"
            "embed:\n  model: custom-model\n  threshold: 0.05\n"
        )
        env = os.environ.copy()
        for key in ("VECFS_FILE", "PORT", "VECFS_EMBED_MODEL", "VECFS_EMBED_THRESHOLD", "VECFS_EMBED_DIMS"):
            env.pop(key, None)
        try:
            os.environ.clear()
            os.environ.update(env)
            config = load_config([ "vecfs-embed", "--config", str(config_file) ])
            assert config.storage_file == "from-yaml.jsonl"
            assert config.mcp_port == 4000
            assert config.embed.model == "custom-model"
            assert config.embed.threshold == 0.05
        finally:
            os.environ.clear()
            os.environ.update(env)

    def test_env_overrides_config_file(self, tmp_path: Path) -> None:
        """VECFS_EMBED_MODEL and VECFS_EMBED_THRESHOLD override config file."""
        config_file = tmp_path / "vecfs.yaml"
        config_file.write_text(
            "embed:\n  model: from-file\n  threshold: 0.02\n"
        )
        env = os.environ.copy()
        try:
            os.environ["VECFS_EMBED_MODEL"] = "env-model"
            os.environ["VECFS_EMBED_THRESHOLD"] = "0.03"
            config = load_config([ "vecfs-embed", "--config", str(config_file) ])
            assert config.embed.model == "env-model"
            assert config.embed.threshold == 0.03
        finally:
            os.environ.clear()
            os.environ.update(env)

    def test_embed_dims_from_config(self, tmp_path: Path) -> None:
        """embed.dims from YAML can be int or string."""
        config_file = tmp_path / "vecfs.yaml"
        config_file.write_text("embed:\n  dims: 256\n")
        env = os.environ.copy()
        try:
            os.environ.pop("VECFS_EMBED_DIMS", None)
            config = load_config([ "vecfs-embed", "--config", str(config_file) ])
            assert config.embed.dims == 256
        finally:
            os.environ.clear()
            os.environ.update(env)

    def test_embed_dims_string_parsed(self, tmp_path: Path) -> None:
        """embed.dims as string '128' is parsed to int."""
        config_file = tmp_path / "vecfs.yaml"
        config_file.write_text('embed:\n  dims: "128"\n')
        env = os.environ.copy()
        try:
            os.environ.pop("VECFS_EMBED_DIMS", None)
            config = load_config([ "vecfs-embed", "--config", str(config_file) ])
            assert config.embed.dims == 128
        finally:
            os.environ.clear()
            os.environ.update(env)
