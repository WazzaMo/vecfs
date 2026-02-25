# TypeScript, Python, and Go Implementation Comparison

Comparison of the three VecFS source trees: layout of the MCP server, vector
embedding library, tools, and VecFS CLI.

# Summary Table

| Aspect            | TypeScript                 | Python                           | Go                                      |
|-------------------|----------------------------|----------------------------------|-----------------------------------------|
| MCP server        | Single process, stdio+HTTP | Single process, stdio+streamable HTTP | Stdio only (separate binary)        |
| In-process embed  | Yes (fastembed)            | Yes (vecfs_embed when installed) | No (vector-only tools)                  |
| Embedder package  | ts-src/embedder/           | vecfs_embed (py-src)             | internal/embed (mock, HF, local)         |
| Tools             | search, memorize, feedback, delete | Same                             | Same (search/memorize require vector)   |
| Query/text API    | search query, memorize text| search query, memorize text      | Not in MCP; use vecfs-embed-go + pipe   |
| Unified CLI       | MCP entry only             | vecfs-py (mcp, version)          | vecfs (container demo only)            |
| Embed CLI         | None (in-process only)     | vecfs-embed                      | vecfs-embed-go                          |

# TypeScript (ts-src)

## Layout

- **mcp-server.ts** — Entry point. Loads config, creates storage and embedder, wires
  `ListTools` / `CallTool` to handlers, then stdio or HTTP/SSE (Express + SSE).
- **tool-schemas.ts** — MCP tool definitions (name, description, inputSchema). Search and
  memorize declare both `vector` and `query`/`text`; descriptions recommend text when
  embedder is available.
- **tool-handlers.ts** — Zod-validated handlers for search, memorize, feedback, delete.
  Uses optional embedder getter for query→vector and text→vector; falls back to
  vector-only when embedder is null.
- **storage.ts** — VecFSStorage: JSONL path, in-memory cache, file mutex; ensureFile,
  store, search (cosine + feedback ranking), updateScore, delete.
- **sparse-vector.ts** — toSparse, dotProduct, norm, cosineSimilarity (L2 norm then
  threshold).
- **embedder/embedder.ts** — Embedder interface; createFastEmbedEmbedder() using
  fastembed (FlagEmbedding BGESmallENV15), document/query mode, threshold.
- **embedder/index.ts** — Re-exports.
- **config.ts** — getConfigPath (VECFS_CONFIG, --config, vecfs.yaml candidates),
  loadConfig; storage.file, mcp.port.
- **file-mutex.ts** — Mutex for serialised file writes.
- **types.ts** — VecFSEntry, SparseVector, SearchResult.

## MCP Server

Single Node process. Uses `@modelcontextprotocol/sdk`: Server, StdioServerTransport,
SSEServerTransport. Tools registered via setRequestHandler(ListToolsRequestSchema,
CallToolRequestSchema). HTTP mode: Express app with GET /sse and POST /messages.

## Vector Embedding

In-process only. No separate embed CLI. fastembed (fastembed-js) loaded lazily in
tool-handlers; embedder getter passed from mcp-server. Supports query (search) and
document (memorize) modes; output converted to sparse via toSparse in sparse-vector.

## Tools

All four tools accept the same semantics as in requirements: search (vector or query,
limit), memorize (id, text or vector, metadata), feedback (id, scoreAdjustment),
delete (id). Responses are text-only content (no vector in search results when
embedder is used, per tool-schemas description).

## VecFS CLI

No multi-command CLI. The npm package builds a single binary (e.g. `vecfs` or
`npx vecfs`) that runs the MCP server. Arguments: `--http` for HTTP mode, `--config`
for config path. Config from vecfs.yaml / env (VECFS_FILE, PORT).

# Python (py-src)

## Layout

Two packages in one repo (one wheel: vecfs_embed + vecfs_py).

**vecfs_embed**

- **cli.py** — vecfs-embed entry: --mode, --batch, --calibrate, --model, --dims,
  --threshold, --config; single text or stdin batch; outputs JSON.
- **embed.py** — Pydantic AI Embedder wrapper; embed_single, embed_batch, calibrate;
  dense→sparse via sparsify (to_sparse_threshold, magnitude_stats, etc.).
- **config.py** — load_config (vecfs.yaml + env); storage_file, mcp_port, embed
  (model, dims, threshold).

**vecfs_py**

- **cli.py** — vecfs-py entry: subcommands `mcp` (--http, --config) and `version`.
  MCP subcommand loads config, creates VecFSStorage, get_embedder_fn(), create_app(),
  then app.run(transport="stdio" or "streamable-http").
