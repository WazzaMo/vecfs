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

# Making the Project Consistently Single Tech Stack

Reviewing `docs/doc-guide.md`, `docs/goals.md`, `docs/notes/2026-02-22-cli-language-and-component-combinations.md`, and this note, the following changes would align the project around a consistent single-stack story: users choose one stack (Go, Python, or TypeScript) and run VecFS without mixing runtimes unless they explicitly opt in.

## Direction: Single-Stack-First

- **Interpretation:** "Single tech stack" means each of the three stacks (Go, Python, TypeScript) is **complete and self-contained**. A user picks one language and gets embedder + MCP (and, where applicable, CLI) in that stack only. Cross-stack combinations (e.g. Go MCP with Python embedder) remain possible for advanced use but are not the default or primary path.
- **TypeScript stack:** With the in-process embedder, the TS stack is now single-stack: one Node process runs the MCP server and embedding; no external embedder or subprocess required. The default TS experience can be `npx vecfs` or `npm run mcp` (or similar) with no Go or Python dependency.

## Documentation and Design Changes

### goals.md

- Goals already state that single-stack solutions are feasible per language. Consider making the **primary** offering explicit: "Users are expected to choose one stack; full capability (embedder + MCP) is available in each." The "secondary experiment" paragraph could clarify that cross-stack combinations are optional, not the default.

### CLI (2026-02-22-cli-language-and-component-combinations.md)

- The existing note recommends a **Go CLI** that orchestrates **any** combination of MCP and embedder (Go/TS MCP + Go/Python embed). The new direction is to make CLIs **stack-specific**, with names that clearly indicate the language:
  - **TypeScript:** `vecfs-ts` as the Node/TypeScript CLI, with `npx vecfs` as the primary install-free entry point. This CLI runs the TS MCP server and the in-process embedder in a single Node process.
  - **Python:** `vecfs-py` as the Python CLI (console script `vecfs-py`; e.g. `uv run vecfs-py mcp`). Implemented 2026-02-25: wraps the Python MCP server (`vecfs_py`) plus optional in-process vecfs-embed, giving a pure-Python stack.
  - **Go:** `vecfs-go` as the Go CLI binary that launches the Go MCP and Go embedder. This keeps the Go stack single-binary friendly while making its language explicit.
- Cross-stack orchestration (e.g. a Go CLI that can start TS MCP with a Python embedder) is de-emphasised and can be treated as an advanced feature or a separate tool if needed. The primary guidance becomes: **pick one of `vecfs-ts`, `vecfs-py`, or `vecfs-go` and stay within that stack**.
- Container management (containerd, local TEI) remains primarily a concern of the Go stack (`vecfs-go`) when using a local Go embedder; TS-only users with the in-process embedder do not require containers at all.

### doc-guide.md and release notes

- No change strictly required for "single stack"; they already describe features (vecfs_embed, MCP server, skills) without prescribing stacks. Release notes could explicitly call out "TypeScript single-stack (in-process embedder)" as a delivered feature where relevant.

### requirements.md

- Requirements are stack-agnostic (search, memorize, feedback, sparse storage). No change needed; single-stack is a delivery and packaging concern, not a change to functional requirements.

## Summary of Implications

| Area | Change for single-stack consistency |
|------|-------------------------------------|
| goals.md | Clarify that users choose one stack; full capability in each; cross-stack is optional. |
| CLI design | Make single-stack the default: stack-aware config (Option A) or stack-specific entry points (Option B); document mixed combinations as advanced. |
| TypeScript | Already consistent: one process (MCP + embedder); no dependency on Go CLI or Python for TS-only users. |
| Python | Implemented 2026-02-25: vecfs-py CLI and vecfs_py MCP server; optional in-process vecfs-embed; single-stack Python experience. |
| Release notes / doc-guide | Optionally mention TS single-stack as a first-class option; no structural change. |

## Next Steps (for follow-up notes or implementation)

1. Decide between Option A (stack-aware Go CLI) and Option B (stack-specific entry points) and update `2026-02-22-cli-language-and-component-combinations.md` accordingly.
2. Propose a short wording change to `docs/goals.md` to state single-stack as the primary model and cross-stack as optional.
3. Document the recommended path for TS-only users (e.g. `npx vecfs` or `npm run mcp` with embedder enabled) so they never need to install the Go CLI unless they want container management or mixed stacks.

## References

- `docs/notes/2026-02-24-single-tech-stack-versions.md` (TypeScript embedder option: fastembed-js).
- `docs/goals.md` (single-stack per language).
- `docs/requirements.md` (MCP tools: search, memorize).
- `docs/notes/2026-02-22-cli-language-and-component-combinations.md` (CLI language and configurable MCP/embed combinations).
- `docs/doc-guide.md` (formatting and structure for docs).
