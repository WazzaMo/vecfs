# Single Tech-Stack Versions of VecFS Tools

## Purpose

Outline the goal of offering full VecFS capability (embedder and MCP server) in each of the three supported tech stacks (Go, Python, TypeScript). Document current gaps and research findings for filling them: a Python MCP server and a TypeScript embedder.

# Current State

## Go

Go already provides a single tech-stack experience: both the embedder and the MCP server are implemented in Go (vecfs-embed-go, vecfs-mcp-go), with shared storage and sparse-vector logic. The main `vecfs` CLI can orchestrate these components.

## Python

Python currently has vecfs-embed only. It provides model-agnostic text-to-sparse-vector conversion (Pydantic AI, Sentence Transformers, cloud providers). There is no Python MCP server; users who want MCP with a Python embedder must run the TypeScript or Go MCP server and call the Python embedder separately (e.g. via CLI or subprocess).

## TypeScript

TypeScript has the MCP server (ts-src: tool-handlers, storage, sparse-vector, HTTP/stdio transport). The server accepts pre-computed vectors for search and memorize; it does not perform embedding. There is no TypeScript embedder, so a "TypeScript-only" user must use an external embedder (e.g. vecfs-embed, vecfs-embed-go, or an API).

# Target: Python MCP Server

## Option: Official MCP Python SDK

The [modelcontextprotocol/python-sdk](https://github.com/modelcontextprotocol/python-sdk) is the official Python implementation of MCP. It implements the full specification: servers, clients, resources, tools, prompts, and standard transports (stdio, SSE, Streamable HTTP). The README documents v1.x as current stable; main branch is developing v2 (pre-alpha).

### FastMCP in the official SDK

The SDK provides a **FastMCP** server class (`mcp.server.fastmcp.FastMCP`) that simplifies building servers: decorators for `@mcp.tool()`, `@mcp.resource()`, `@mcp.prompt()`, context injection, structured output, and lifespan. Example quickstart shows a calculator tool, dynamic resource, and prompt; running with `mcp.run(transport="streamable-http")` or stdio. Installation: `uv add "mcp[cli]"` or `pip install "mcp[cli]"`.

### Suitability for VecFS

The official SDK is well-suited as a base for a Python VecFS MCP server: standard protocol, active maintenance, and FastMCP for defining search, memorize, and feedback tools that delegate to VecFS storage and optionally to vecfs-embed for text-to-vector. The Python server could share configuration and file format with the existing vecfs-embed and other language implementations.

## Option: FastMCP (gofastmcp.com)

The documentation at [gofastmcp.com/servers/server](https://gofastmcp.com/servers/server) describes a **FastMCP** server class that is the "core FastMCP server class for building MCP applications." The API is very similar to the official SDK's FastMCP: `FastMCP(name=...)`, `@mcp.tool`, `@mcp.resource`, `@mcp.prompt`, tag-based filtering, custom routes, and transports (STDIO, HTTP, with SSE deprecated). The site presents this as the central piece of every FastMCP application.

### Relationship to the official SDK

The gofastmcp.com documentation appears to describe the same FastMCP that lives inside the official [modelcontextprotocol/python-sdk](https://github.com/modelcontextprotocol/python-sdk) (the SDK's FastMCP is in `mcp.server.fastmcp`). The "mature library" for Python MCP is therefore the official SDK, with FastMCP as its high-level server API. A VecFS Python MCP server would use `mcp` (from the official repo) and implement VecFS tools and resources on top of it.

# Target: TypeScript Embedder

## Option: fastembed-js

[fastembed-js](https://github.com/Anush008/fastembed-js) is a TypeScript/Node implementation inspired by Qdrant's fastembed. It provides:

- ESM and CommonJS support.
- Batch embeddings via async generators (`embed()`, `passageEmbed()`, `queryEmbed()`).
- Default model: Flag Embedding (BGE small), with other BGE, MiniLM, and multilingual E5 models.
- Quantized weights and ONNX Runtime for CPU/GPU inference; no Huggingface Transformers dependency.
- Strong accuracy (e.g. MTEB leaderboard) and performance.

Install: `npm install fastembed`. Usage: `FlagEmbedding.init({ model: EmbeddingModel.BGEBaseEN })`, then `embeddingModel.embed(documents, batchSize)` or `passageEmbed` / `queryEmbed` for passage/query-specific embeddings.

### Suitability for VecFS

fastembed-js fits a Node/TypeScript embedder that runs entirely in-process: same process as the TS MCP server could call it to turn text into vectors, then convert to VecFS sparse format (thresholding, dimension indexing). A vecfs-embed-ts or similar package could wrap fastembed-js and expose a CLI and library API aligned with vecfs-embed (e.g. `--mode query|document`, `--batch`, `--threshold`).

## Option: Transformers.js

[Transformers.js](https://huggingface.co/docs/transformers.js/index) runs Hugging Face models in the browser and Node using ONNX Runtime. It supports many tasks (NLP, vision, audio, multimodal), including **feature-extraction** and **sentence-similarity**, which are the building blocks for text embeddings. The API is pipeline-based (`pipeline('feature-extraction', modelId)`), with options for device (WASM/WebGPU), quantization (e.g. q4, q8), and model selection from the Hub.

### Suitability for VecFS

Transformers.js is a viable alternative for a TypeScript embedder when broader model support or browser compatibility is desired. For a VecFS embedder focused on server-side or CLI use, fastembed-js may be simpler (embedding-focused API, passage/query distinction). Transformers.js is better if we need a wide range of Hub models or future browser-based embedding. Both can feed into the same sparse-vector conversion step.

# Summary

| Stack     | Embedder              | MCP server              | Single-stack? |
|-----------|------------------------|--------------------------|---------------|
| Go        | vecfs-embed-go        | vecfs-mcp-go             | Yes           |
| Python    | vecfs-embed           | Missing                  | No            |
| TypeScript| Missing               | ts-src (vecfs-mcp)       | No            |

To achieve single tech-stack versions:

- **Python:** Add a Python MCP server using the official [modelcontextprotocol/python-sdk](https://github.com/modelcontextprotocol/python-sdk) and its FastMCP API; implement VecFS tools (search, memorize, feedback) and optionally integrate with vecfs-embed for text-to-vector in the same process or via subprocess.

- **TypeScript:** Add a TypeScript embedder (e.g. vecfs-embed-ts) using [fastembed-js](https://github.com/Anush008/fastembed-js) as the primary in-process embedding backend, with [Transformers.js](https://huggingface.co/docs/transformers.js/index) as an alternative for broader models or browser use; produce sparse vectors compatible with the existing ts-src storage and MCP tools.

Implementation plans for each addition should be recorded in dated notes and aligned with `docs/goals.md` and `docs/requirements.md`.