- **server.py** — FastMCP app (mcp.server.fastmcp): @mcp.tool() search, memorize,
  feedback, delete. Optional embedder: (text, mode) → sparse dict; if present, search
  accepts query, memorize accepts text; otherwise vector required.
- **embedder_adapter.py** — get_embedder_fn(): if vecfs_embed is importable, returns
  async (text, mode) → dict[int, float] using vecfs_embed.config and embed_single.
- **storage.py** — VecFSStorage: JSONL, async ensure_file, store, search (cosine +
  feedback boost), update_score, delete; same ranking as TS/Go.
- **sparse.py** — normalize_vector_input (sparse/dense), cosine_similarity, norm.

## MCP Server

Single Python process. Official MCP Python SDK (FastMCP). Transports: stdio or
streamable-http via app.run(). Tools defined as async functions on the FastMCP
instance; embedder optional and provided by embedder_adapter when vecfs_embed is
installed.

## Vector Embedding

- **Library:** vecfs_embed (Pydantic AI embedder, sentence-transformers by default;
  optional OpenAI, Google, Cohere, Voyage). Dense→sparse in embed.py using
  vecfs_embed sparsify (or shared sparsify logic).
- **CLI:** vecfs-embed. Single/batch/calibrate; --mode query|document; config and
  env overrides. Used when MCP server is run without vecfs_embed (e.g. external
  process) to produce vectors for search/memorize.
- **In MCP:** When vecfs_embed is installed, get_embedder_fn() provides in-process
  embedding so agents send query/text only.

## Tools

Same four tools. FastMCP decorators with type hints; vector can be dict, list, or
JSON string; normalize_vector_input in server. Search/memorize accept vector or
(query / text) when embedder is set. Response: JSON string (id, metadata, score,
timestamp, similarity; no vector in response).

## VecFS CLI

**vecfs-py** — Unified CLI for the Python stack. Commands: `mcp` (run MCP server,
optionally --http), `version`. No embed subcommand; embedding is either in-process
(vecfs_embed) or external (vecfs-embed CLI).

**vecfs-embed** — Standalone embed CLI (same package, different script). No MCP;
only embedding and calibration.

# Go (go-src)

## Layout

- **cmd/vecfs/main.go** — Main VecFS CLI. Currently only `container demo` (containerd
  start/stop proof-of-concept). No MCP or embed subcommands yet.
- **cmd/vecfs-mcp-go/main.go** — MCP server entry. Load config, create storage,
  EnsureFile, then mcp.RunStdio(st). Stdio only; no HTTP.
- **cmd/vecfs-embed-go/main.go** — Embed CLI. Flags: --config, --mode, --batch,
  --threshold, --model, --dims, --provider (mock, huggingface, local). Reads text
  from args or stdin; outputs JSON (vector, model, non_zero_count, etc.). Uses
  internal/embed.
- **internal/config** — GetConfigPath, LoadConfig; Storage.File, MCP.Port, Embed
  (Provider, Model, Dims, Threshold, LocalURL, HF endpoint/token).
- **internal/mcp** — server.go: JSON-RPC over stdio (tools/list, tools/call);
  tools.go: tool definitions and CallTool (toolSearch, toolMemorize, toolFeedback,
  toolDelete). No embedder: search and memorize require `vector` only.
- **internal/storage** — Storage struct; EnsureFile, Store, Search (cosine + feedback),
  UpdateScore, Delete. Same JSONL format and ranking.
- **internal/sparse** — ToSparse, DotProduct, Norm, CosineSimilarity; Vector type.
- **internal/embed** — Embedder interface (Embed, EmbedBatch, Provider); NewEmbedder(cfg):
  mock, huggingface, local (TEI). Used only by vecfs-embed-go, not by MCP server.

## MCP Server

Separate binary (vecfs-mcp-go). JSON-RPC 2.0 over stdio only (no SDK; custom
read/write). handleRequest dispatches tools/list and tools/call; CallTool delegates
to toolSearch, toolMemorize, toolFeedback, toolDelete. Search and memorize require
vector; no query/text (no in-process embedder in MCP).

## Vector Embedding

- **Library:** internal/embed. Mock (deterministic test vectors), HuggingFace
  inference API, local (e.g. TEI) endpoints. Used by vecfs-embed-go only.
- **CLI:** vecfs-embed-go. Same role as Python vecfs-embed: produce sparse vectors
  for use by an agent or by piping into another process. Go README recommends
  Python vecfs_embed for real models when not using mock.

