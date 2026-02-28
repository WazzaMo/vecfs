# Switch to Transformers.js and Local Embedder Options

## Purpose

Document the rationale for moving away from fastembed, list local embedding options for the TypeScript stack, and provide a plan for evaluating each option.

## Context

The current TypeScript embedder uses fastembed (fastembed-js). Two issues motivate a change:

1. Tar vulnerability: fastembed depends on tar ^6.2.0, which has high-severity vulnerabilities. Tar 7.x fixes these but uses named exports only; fastembed does `import tar from "tar"` and breaks under tar 7.x. See `docs/notes/2026-02-28-tar-vulnerability-audit-fix.md`.

2. Archived upstream: The fastembed-js repository was archived in Jan 2026. No upstream fixes for tar compatibility or security are expected.

## Local Embedder Options

### Option A: Transformers.js

Package: `@huggingface/transformers`

Hugging Face's JavaScript library for running models in Node and the browser. Supports `feature-extraction` and `sentence-similarity` pipelines. Uses ONNX Runtime; no tar dependency. Active maintenance.

### Option B: ONNX Runtime with a pre-converted model

Package: `onnxruntime-node`

Load a pre-converted ONNX embedding model (e.g. from Hugging Face Hub) and run inference directly. More low-level than Transformers.js; requires manual tokenization and model wiring. No tar dependency if model is fetched via HTTP or pre-bundled.

### Option C: Patched fastembed fork

Fork fastembed-js and change the tar import from `import tar from "tar"` to `import * as tar from "tar"` (or use named imports). Would allow npm override to tar 7.5.8+ and fix the vulnerability. Maintains existing API and model behaviour.

### Option D: External embedding service (local TEI)

