# Need for a vecfs-search Tool

## Purpose

Record that VecFS needs a **vecfs-search** tool (or equivalent) so that users and scripts can query the vector store from the command line without going through an agent or the MCP server interactively.

# Why it is needed

The MCP server exposes a `search` tool for agents. There is no standalone way for a user to run a search from the shell (e.g. “find memories about X” or “show recent entries matching this query”). The embedding script (vecfs_embed / vecfs-embed-go) can produce a vector for a query, but the user would still need to call the MCP server with that vector; there is no single command that takes natural language or text and returns search results.

# What vecfs-search would do

A **vecfs-search** tool would:

- Accept a search query (text or optionally a pre-computed vector).
- If the query is text: use the configured embedder (Python or Go) to produce a vector, then query the vector store.
- Return ranked results (e.g. ID, snippet, score) to stdout or a structured format (JSON) for scripting.

It could be a subcommand of the vecfs CLI (e.g. `vecfs search "query"`) or a separate binary (e.g. `vecfs-search`). It would read the same `vecfs.yaml` and storage path as the rest of VecFS.

# Relation to existing pieces

| Component        | Role                                      |
|------------------|-------------------------------------------|
| MCP `search`     | Agent-facing tool; accepts vector/query.  |
| vecfs_embed      | Produces vectors from text (query/docs).  |
| vecfs-search     | User/CLI: text in, search results out.   |

vecfs-search would combine embedding (when query is text) and storage access (direct file read or via MCP client), so users get one command to search without running an agent.

# Next steps

- Decide whether vecfs-search is a `vecfs search` subcommand or a separate binary.
- Implement a minimal version (e.g. `vecfs search "query"` that uses the configured embedder and storage path, outputs top-k results).
- Document in requirements/skills if it becomes part of the standard tool set.
