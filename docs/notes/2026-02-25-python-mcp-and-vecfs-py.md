# Python MCP Server and vecfs-py CLI

## Purpose

Record the implementation of the Python MCP server and **vecfs-py** CLI so the Python stack has full VecFS capability (embedder + MCP) in one language, matching the single-stack direction in `docs/notes/2026-02-25-typescript-single-stack-embedder.md`.

## Implemented (2026-02-25)

### vecfs_py package (`py-src/vecfs_py/`)

- **storage.py** — VecFS JSONL storage with in-memory cache and asyncio lock; same entry shape as TS/Go (`id`, `metadata`, `vector`, `score`, `timestamp`). Methods: `store`, `search`, `update_score`, `delete`. Search ranking: cosine similarity + feedback boost.
- **sparse.py** — Sparse vector math: `dot_product`, `norm`, `cosine_similarity`, `normalize_vector_input` (dense list or sparse dict, including string keys from JSON).
- **server.py** — FastMCP app with tools: **search** (vector or query), **memorize** (id, text or vector, metadata), **feedback** (id, scoreAdjustment), **delete** (id). Optional embedder: when provided, search accepts `query` (string) and memorize accepts `text` without a precomputed vector.
- **embedder_adapter.py** — Optional in-process embedder: if `vecfs_embed` is available, provides async `(text, mode) -> sparse dict` using vecfs_embed config and `embed_single`.
- **cli.py** — **vecfs-py** entry point: `vecfs-py version`, `vecfs-py mcp` (stdio), `vecfs-py mcp --http` (streamable HTTP, port from config), `vecfs-py mcp --config PATH`.

### Integration

- **pyproject.toml** — Added dependency `mcp[cli]`, script `vecfs-py = "vecfs_py.cli:main"`, and Hatch packages `vecfs_embed` and `vecfs_py`. Same repo install delivers both vecfs-embed and vecfs-py.
- **Tests** — `tests/test_vecfs_py_storage.py`: sparse math and storage (store, search, update_score, delete).

### Usage

- Run MCP on stdio: `uv run vecfs-py mcp` or `vecfs-py mcp`.
- Run MCP on HTTP: `vecfs-py mcp --http` (port from vecfs.yaml or `PORT`).
- With vecfs_embed installed, agents can call search with `query` (string) and memorize with `text`; no external embedder required for the Python stack.

## References

- `docs/notes/2026-02-24-single-tech-stack-versions.md` (summary table updated: Python single-stack yes).
- `docs/notes/2026-02-25-typescript-single-stack-embedder.md` (CLI names: vecfs-ts, vecfs-py, vecfs-go).
- `docs/goals.md`, `docs/requirements.md`.