Run [Text Embeddings Inference](https://github.com/huggingface/text-embeddings-inference) (TEI) as a local container or process; VecFS MCP server calls it over HTTP. Not in-process but avoids Node embedding dependencies entirely. Already used by the Go stack.

## Plan for Trying Each Option

### Phase 1: Transformers.js (primary candidate)

1. Add `@huggingface/transformers` as a dependency.
2. Create `createTransformersJsEmbedder()` in `ts-src/embedder/` that:
   - Uses `pipeline('feature-extraction', modelId)` or `pipeline('sentence-similarity', modelId)`.
   - Maps document/query mode to appropriate usage (sentence-similarity may handle both; feature-extraction may need different handling for query vs passage).
   - Returns dense vector, then applies `toSparse(..., threshold, true)` as today.
3. Add a config or env switch to choose embedder: `fastembed` (default for backward compat) vs `transformers`.
4. Run integration tests with Transformers.js embedder.
5. Measure: cold start time, first-embed latency, memory usage, output quality vs fastembed on a small test set.

### Phase 2: ONNX Runtime direct

1. Identify a suitable ONNX embedding model (e.g. all-MiniLM-L6-v2 or BGE small from Hub).
2. Create `createOnnxEmbedder()` that loads the model via `onnxruntime-node`, implements tokenization (or uses a separate tokenizer package), and runs inference.
3. Wire to `toSparse` as above.
4. Compare with Phase 1 on latency, memory, and quality.

### Phase 3: Patched fastembed fork

1. Fork fastembed-js (or create a minimal patch via patch-package).
2. Change tar import to support tar 7.x.
3. Add npm override `"tar": "^7.5.8"` and verify fastembed loads.
4. Run full test suite. If successful, this is the lowest-effort path to fix the vulnerability without changing embedder behaviour.

### Phase 4: Decision and implementation

1. Compare all options on: security (no vulnerable deps), maintenance burden, API fit, performance, and quality.
2. Choose primary embedder for the TypeScript stack.
3. Update `mcp-server.ts` to use the chosen embedder; deprecate or remove fastembed if replaced.
4. Update `embed-cli.ts` if it uses the embedder.
5. Document the choice in `docs/goals.md` and `docs/requirements.md` as needed.

## Success Criteria

- TypeScript embedder runs without high-severity npm audit issues.
- Integration tests pass with the chosen embedder.
- Embedder remains optional (server works with vector-only when embedder unavailable).
- Document/query mode semantics are preserved for text-based memorize and search.

## Implemented (2026-02-28)

### Phase 1: Transformers.js

- Added `@huggingface/transformers` dependency.
- Created `createTransformersJsEmbedder(modelId?)` in `ts-src/embedder/transformers-embedder.ts`. Uses `pipeline('feature-extraction', modelId)` with Xenova/all-MiniLM-L6-v2 as default; pooling mean, normalize true; then `toSparse`.
- Config: `embedder.provider` and `embedder.model` in vecfs.yaml; `VECFS_EMBEDDER` env overrides provider.
- All 60 tests pass with `VECFS_EMBEDDER=transformers`.

### Phase 2: ONNX direct

- Created `createOnnxEmbedder(modelId?)` in `ts-src/embedder/onnx-embedder.ts`. Uses `AutoTokenizer` and `AutoModel` from Transformers.js with manual mean pooling and L2 normalisation. Lower-level than the pipeline.
- All 60 tests pass with `VECFS_EMBEDDER=onnx`.

### Usage

```yaml
# vecfs.yaml
embedder:
  provider: transformers   # or fastembed, onnx
  model: Xenova/all-MiniLM-L6-v2   # optional; defaults vary by provider
```

Or: `VECFS_EMBEDDER=transformers node dist/mcp-server.js`

### Phase 3: Patched fastembed

- Created patch via patch-package: change `import tar from "tar"` to `import * as tar from "tar"` (ESM) and `require("tar")` instead of `__importDefault(require("tar"))` (CJS).
- Added npm override `"tar": "^7.5.8"` and `postinstall: "patch-package"`.
- `npm audit` reports 0 vulnerabilities. All 63 tests pass with default fastembed.

### Phase 4: Decision

- **Primary embedder:** fastembed (default), patched for tar 7.x compatibility. Maintains backward compatibility and fixes the vulnerability.
- **Alternatives:** Transformers.js and ONNX direct remain available via `embedder.provider` or `VECFS_EMBEDDER`.
- **Documentation:** Updated `docs/goals.md` and `docs/requirements.md` with embedder configuration.

## Performance Test Plan

A performance comparison across embedders (fastembed, transformers, onnx) can measure the following.

### Cold start and first-embed latency

Time from process start until the first successful `embedText()` completes. Includes model download (if cache miss), load into memory, and first inference. Run a fresh Node process per embedder, trigger one embed, record elapsed time. Repeat with warm cache (model already on disk) to separate download from load+infer.

### Warm embed latency

Time for a single embed once the model is loaded. Run N embeds (e.g. 100) in sequence, record each duration. Report mean, median (p50), p95, p99. Use a fixed input (e.g. "Hello world" or a 50-word passage) to keep variance low.

### Memory usage

Measure RSS (resident set size) via `process.memoryUsage()` at: (a) after model load, before any embed; (b) after 10 warm embeds; (c) after 100 embeds. Compare across embedders. Optionally run under `node --expose-gc` and call `global.gc()` before each measurement to reduce noise.

### Throughput

Embeds per second: run K embeds (e.g. 1000) as fast as possible, divide total wall time by K. Compare single-text vs batch (if an embedder supports batching). Document batch size when applicable.

### Retrieval quality (optional)

Store a small corpus (e.g. 20–50 passages) with each embedder, then run the same set of queries and compare top-k recall or MRR. Note: fastembed uses BGE small, Transformers.js/ONNX use all-MiniLM-L6-v2, so vectors are not directly comparable; quality comparison is only meaningful when the same model is used or when comparing end-to-end retrieval on a shared task.

### Test harness

A small script or vitest describe block can: spawn a subprocess per embedder with `VECFS_EMBEDDER` set; send a memorize then search via JSON-RPC; record timings. Alternatively, call `createFastEmbedEmbedder()`, `createTransformersJsEmbedder()`, `createOnnxEmbedder()` directly and time `embedText()` in-process.

## Performance Test Results

Run: `npm run test:perf` or `npx vitest run embedder-perf`

Environment: WSL2/Linux, Node v24, CPU only. Models cached on disk (no download during run). Test text: 9 words. Warm runs: 50 per embedder.

### fastembed

First embed 49 ms, warm mean 50 ms, p50 46 ms, p95 78 ms. Throughput ~20/s. RSS 361 MB after load, 390 MB after warm.

### transformers

First embed 8 ms, warm mean 2.2 ms, p50 2.0 ms, p95 2.8 ms. Throughput ~458/s. RSS 315 MB after load, 320 MB after warm.

### onnx

First embed 3.8 ms, warm mean 1.8 ms, p50 1.7 ms, p95 2.2 ms. Throughput ~551/s. RSS 430 MB after load, 431 MB after warm.

### Summary

Transformers and ONNX are ~25–28× faster than fastembed on warm embeds and use similar or less memory (onnx slightly higher). Fastembed uses BGE small; the others use all-MiniLM-L6-v2.

### Caveats

- fastembed uses BGE small (BGESmallENV15); transformers and onnx use all-MiniLM-L6-v2. Different models and sizes.
- First embed includes any lazy init; fastembed's init loads the model before create returns, so first embed is already warm. For transformers/onnx, pipeline/model creation happens in create, so first embed is also post-load.
- Cold start from process (including model download) was not measured; models were pre-cached.
- Results vary by machine; these are indicative only.
