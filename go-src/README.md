# VecFS Go Implementation

Go ports of the VecFS programs, aligned with `ts-src` and `py-src` behaviour. Unit tests validate the same cases as the TypeScript and Python suites.

## Layout

- **internal/sparse** — Sparse vector math (dot product, norm, cosine similarity, toSparse). Matches `ts-src/sparse-vector.ts`.
- **internal/storage** — JSONL storage with store, search, updateScore, delete. Matches `ts-src/storage.ts`.
- **internal/config** — Load `vecfs.yaml` and env overrides. Matches `ts-src/config.ts` and `py-src/vecfs_embed/config.py`.
- **internal/mcp** — MCP tools (search, memorize, feedback, delete) and JSON-RPC over stdio. Matches `ts-src` MCP server behaviour.
- **internal/embed** — Mock text-to-vector for testing (no real embedding model).
- **cmd/vecfs-mcp-go** — MCP server binary (stdio).
- **cmd/vecfs-embed-go** — Embed CLI using mock embedder; use Python `vecfs_embed` for real models.

## Build and test

```bash
cd go-src
go build ./...
go test ./...
```

Build binaries:

```bash
go build -o vecfs-mcp-go ./cmd/vecfs-mcp-go/
go build -o vecfs-embed-go ./cmd/vecfs-embed-go/
```

## Configuration

Same as TS/Py: `vecfs.yaml` (or `.vecfs.yaml`), `VECFS_CONFIG`, `--config`, env overrides `VECFS_FILE`, `PORT`, `VECFS_EMBED_*`.

## Test parity

- **internal/sparse** — Same cases as `ts-src/sparse-vector.test.ts` (dotProduct, norm, cosineSimilarity, toSparse).
- **internal/storage** — Same cases as `ts-src/storage.test.ts` (ensureFile, store/search, updateScore, feedback ranking, upsert, delete, concurrent update, persistence).
- **internal/config** — Same cases as `ts-src/config.test.ts` and `py-src/tests/test_config.py` (getConfigPath, loadConfig, env overrides, port from string).
- **internal/mcp** — Tools list and call (search, memorize, feedback, delete) matching TS tool handlers.
