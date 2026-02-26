# VecFS TypeScript Implementation

VecFS MCP server and embedding CLI in TypeScript for [VecFS](https://github.com/WazzaMo/vecfs).

Provides vector storage and search for AI agents via the Model Context Protocol (MCP), with tools for `search`, `memorize`, `feedback`, and `delete`. The same package includes a text-to-sparse-vector CLI (`vecfs-embed-ts`) using [fastembed](https://github.com/nicksrandall/fastembed-node). The npm package and scripts live at the **repo root**; run all commands from there.

# Build

The project version is read at build time from the repo root file `VERSION.txt`. The build script injects it into `ts-src/version.generated.ts` and into `package.json`, then compiles and bundles. Run from the repo root.

## Prerequisites

```bash
npm install
```

## Full build

```bash
npm run build
```

This runs `scripts/inject-version.mjs` (copying the version from `VERSION.txt` into the bundle), type-checks with `tsc --noEmit`, and bundles with esbuild. Output is in `dist/`:

- `dist/mcp-server.js` — MCP server (stdio or HTTP)
- `dist/embed-cli.js` — Embedding CLI

The version string is baked into the built files; no `VERSION.txt` is required at runtime.

## Type-check only

```bash
npm run check
```

Runs the version injector and then `tsc --noEmit` (no bundle). Useful for CI or before committing.

# Test

Run tests from the repo root.

## Unit and integration tests

```bash
npm test
```

Runs Vitest for unit tests (config, sparse vectors, storage) and the default integration suite.

## Integration tests (longer timeout)

```bash
npm run test:integration
```

Same as above with a 30s timeout for integration tests.

## HTTP integration tests

```bash
npm run test:http
```

Builds the project, then runs HTTP/SSE integration tests (30s timeout).

# Run

After `npm run build`, use the binaries from `dist/` or via the `bin` entries if the package is linked (e.g. `npm link` or `npm install -g .`).

## MCP server (vecfs-ts)

```bash
# Stdio (default; for agents like Claude Desktop, Cursor)
node dist/mcp-server.js
# Or, if installed: vecfs-ts

# HTTP / SSE
node dist/mcp-server.js --http
# Custom port: PORT=8080 node dist/mcp-server.js --http
```

Stdio is the default transport. With `--http`, the server listens on the configured port (env `PORT` or config); connect via `GET /sse` and `POST /messages`.

## Embedding CLI (vecfs-embed-ts)

```bash
# Single text
node dist/embed-cli.js --mode query "sparse vector storage"
node dist/embed-cli.js --mode document "key lesson to remember"

# Batch (one text per line on stdin)
echo -e "line one\nline two" | node dist/embed-cli.js --batch --mode document

# With options
node dist/embed-cli.js --threshold 0.02 --mode query "your text"
```

Options: `--config PATH`, `--mode query|document`, `--threshold N`, `--batch`.

# Install (published package)

To use the published package from npm instead of building from source:

```bash
npm install -g vecfs
```

Then run:

```bash
vecfs
# or
npx vecfs
```

# Configuration

Config is loaded from `vecfs.yaml` (or `.vecfs.yaml`), or `VECFS_CONFIG` for the config file path. Env overrides:

- `VECFS_FILE` — path to the vector storage JSONL file (default: `./vecfs-data.jsonl`)
- `PORT` — port for HTTP mode (default: `3000`)

# License

Apache-2.0
