# VecFS Go Implementation

Go ports of the VecFS programs, aligned with `ts-src` and `py-src` behaviour. Unit tests validate the same cases as the TypeScript and Python suites. Build and run from **go-src/** or use the helper script from the repo root for versioned binaries.

# Build

The project version is read at build time from the repo root file `VERSION.txt` and injected into binaries via `-ldflags`. Without it, binaries report version as `dev`. Run build commands from **go-src/** unless noted.

## Prerequisites

Go 1.21+ (or as required by the module). No external tools beyond the Go toolchain.

## Build all packages (no binaries)

```bash
cd go-src
go build ./...
```

## Build versioned binaries

From the **repo root** (recommended; reads `VERSION.txt` and injects version into all three binaries):

```bash
./scripts/build-go.sh
```

Binaries are written to `go-src/`: `vecfs`, `vecfs-mcp-go`, `vecfs-embed-go`.

From **go-src/** with version injected manually:

```bash
cd go-src
V=$(cat ../VERSION.txt | tr -d '\n\r ')
go build -ldflags "-X main.version=$V" -o vecfs ./cmd/vecfs/
go build -ldflags "-X main.version=$V" -o vecfs-mcp-go ./cmd/vecfs-mcp-go/
go build -ldflags "-X main.version=$V" -o vecfs-embed-go ./cmd/vecfs-embed-go/
```

The version string is baked into the binaries; no `VERSION.txt` is required at runtime.

# Test

Run tests from **go-src/**:

```bash
cd go-src
go test ./...
```

Verbose output:

```bash
go test -v ./...
```

Tests cover sparse vector math, storage (JSONL, store/search/updateScore/delete), config loading, and MCP tool behaviour. No external services are required.

## Test parity

- **internal/sparse** — Same cases as `ts-src/sparse-vector.test.ts` (dotProduct, norm, cosineSimilarity, toSparse).
- **internal/storage** — Same cases as `ts-src/storage.test.ts` (ensureFile, store/search, updateScore, feedback ranking, upsert, delete, concurrent update, persistence).
- **internal/config** — Same cases as `ts-src/config.test.ts` and `py-src/tests/test_config.py` (getConfigPath, loadConfig, env overrides, port from string).
- **internal/mcp** — Tools list and call (search, memorize, feedback, delete) matching TS tool handlers.

# Run

After building, run the binaries from `go-src/` (or add them to your PATH).

## Main CLI (vecfs)

```bash
# Print version (set at build time from VERSION.txt)
./vecfs version

# Start embedding model container (docker or podman)
./vecfs container start

# Stop and remove the container
./vecfs container stop
```

Container behaviour: set `VECFS_CONTAINER_RUNTIME` (docker|podman), `VECFS_EMBED_IMAGE` (e.g. a sentence-transformers server image), and optionally `VECFS_CONTAINER_NAME`, `VECFS_CONTAINER_PORT`. Default container name is `vecfs-embed`; default host port is 8080. Use `container stop` when the session ends or to clean up after an interrupted run.

## MCP server (vecfs-mcp-go)

```bash
./vecfs-mcp-go
```

Runs the MCP server on stdio. Startup message includes the version and embedder provider. Config via `vecfs.yaml`, `VECFS_CONFIG`, `--config`, and env (e.g. `VECFS_FILE`, `PORT`). The Go server does not implement HTTP transport; use the TypeScript or Python server for HTTP/SSE.

## Embedding CLI (vecfs-embed-go)

```bash
# Single text (mock embedder by default)
./vecfs-embed-go "some text to embed"
./vecfs-embed-go --mode document "key lesson"

# Batch (one text per line on stdin)
echo -e "line one\nline two" | ./vecfs-embed-go --batch

# Print version
./vecfs-embed-go -version
```

Options: `--config PATH`, `--mode query|document`, `--threshold N`, `--batch`, `--model`, `--dims`, `--provider` (mock, huggingface, local). For real embedding models, use Python `vecfs_embed` or the TypeScript embedder; the Go CLI includes a mock embedder for testing.

# Configuration

Same as TS/Py: config file `vecfs.yaml` (or `.vecfs.yaml`), or `VECFS_CONFIG` for the config path. Env overrides:

- `VECFS_FILE` — path to the vector storage JSONL file
- `PORT` — port (for config; Go MCP server is stdio-only)
- `VECFS_EMBED_*` — embedder settings

For **containers** (vecfs container start/stop):

- `VECFS_CONTAINER_RUNTIME` — `docker` or `podman`
- `VECFS_EMBED_IMAGE` — image to run (e.g. sentence-transformers server)
- `VECFS_CONTAINER_NAME` — container name (default `vecfs-embed`)
- `VECFS_CONTAINER_PORT` — host port (default `8080`)

# Layout

- **internal/sparse** — Sparse vector math (dot product, norm, cosine similarity, toSparse). Matches `ts-src/sparse-vector.ts`.
- **internal/storage** — JSONL storage with store, search, updateScore, delete. Matches `ts-src/storage.ts`.
- **internal/config** — Load `vecfs.yaml` and env overrides. Matches `ts-src/config.ts` and `py-src/vecfs_embed/config.py`.
- **internal/mcp** — MCP tools (search, memorize, feedback, delete) and JSON-RPC over stdio. Matches `ts-src` MCP server behaviour.
- **internal/embed** — Mock text-to-vector for testing (no real embedding model).
- **internal/container** — Start/stop containers via docker or podman CLI (used by vecfs container start/stop).
- **cmd/vecfs** — Main VecFS CLI: `version`, `container start` / `container stop`.
- **cmd/vecfs-mcp-go** — MCP server binary (stdio).
- **cmd/vecfs-embed-go** — Embed CLI (mock embedder; use Python or TS for real models).

# License

Apache-2.0
