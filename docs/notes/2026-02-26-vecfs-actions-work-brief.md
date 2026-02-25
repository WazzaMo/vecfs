# VecFS Actions Work Brief (2026-02-26)

Reference for the "Actions for today" to-do list in
[2026-02-26-ts-py-go-implementation-comparison.md](2026-02-26-ts-py-go-implementation-comparison.md).
Use this brief to preserve context and scope when implementing the five action streams.

# Scope at a Glance

| Items | Scope    | Focus |
|-------|----------|--------|
| 1, 4  | Go only  | Container runtime (docker/podman), in-process embedding in Go MCP |
| 2, 3, 5 | All stacks (TS, Python, Go) | Text-only MCP API, unified CLI naming/options, vecfs-embed-* consistency |

# Action 1 — Go container runtime (Go only)

Replace direct containerd usage with configurable docker or podman. Treat docker and
podman as equivalent (similar CLI). Goal: invoke docker or podman as configured so
embedding model containers are running when needed.

- **1a** Remove code that handled containers directly; have vecfs-go invoke docker or
  podman as configured to ensure embedding model containers are running when needed.
- **1b** Trigger start/stop around agent session: start containers at session start,
  release at session end.
- **1c** If session-end cleanup cannot be guaranteed, provide a convenient way for
  the user to perform cleanup themselves.
- **1d** Add unit and integration tests for container coordination; consider a mock
  docker program to assert start/stop behaviour.

# Action 2 — Text-only MCP API (all stacks)

Change MCP request/response schema to accept **text only**, not vectors. Search becomes
semantic search (find text with the same meaning as the given text). All vectorisation
and semantic search happen inside VecFS. Outcomes: agent and model agnostic; only
VecFS internal vectors in the local memory file.

# Action 3 — Consistent VecFS CLI (all stacks)

Unify pattern and commands across all implementations.

- **3a** All VecFS CLI programs use the filename pattern **vecfs-{language}** where
  language is one of: go, py, ts.
- **3b** All options for the vecfs CLI programs are the same so that skills.md (and
  skill docs) can describe the CLI and commands consistently.

# Action 4 — Go MCP in-process embedding (Go only)

Make the Go MCP server use vector embedding internally so it does not need to run
another program.

- **4a** Introduce common source code for generating vectors from text.
- **4b** Both vecfs-embed-go and vecfs-mcp-go use the same common code for
  text→vector.

# Action 5 — vecfs-embed-{language} consistency (all stacks)

Treat vecfs-embed-* as the tool for users to search memory directly from the command
line. Align across implementations.

- **5a** Ensure the embed CLI exists in all implementations; implement where missing.
- **5b** Ensure the command follows the name convention **vecfs-embed-{language}**;
  rename if not.
- **5c** Ensure the commands take the same parameters; if not, summarise differences
  and agree a common set.

# Source of Truth

Full to-do list and implementation comparison:
[2026-02-26-ts-py-go-implementation-comparison.md](2026-02-26-ts-py-go-implementation-comparison.md).

Project goals and requirements: [docs/goals.md](../goals.md),
[docs/requirements.md](../requirements.md).