## Tools

Same four tools; schemas in tools.go (search requires vector; memorize requires id
and vector). Go MCP returns full entry in search (including vector); TS/Python
omit vector in response when using text/query API for clarity.

## VecFS CLI

**vecfs** — Top-level CLI with only `container demo` today. Intended to grow (e.g.
vecfs mcp, vecfs embed) to mirror vecfs-py.

**vecfs-mcp-go** — MCP server binary; no subcommands.

**vecfs-embed-go** — Embed-only binary; no MCP.

# Cross-Stack Alignment

## Shared Behaviour

- JSONL file format (one JSON object per line; vector keys as strings on disk).
- Same tool names and semantics: search (vector or query/text when embedder present),
  memorize (id, text or vector, metadata), feedback (id, scoreAdjustment), delete (id).
- Ranking: cosine similarity + feedback boost (bounded); same weight and formula
  (FEEDBACK_RANK_WEIGHT 0.1, score/(1+|score|)).
- Config lookup: VECFS_CONFIG, --config, vecfs.yaml, .vecfs.yaml,
  ~/.config/vecfs/vecfs.yaml; env VECFS_FILE, PORT, VECFS_EMBED_*.

## Differences

1. **Embedding in MCP:** TS and Python support in-process embedding (query/text);
   Go MCP is vector-only. Agents using Go MCP must use vecfs-embed-go (or
   vecfs-embed) to get vectors and pass them in.
2. **Transport:** TS: stdio + HTTP/SSE. Python: stdio + streamable-http. Go: stdio only.
3. **Unified CLI:** Python has vecfs-py (mcp, version). TS has no multi-command CLI
   (just the MCP server binary). Go has vecfs but only container demo so far.
4. **Embed CLI:** Python and Go have a dedicated embed CLI; TS has none (embedding
   only inside the MCP process).
5. **Search response:** Go returns vector in each search result; TS and Python
   describe text-only results and omit vector when using the text/query API.

This note supports docs/goals.md (single-stack per language) and
docs/notes/2026-02-24-single-tech-stack-versions.md.

# Actions for today - a to-do list

1. The ability to start and stop containers directly in go is not graceful
   and it muddies the focus of the program. We should make it a config option
   to choose the container runtime - docker or podman - and because
   they have similar CLI command structure, we can treat them as equivalent.
   For now, let's only do this for the go implementation because the
   Go Hugging Face vector embedder library requires it.

  a)  Remove the code from vecfs-go that handled containers directly and
      have it invoke docker or podman, as configured, to ensure any needed
      embedding model containers are running when needed.

  b)  Trigger events for starting containers and stopping them when vecfs
      is being used at the start of an agent session and is being released
      at the end of the agent session will be important.
  
  c)  If post-session clean up, being the session end event, cannot be done,
      we'll need to give the user a way to perform this themselves that
      is convenient.
  
  d)  Create unit and integration tests that support these operations
      of working with golang's implementation. This could even use mock
      docker program to signal when the container would have started
      and stopped, for input to assertions that docker coordination should
      work.

2. Change the MCP server request and response schema to accept text only
   and not vectors. "Search" commands will be semantic search, to find text
   meaning the same as the given text. This forces the internal embedder
   to be used to vectorise the memory and to use internal semantic search.
   This forces all implementations to be vector-free in their invocation
   so that only vecfs internal vectors will be used in the local memory
   file and that makes vecfs agnostic of agent and model used.

3. Make sure all vecfs CLI programs consistent in pattern and command.

  a)  Make sure all vecfs CLI programs have the filename vecfs-{language}
      where "language" is go | py | ts; as one of the supported stacks.
  
  b)  Make sure all the options for the vecfs CLI programs are
      the same for consistency, so that the skills.md files will
      be able to describe the CLI and the command to use consistently.

4. Make the golang MCP server use vector embedding code internally
   so it does not need to run another program.
  
  a)  Make common source code for generating vectors from text
      
  b)  Have both the vecfs-embed-go and vecfs-mcp-go use the
      same common code to generate vectors from text.

5. Review the consistency of the vecfs-embed-{language} programs
   as these should be tools to search the memory directly for a user.
  
  a)  Do the commands exist in all implementations? If not implement it.

  b)  Do the commands follow the name convention vecfs-embed-{language}?
      If not rename it.
  
  c)  Do the commands take the same parameters? If not summarise the
      differences and let me know so we can find the right common set.
