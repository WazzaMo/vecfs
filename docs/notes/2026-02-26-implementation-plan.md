# Implementation Plan (2026-02-26)

Ordered steps and file/area hints for the five actions in
[2026-02-26-vecfs-actions-work-brief.md](2026-02-26-vecfs-actions-work-brief.md).

# Action 1 — Go container runtime (Go only) — Done

| Step | Task | Area / files | Status |
|------|------|--------------|--------|
| 1.1 | Add config for container runtime (docker \| podman) and optional embed image/name | `go-src/internal/config/config.go` (Container section); env `VECFS_CONTAINER_RUNTIME`, `VECFS_EMBED_IMAGE`, `VECFS_CONTAINER_NAME`, `VECFS_CONTAINER_PORT` | Done |
| 1.2 | Add package that invokes docker or podman CLI: start (run), stop, rm by container name | `go-src/internal/container/`: runner.go (interface), cli.go (docker/podman) | Done |
| 1.3 | Replace containerd demo with `vecfs container start` and `vecfs container stop` | `go-src/cmd/vecfs/main.go`, `container.go`; removed `container_demo.go` | Done |
| 1.4 | Optionally start container when MCP (or embed) needs it; defer stop on exit | Deferred: user runs `container start` before session, `container stop` for cleanup | Done |
| 1.5 | Remove containerd dependency; run `go mod tidy` | containerd removed from `go.mod` | Done |
| 1.6 | Unit/integration tests: mock docker binary, assert correct subprocess invocations | `internal/container/runner_test.go` (NewRunner, mock exe logging run/stop/rm) | Done |

# Action 2 — Text-only MCP API (all stacks) — Done

| Step | Task | Status |
|------|------|--------|
| 2.1 | Canonical tool input: query (search), id+text (memorize); no vector in schema | Done (Go, TS, Python) |
| 2.2 | Each server embeds text internally; embedder required | Done |
| 2.3 | Updated tool-reference.md | Done |

# Action 3 — Consistent VecFS CLI (all stacks) — In progress

| Step | Task | Status |
|------|------|--------|
| 3.1 | Binaries vecfs-{go,py,ts}: TS bin renamed to vecfs-ts; Go build as vecfs-go; Py already vecfs-py | Done |
| 3.2 | Align options (--config, --file, port); document in skills | Pending |

# Action 4 — Go MCP in-process embedding (Go only) — Done

| Step | Task | Status |
|------|------|--------|
| 4.1 | Shared text→vector in internal/embed; vecfs-embed-go and MCP use it | Done |
| 4.2 | MCP tool handlers call embedder for query/text; embedder required | Done |

# Action 5 — vecfs-embed-{language} consistency (all stacks) — In progress

| Step | Task | Status |
|------|------|--------|
| 5.1 | Embed CLI in TS (vecfs-embed-ts); TS currently in-process only, no separate embed binary yet | Deferred |
| 5.2 | Python script vecfs-embed-py added (vecfs-embed kept for backward compat); Go already vecfs-embed-go | Done |
| 5.3 | Align parameters across embed CLIs; document common set | Pending |

# Execution order

Do **Action 1** first (Go container runtime). Then **Action 4** (Go in-process embedding) so the Go stack does not depend on external containers for MCP. Then **Action 2** (text-only API) across all stacks. Then **Action 3** (CLI naming/options) and **Action 5** (embed CLI consistency) in parallel or 3 then 5.

Source: [2026-02-26-vecfs-actions-work-brief.md](2026-02-26-vecfs-actions-work-brief.md).
