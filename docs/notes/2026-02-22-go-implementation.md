# Go Implementation Note

## Purpose

This note describes the Go implementation in `go-src/`: its role, strengths and weaknesses
relative to the TypeScript (ts-src) and Python (py-src) implementations, and how to run
performance comparisons.

## Scope of the Go Implementation

The Go tree provides:

- vecfs-mcp-go — MCP server (stdio JSON-RPC), feature-parity with the Node/TS vecfs-mcp for
  tools (search, memorize, feedback, delete) and config (vecfs.yaml, env overrides).
- vecfs-embed-go — CLI with pluggable embedders: **mock** (default), **huggingface** (HF Inference
  API), or **local** (e.g. Text Embeddings Inference). Configure via `embed.provider` or
  `--provider`; compare providers by switching and re-running.

Shared logic lives in internal packages: sparse, storage, config, mcp, embed (interface + mock,
huggingface, local). Unit
tests are aligned with the TS and Py test cases so behaviour stays consistent across
implementations.

## Strengths

### Single binary, no runtime dependency

vecfs-mcp-go and vecfs-embed-go build to static executables. There is no need to install
Node or Python on the host; the binary can be copied and run. This simplifies deployment
in containers, CI, and minimal environments.

### Lower memory footprint and fast startup

A typical Node process loads the V8 runtime and the bundled JS; the Go server starts with
a small fixed cost. For short-lived or many concurrent MCP processes, Go can use less
memory and start faster. This helps when the MCP server is started per-request or
frequently restarted.

### Strong concurrency and safety

Storage and tool handlers use a single mutex; the Go runtime schedules goroutines without
the single-threaded JS event loop. Under concurrent load, the Go server can handle
request handling and I/O without extra configuration. Type safety and the standard
library reduce the risk of runtime type errors compared to a dynamic language.

### Good fit for CLI and system integration

The embed CLI is a single binary; scripting and piping (e.g. from shell or other processes)
do not depend on a specific interpreter. Go’s standard library covers config, JSON, and
file I/O well, so the code stays straightforward and easy to maintain.

### Test parity and cross-checking

Go unit tests mirror the TS and Py cases (sparse math, storage, config, MCP tools). Any
discrepancy in behaviour can be caught by comparing test outcomes across the three
implementations, which improves confidence when changing the spec or adding features.

## Weaknesses

### Embedding provider choice and comparison

vecfs-embed-go supports three providers via a single **Embedder** interface; choice is
configurable so you can compare behaviour and performance.

- **mock** (default): Hash-based sparse vectors, no network. Use for tests and offline
  validation.
