# Cross-Model Embedding Compatibility

## Purpose

When an agent uses the VecFS MCP server, stored vectors may have been produced by a different embedding model than the one the server uses for query embedding. This note summarises the problem, possible solutions, and a recommended approach.

## The Problem

Vector similarity search is only meaningful when the query vector and the stored document vectors lie in the **same embedding space**. If documents were embedded with model A and the server embeds the agent’s query with model B, similarity scores are not comparable and retrieval quality is poor or meaningless.

### Agent perspective

- If the agent sends a **text** query and the server embeds it with its own model, search works only when stored vectors were also produced by that same model.
- If stored vectors were produced by a “foreign” model (e.g. Python vecfs-embed, another service, or a different run of the server with another model), text-based search on this server does **not** work well unless the server uses the same model for queries.
- The agent cannot usefully “adapt” stored vectors to its own embedding model through the current API; it can only align to the store by either using the server’s model (via text) or by sending a pre-computed vector from the same model that produced the store.

## Agent Experience: Using Text for MCP Commands

### Issuing commands with text

Using **text** as the way MCP commands are issued works well for the agent when the server has an embedder and uses one canonical model:

- **memorize with text:** The agent sends `memorize` with `id` and `text` (no vector). The server embeds the text and stores the resulting vector. The agent does not need to compute or supply vectors. This is effective and simple.
- **search with query text:** The agent sends `search` with `query` (a natural-language string) and optional `limit`. The server embeds the query and runs similarity search. Again, the agent does not need to handle vectors. This works well for recall and context injection.

So for the typical flow—store snippets with text, search with a text query—**text as the input to memorize and search is effective** and avoids the agent having to run or call an embedding model.

### Response payload: is it always text? Do we need vectors in the response?

- **Transport:** MCP tool responses are always delivered as content with `type: "text"`. The payload is a string (for search, a JSON string). So from the agent's point of view, the **response is always text**; there is no separate binary or vector channel.
- **What's inside the search response today:** The server returns the full search results as JSON. Each result is a full entry: `id`, `metadata`, `vector`, `score`, `timestamp`, and `similarity`. So the **vector is included** in every hit. The stored text the agent cares about is in `metadata.text` (or similar).
- **Does the agent need vectors in the response?** No. For reasoning, summarising, or showing context to the user, the agent only needs:
  - `id` (for feedback, delete, or reference)
  - `metadata` (including the stored text)
  - `similarity` (to judge relevance)
  The raw vector is not used by the agent for display or further reasoning. Returning it increases payload size and exposes internal representation without benefit to the agent.

### Avoiding vectors in the response to the agent

We can avoid returning vectors to the agent:

- **Option A:** Omit `vector` from the search response by default. The server serialises each result as `{ id, metadata, score, timestamp, similarity }` only. The agent receives a text payload (JSON) that is smaller and focused on what it needs.
- **Option B:** Add a parameter to `search` (e.g. `includeVector: false` default, or `includeVector: true` for callers that need it). Same effect, with an escape hatch for debugging or special tools.

Recommendation: **omit vectors from the search response** (or make that the default). The agent can work entirely with text in and text out: text for memorize and search, and a text response containing ids, metadata (with stored text), and similarity scores. Vectors stay internal to the server unless explicitly requested.

## Possible Solutions

### Option 1: Single canonical model per store (current design)

The server has one embedder. All `memorize`-with-text and `search`-with-query use that model. Anything stored with text is in the same space as queries.

- **Pros:** Simple, no schema change, works out of the box for single-stack and same-model workflows.
- **Cons:** If data was ever embedded elsewhere, the store is in the “wrong” space for text search until re-embedded with the server’s model.

### Option 2: Store embedding model identity in metadata

When storing a vector (from text or supplied), record which model produced it (e.g. `embedding_model: "fastembed/BGESmallENV15"` or `embedding_model: "openai/text-embedding-3-small"`). Reject or warn when the agent sends a text query and the store uses a different model than the server’s current embedder.

- **Pros:** Makes mismatch explicit; agent or UI can warn or refuse text search when models differ.
- **Cons:** Does not fix the mismatch; only detects it. Agent still cannot do text search over a foreign-model store without re-embedding or sending a vector.

### Option 3: Agent sends vectors for search (no server-side query embedding)

Do not embed the query on the server. Require the agent to pass a **vector** to `search` that was produced by the same model that produced the stored vectors. The server never embeds query text; it only compares vectors.

- **Pros:** Works with any single model: as long as the agent can obtain vectors from that model (e.g. via another tool or API), search is consistent. Supports “foreign” stores.
- **Cons:** The agent must have access to the same embedding model as the store and must call it before every search. No convenience of “just send query text” when the store is from another model.

### Option 4: Re-embed on read (proxy / adapter)

When the server’s embedder differs from the model that produced the store, re-embed stored **text** (if available in metadata) with the server’s model on read, or run a background job to re-embed and replace vectors.

- **Pros:** Eventually all vectors in a given store can be in the server’s space so text search works.
- **Cons:** Requires stored text to be present and re-embedding can be expensive and slow; duplicates or replaces vectors; needs a clear notion of “source model” and possibly versioning.

### Option 5: Multi-space index (multiple embedding models)

Store supports multiple “spaces” or “models”; each entry is tagged with its model. The server has embedders for one or more models. For `search` with text, the server embeds with a specified or default model and searches only within that space.

- **Pros:** Can support several models in one store; agent chooses which space to query.
- **Cons:** More complex schema, config, and indexing; agent must know which model a given memory used; still no “adapt to my model” without that model being one of the supported ones.

## Recommendation

**Best solution: keep a single canonical model per store (Option 1) and document the rule; add optional model identity (Option 2) for clarity.**

- **Default behaviour:** One server embedder, one vector space. All text-based memorize and search use that model. This is simple, predictable, and efficient.
- **Document clearly:** In user and agent docs, state that “query and documents must be in the same embedding space”; when using text with this server, that means “everything is embedded with this server’s model.” If data was produced elsewhere, either re-embed it into this server’s model (e.g. re-run memorize with text, or a one-off migration) or do not use text search—have the agent obtain a query vector from the same model that produced the store and call `search` with that vector.
- **Optional improvement:** Persist an optional `embedding_model` (or similar) in entry metadata when the server embeds text. Use it to warn or document which space an entry belongs to. This does not change semantics but helps operators and future tooling detect mismatches and decide whether to re-embed or restrict to vector-only search.

Avoid for now: re-embed on read (Option 4) and multi-space indexing (Option 5) unless product requirements explicitly need them; they add significant complexity. The “agent sends vectors when the store is foreign” path (Option 3) is already supported by the existing API (search accepts a vector) and should be described in documentation as the way to support foreign-model stores without changing the server.

## Summary

| Situation | Approach |
|-----------|----------|
| All data stored and queried via this server with text | Use server’s embedder only (Option 1). Works today. |
| Store was filled by another model | Agent embeds query with that same model and passes vector to `search` (Option 3). Document this. |
| Future clarity | Optional `embedding_model` in metadata (Option 2). |
| Agent text in/out | Text for memorize and search works well. Omit vectors from search response so the agent gets text-only payloads (id, metadata, similarity). |

The best solution is to **recommend one canonical model per store**, support **vector-only search** for foreign-model compatibility, **optionally record model identity** so agents and operators can reason about which space they are in, and **omit vectors from search responses** so the agent can work entirely with text in and text out.
