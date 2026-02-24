# TypeScript Single-Stack Embedder Implementation Plan

## Purpose

Implement an in-process TypeScript embedder so that the VecFS MCP server can turn text into sparse vectors without an external runtime. This delivers a single-stack TypeScript experience: embedder + MCP server in one process.

## Scope

- Add an embedder module in `ts-src` that uses [fastembed-js](https://github.com/Anush008/fastembed-js) to produce dense embeddings, then converts to VecFS sparse format (threshold + optional L2 normalise), aligned with the Python embedder behaviour.
- Integrate the embedder into the MCP server so that `memorize` can accept text (and optionally embed it when vector is omitted) and `search` can accept a query string (and embed it when vector is omitted).
- Keep the embedder optional: when not configured or not installed, the server continues to accept only pre-computed vectors (current behaviour).

## Design

### Embedder API

- **Library:** `embedText(text: string, options?: { mode: 'document' | 'query', threshold?: number }) => Promise<SparseVector>`.
- **Model:** Lazy-load on first use; default model BGE small (or configurable).
- **Sparsification:** Reuse `toSparse` from `sparse-vector.ts` with an optional L2-normalise step before thresholding to match Python’s `to_sparse_threshold(..., normalise=True)`.

### Tool Changes

- **memorize:** Allow either `vector` or `text`. If `text` is provided (and no vector), call the embedder in document mode, then store. If both are provided, prefer embedding from `text` for single-stack convenience; otherwise allow vector-only.
- **search:** Allow either `vector` or `query` (string). If `query` is provided, embed in query mode, then search.

### Configuration

- Support optional config (e.g. `vecfs.yaml` or env) for embedder: enabled/disabled, model name, default threshold. When disabled or dependency missing, tools require vector/query as today (search/memorize require vector; no text path).

### Files to Add or Change

- `ts-src/sparse-vector.ts`: Add helper for dense → sparse with optional L2 normalise (or use existing `toSparse` after normalising dense in embedder).
- `ts-src/embedder/`: New directory: `embedder.ts` (interface + fastembed-js implementation), `index.ts`.
- `ts-src/tool-handlers.ts`: Accept optional embedder; when present, allow text/query path for memorize and search.
- `ts-src/tool-schemas.ts`: Update search and memorize schemas to document optional `query` and optional `text` (vector optional when text given).
- `ts-src/mcp-server.ts`: Instantiate embedder from config (if enabled) and pass to `createToolHandlers`.
- `package.json`: Add optional or regular dependency `fastembed`.

## Success Criteria

- With embedder enabled, an agent can call `memorize` with `id` and `text` (no vector) and the server stores a sparse vector from the embedded text.
- With embedder enabled, an agent can call `search` with `query` (string) and the server embeds the query and returns results.
- With embedder disabled or dependency not installed, existing behaviour is unchanged (vector required).

## Implemented (2026-02-25)

- **sparse-vector.ts:** Added `denseNorm()` and `toSparse(..., normalise)` for L2-normalise-then-threshold (aligned with Python).
- **ts-src/embedder/:** New module: `createFastEmbedEmbedder()` using fastembed-js (FlagEmbedding, BGE small en v1.5), returns sparse vectors via `embedText(text, { mode, threshold })`.
- **Tool handlers:** `createToolHandlers(storage, embedderOrGetter)` accept an optional embedder or a getter `() => Promise<Embedder | null>` for lazy init. `search` accepts `query` (string); `memorize` accepts `text` without `vector`; when embedder is present they embed in-process.
- **MCP server:** Passes `() => createFastEmbedEmbedder()` so the embedder loads on first use (no startup block).
- **Build:** fastembed is marked external in esbuild so native .node bindings are not bundled; runtime loads from node_modules.
- **Tests:** New sparse-vector tests for `denseNorm` and `toSparse(..., true)`; integration config tests given 15s timeout (spawn-under-temp-dir can be slow).

## References

- `docs/notes/2026-02-24-single-tech-stack-versions.md` (TypeScript embedder option: fastembed-js).
- `docs/goals.md` (single-stack per language).
- `docs/requirements.md` (MCP tools: search, memorize).