- **huggingface**: Calls the [Hugging Face Inference
  API](https://huggingface.co/docs/api-inference) using
  [go-huggingface](https://pkg.go.dev/github.com/hupe1980/go-huggingface). Set
  `provider: huggingface`, `embed.model` (e.g. `sentence-transformers/all-MiniLM-L6-v2`),
  and `HUGGINGFACEHUB_API_TOKEN`. Optional: `embed.huggingface_endpoint` to override the
  API base URL.
- **local**: Calls a local [Text Embeddings Inference
  (TEI)](https://github.com/huggingface/text-embeddings-inference) server at
  `embed.local_base_url` (default `http://localhost:8080`). Run TEI with the same model
  (e.g. `sentence-transformers/all-MiniLM-L6-v2`) then use `provider: local` and optionally
  `VECFS_EMBED_LOCAL_URL`. No API token.

Config: `vecfs.yaml` under `embed` supports `provider`, `model`, `threshold`, `local_base_url`,
`huggingface_endpoint`. Env: `VECFS_EMBED_PROVIDER`, `VECFS_EMBED_MODEL`, `VECFS_EMBED_LOCAL_URL`,
`VECFS_EMBED_HF_ENDPOINT`. CLI: `--provider`, `--model`, `--threshold`. Output JSON includes
`provider` so you can confirm which backend was used when comparing runs.

### Smaller ecosystem for MCP and ML

The official MCP SDK and most MCP examples are TypeScript/JavaScript. The Go server
implements the JSON-RPC and tool contract by hand. There is no canonical Go MCP library
to track. For embedding models, the Python ecosystem (sentence-transformers, etc.) is
much richer than Go, so the Go implementation does not try to replicate that.

### Duplication of behaviour and fixes

Logic is duplicated across TS, Py, and Go. A bug fix or spec change (e.g. ranking formula,
config lookup order) must be applied in three places. The test parity helps, but
refactoring and feature work are more expensive than in a single-language stack.

### HTTP/SSE mode not implemented

The Node vecfs-mcp supports `--http` (Express + SSE) for remote clients. The Go server
only supports stdio. Environments that rely on HTTP/SSE cannot use vecfs-mcp-go without
adding an HTTP layer (e.g. a small proxy or a new Go HTTP transport).

### Fewer contributors and examples

VecFS documentation and examples are oriented around Node and Python. Developers
expecting to extend or debug the MCP server may find more community and examples for the
TS version. The Go code is documented and tested but remains a second implementation.

## Performance Comparison

### Methodology

Comparisons focus on the MCP server (vecfs-mcp vs vecfs-mcp-go) because both implement the
same tools and storage. A driver script sends a fixed workload over stdio (JSON-RPC) and
measures wall-clock time. The embed path is not compared quantitatively: the Go embed CLI
uses a mock, and the Python embed uses a real model, so they are not like-for-like.

Workload: sequential requests to the same server process — e.g. 50 × memorize (distinct
ids, small vectors) then 50 × search. The server uses a single JSONL file on disk. No
HTTP; stdio only so that Node and Go are under the same conditions.

Environment: run on the same machine, same data directory (or equivalent temp dir), and
no other heavy processes. Report total time and, if useful, time per request. Repeating the
run multiple times and taking the median reduces noise.

### How to run the benchmark

A small driver is provided so you can reproduce results on your machine.

1. Build both servers:
   - Node: from repo root, `npm run build` (produces `dist/mcp-server.js`).
   - Go: `cd go-src && go build -o vecfs-mcp-go ./cmd/vecfs-mcp-go/`.

2. From the repo root, run the benchmark script (see `scripts/benchmark-mcp.sh`). It
   starts the server under test with a temp data file, sends the workload, and prints
   total time. Example:
   - `./scripts/benchmark-mcp.sh node` — run against Node server.
   - `./scripts/benchmark-mcp.sh go` — run against Go server (path to `go-src/vecfs-mcp-go` or similar).

3. Record the reported “Total time (ms)” for each implementation and compare.

### Interpreting results

Go will often finish the same workload in less wall-clock time and with lower memory use,
especially for many small requests, because of lower per-request overhead and a
single-process design without the V8 runtime. Node may be faster in some I/O-bound or
JSON-heavy cases depending on V8 optimisations. Differences of a few tens of percent are
typical; order-of-magnitude differences suggest an environmental or workload bug.

Use the comparison to inform deployment (e.g. choosing Go for resource-constrained or
high-concurrency scenarios) rather than as the only criterion; correctness and
ecosystem fit matter as much as raw throughput.

### Sample results

The following table was produced on a single machine (Linux, WSL2) with the default
workload: 1 × tools/list + 50 × memorize + 50 × search (101 requests total). Each
implementation was run three times; the table shows median total time and average
time per request.

| Implementation | Total time (ms) | Avg per request (ms) |
|----------------|-----------------|----------------------|
| Node (vecfs-mcp) | ~214 | ~2.1 |
| Go (vecfs-mcp-go) | ~21  | ~0.2 |

In this run the Go server completed the same workload in roughly one-tenth the
wall-clock time. Differences will vary with hardware, OS, and load; the benchmark
script is provided so you can reproduce and compare on your own environment.

### Embedding benchmark

A separate script compares **vector embedding** across three implementations, each
run N times (parameter, default 30) with min/avg/max wall-clock time reported:

- **Python**: vecfs_embed (`python3 -m vecfs_embed.cli`, PYTHONPATH=py-src) using
  sentence-transformers (or configured model).
- **Go local**: vecfs-embed-go with `--provider local` (TEI via
  `sentence-transformer-compose.yaml`).
- **Go HuggingFace**: vecfs-embed-go with `--provider huggingface` (HF Inference API).

Prerequisites: for Go local, start TEI with
`docker compose -f sentence-transformer-compose.yaml up -d`. For Go HuggingFace, set
`HUGGINGFACEHUB_API_TOKEN` or `embed.huggingface_token` in config.

From repo root:
`./scripts/benchmark-embed.sh [runs]` (e.g. `./scripts/benchmark-embed.sh 30`).

## Summary

The Go implementation adds a portable, low-overhead MCP server and a mock-based embed CLI,
with test parity to TS and Py. Its main strengths are single-binary deployment, lower
resource use, and concurrency; its main weaknesses are no real embedding in Go, no
HTTP/SSE server, and duplicated logic across three codebases. Performance comparisons
should use the provided benchmark script and the same workload and environment for both
Node and Go.
