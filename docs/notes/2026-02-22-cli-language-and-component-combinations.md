# CLI Language Choice and Component Combinations

## Purpose

Discuss which language and framework is best for the vecfs CLI (the main user-facing `vecfs` program that orchestrates configuration, version, and starting MCP or embed components). Consider whether the CLI can start any combination of MCP server and embedder (e.g. Go MCP with Python embedder, TypeScript MCP with Go embedder), and how to manage a local embedding model that runs in a container (e.g. Text Embeddings Inference) without requiring the user to invoke Docker CLI tools.

This note builds on the package rename and CLI design in `2026-02-22-vecfs-package-name-and-cli.md` and the Go implementation in `2026-02-22-go-implementation.md`.

VecFS is very new; we cannot assume any implementation (Python vecfs_embed, Go, or TypeScript) has an existing user-base advantage. Language choice should be based on technical fit and maintainability, not incumbent usage.

# CLI Language and Framework Options

## Python

### Pros

- Same ecosystem as vecfs_embed (py-src); one language for CLI and embed if both are Python.
- Good for config parsing (PyYAML), subprocess orchestration, and scripting.
- If the embed component is Python, a Python CLI shares that runtime; no extra runtime for CLI-only in that case.
- Can share `vecfs.yaml` loading with py-src (e.g. same library or copy of logic).

### Cons

- Requires Python on the host; not a single static binary.
- If the CLI is the main entry point and we add a Go MCP or Go embed, we mix runtimes (Python CLI spawning Go binaries or vice versa).
- Packaging: a `vecfs` CLI in Python would typically ship as a PyPI package or script; users who only want the Go stack would still need Python for the CLI unless we offer a Go CLI as well.

## TypeScript and Node.js

### Pros

- Same ecosystem as vecfs-mcp (ts-src); one language for CLI and MCP if both are Node.
- npm is already used for vecfs-mcp; `npm install -g vecfs` could deliver the CLI and depend on vecfs-mcp.
- Good for spawning child processes, reading YAML (e.g. js-yaml), and HTTP if the CLI ever talks to MCP over HTTP.
- Aligns with existing MCP SDK and examples (TypeScript-first).

### Cons

- Requires Node on the host; not a single static binary.
- If we add Go MCP or Go embed, the CLI would spawn processes in another runtime; that is fine for orchestration but then the "one stack" benefit is only when using TS MCP + (external or TS-triggered) embed.
- Heavier startup than a small Go binary when the CLI is used frequently (e.g. `vecfs version`, `vecfs config`).

## Golang

### Pros

- Single static binary; no runtime dependency. Fits deployment in containers, CI, and minimal environments (see `2026-02-22-go-implementation.md`).
- Fast startup and low memory; good for a small CLI that is invoked often.
- Can use the containerd client (Apache-2.0) to manage containers programmatically, without invoking the Docker CLI; see research below.
- Natural fit for orchestrating other binaries: start vecfs-mcp-go, vecfs-embed-go, or external vecfs-mcp / vecfs_embed by exec'ing or spawning and passing config.
- One Go CLI can start any combination of MCP and embed by treating them as subprocesses or managed processes; the CLI does not need to be written in the same language as the components.

### Cons

- Duplication of config parsing and CLI structure with ts-src and py-src unless we treat the Go CLI as the canonical orchestrator and keep config schema shared via docs/spec.
- If the primary install path is `npm install -g vecfs`, a Go CLI would need to be distributed separately (e.g. GitHub Releases, Homebrew) or the "vecfs" npm package would wrap or download the Go binary.
- Ecosystem for MCP is TypeScript-first; Go would implement the protocol by hand (as vecfs-mcp-go already does).

# Recommendation: Go for the CLI

Go is **preferred** for the vecfs CLI so it can act as a **fast, lightweight launcher** for the configured MCP server and embedder. A single static binary with minimal startup time can read `vecfs.yaml`, report version, and start any combination of MCP and embed by launching the appropriate binaries (vecfs-mcp, vecfs-mcp-go, vecfs_embed, vecfs-embed-go) and, if needed, managing an embedder container. Users can run `vecfs mcp` (Node or Go MCP) and `vecfs embed` (Python or Go embedder) from the same CLI without depending on Node or Python for the launcher itself.

Alternative: a TypeScript vecfs CLI as the default install via npm would keep the primary experience in the Node ecosystem but would not remove the need for Node and would be heavier for frequent invocations (e.g. `vecfs version`, `vecfs config`).

# Local Embedder and Container Management

## vecfs-embed-go and Containers

vecfs-embed-go does **not** itself run inside a container. It supports a **local** provider that calls a **local** embedding service (e.g. [Text Embeddings Inference (TEI)](https://github.com/huggingface/text-embeddings-inference)) at a URL (default `http://localhost:8080`). That service is often run as a container (e.g. `docker run ... ghcr.io/huggingface/text-embeddings-inference`) so that the model runs in an isolated environment. So the **embedder model** may run in a container; vecfs-embed-go is just an HTTP client to it.

To run a local model without the user having to run `docker` manually, the vecfs CLI (or a dedicated helper) could start and stop that container on behalf of the user.

## Controlling Containers Without Docker CLI

VecFS is licensed under Apache-2.0. We **set aside** the [vessel](https://github.com/ChampionBuffalo1/vessel) project for container control because vessel is GPL-3.0; linking it would be incompatible with distributing vecfs under Apache-2.0. Instead, the vecfs CLI should use the **containerd client** directly (`github.com/containerd/containerd` or `github.com/containerd/containerd/v2/client`), which is Apache-2.0 and allows start/stop semantics without invoking the Docker CLI, provided containerd is available on the system (Docker Desktop and many Linux setups use containerd; standalone containerd can also be used without Docker).

If the user only has Docker (no standalone containerd), we could alternatively use the Docker Engine API from Go; that would not require containerd-specific code.

## Checking for containerd and Docker

The CLI should **explicitly check** for the presence of containerd (and optionally Docker) when the user requests a local embedder that requires a container (e.g. Go embedder with `provider: local` and config that asks the CLI to start the TEI container). If the check runs before any attempt to create or start a container, we can fail fast with a clear message instead of a low-level connection error.

### Behaviour

1. **When container runtime is needed** (e.g. user runs `vecfs embed` with embedder set to Go and `provider: local`, and config indicates the CLI should manage the embedder container): before connecting, check whether containerd is available (e.g. try to connect to the default containerd socket, or `client.New()` with a short timeout).
2. **If containerd is not present**: fail with a clear, user-facing message that:
   - states that containerd is required to run the local embedder container;
   - asks the user to install containerd (and point to install docs or the default socket path);
   - **suggests using the Python embedder for now** — the Python embedder (vecfs_embed) can use cloud APIs (OpenAI, Hugging Face, etc.) or local Sentence Transformers without any container, so the user can continue without installing containerd.
3. **Optional: detect Docker** (e.g. check for Docker socket or `docker info`). If Docker is present but containerd is not (e.g. Docker Desktop exposes containerd in a different path, or we only check the default socket), the message could add: "Docker was detected; a future version may support starting the embedder container via Docker." If neither containerd nor Docker is found, the message can simply say "containerd is not available" and suggest the Python embedder.

This way, users who do not have containerd get actionable guidance and are directed to the Python embedder as a working alternative until they install containerd.

## Starting containerd when installed but not running

If containerd is **installed but the daemon is not running**, vecfs cannot connect to the socket. Options for starting the daemon so vecfs can use it:

### Option 1: systemd (Linux, recommended)

On most Linux systems containerd is managed by systemd. The CLI can **try to start the service** when connect fails:

1. After a failed connect, check whether systemd is available (e.g. `systemctl` in PATH or `$XDG_RUNTIME_DIR` / run system for user sessions).
2. Run `systemctl start containerd` (or `systemctl --user start containerd` if using a user-level install). This may require the user to have passwordless sudo for the system unit, or to use a user service.
3. Wait briefly for the socket to appear (e.g. poll for `/run/containerd/containerd.sock` or retry `containerd.New()` with backoff).
4. If start succeeds, proceed; otherwise fall back to the existing failure message (install containerd, or use Python embedder).

Implementation: exec `systemctl`, `start`, `containerd` (or detect the unit name; some distros use `containerd.service`). Prefer not to prompt for sudo interactively; document that the user may need to run `sudo systemctl start containerd` once, or grant polkit/rule for starting the service.

### Option 2: Invoke the containerd binary

Alternatively, vecfs could run the **containerd** daemon binary as a subprocess (e.g. `containerd` or `containerd --config /etc/containerd/config.toml`). Challenges:

- The daemon must run in the background and create the socket where the client expects it; default config uses `/run/containerd/containerd.sock`, which often requires root unless a user-specific config and socket path are used.
- If the system already uses systemd for containerd, starting a second daemon can conflict.
- User-scoped or embedded use (e.g. a config and socket under `~/.config/vecfs/containerd`) is possible but adds complexity (config file, socket path, lifecycle of the daemon process).

This option is more suited to an “embedded” or “user-level” containerd that vecfs starts and stops itself, and is not the typical case when “containerd is installed” (usually meaning the system daemon).

### Option 3: Document and improve the message

Without implementing auto-start, the CLI should at least **tell the user how to start containerd** when the connect fails:

- “If containerd is installed but not running, start it with: `sudo systemctl start containerd` (Linux).”
- Optionally detect that the socket path does not exist vs. connection refused / permission denied, and tailor the message (e.g. “containerd is not running” vs “containerd is not installed or not accessible”).

**Recommendation:** Implement Option 3 in the short term (clear message + hint to run `systemctl start containerd`). Add Option 1 as an enhancement: when connect fails, try `systemctl start containerd` (or `--user`), then retry connect; if that fails, show the message from Option 3 and suggest the Python embedder.

# Implementing Start and Stop with containerd Directly

## Research sources

The containerd project’s own CLI, **ctr**, is the reference for using the Go client. The following is derived from the [containerd/containerd](https://github.com/containerd/containerd) repository (Apache-2.0): `cmd/ctr/commands/run/`, `cmd/ctr/commands/tasks/` (start, kill, delete), and the client types they use.

## Connection and namespace

- **Connect**: `client, err := containerd.New(address)` — address is typically the containerd socket, e.g. `"/run/containerd/containerd.sock"` (Linux). Default can be overridden with `CONTAINERD_ADDRESS` or the `containerd.WithDefaultNamespace()` option.
- Use a **namespace** (e.g. `"vecfs"`) so vecfs containers do not collide with other workloads: `containerd.WithDefaultNamespace("vecfs")` when creating the client or in context.

## Lifecycle: image, container, task

containerd separates **images**, **containers**, and **tasks**:

- **Image** — Unpacked content from a registry (e.g. `ghcr.io/huggingface/text-embeddings-inference:latest`). Pull with `client.Pull(ctx, ref)` or resolve with `client.ImageService().Get(ctx, ref)` then `containerd.NewImage(client, i)`.
- **Container** — A created container with an id, snapshot, and OCI spec. Created with `client.NewContainer(ctx, id, opts...)`.
- **Task** — A running (or created-but-not-started) process inside a container. Created with `container.NewTask(ctx, ioCreator, opts...)`; started with `task.Start(ctx)`.

## Start semantics (run / create and start)

1. **Pull or get image**: `image, err := client.Pull(ctx, imageRef)` (or get existing image from ImageService).
2. **Unpack** (if not already): `image.Unpack(ctx, snapshotter)`.
3. **Create container**: `container, err := client.NewContainer(ctx, containerID, containerd.WithImage(image), containerd.WithNewSnapshot(snapshotID, image), containerd.WithNewSpec(oci.WithImageConfig(image), ...))` — the exact options depend on desired mounts, env, and platform; the ctr `run` command uses `oci.WithDefaultSpecForPlatform`, `oci.WithImageConfig(image)`, and many optional flags. For a minimal TEI-style service, image config plus port bindings (e.g. `oci.WithPortMappings`) is enough.
4. **Create task**: `task, err := container.NewTask(ctx, cio.Creator, opts...)`. For a **detached** (background) service, use `cio.NullIO` so the task is not attached to the caller’s stdio: `task, err := container.NewTask(ctx, cio.NullIO)`.
5. **Start**: `err := task.Start(ctx)`.

After this, the container is running. The task’s PID is available via `task.Pid()`.

## Stop semantics

1. **Load container**: `container, err := client.LoadContainer(ctx, containerID)`.
2. **Get task**: `task, err := container.Task(ctx, cio.Load)` — `cio.Load` attaches to the existing task. If no task exists, this returns an error (e.g. container not running).
3. **Signal to stop**: `err := task.Kill(ctx, syscall.SIGTERM)` (or another signal). Optionally wait for exit: `status, err := task.Wait(ctx)` then `<-status`.
4. **Delete task**: `_, err := task.Delete(ctx)` or `task.Delete(ctx, containerd.WithProcessKill)` to force-kill then delete.
5. **Delete container** (optional): `err := container.Delete(ctx, containerd.WithSnapshotCleanup)` to remove the container and its snapshot.

So “stop” in practice: load container → load task → Kill(SIGTERM) → (optionally wait) → Delete task. Optionally delete the container if we do not plan to start it again with the same id.

## Key packages and types

- **Client**: `github.com/containerd/containerd/v2/client` (or v1 `github.com/containerd/containerd/client`) — `containerd.New()`, `containerd.Client`, `client.NewContainer`, `client.LoadContainer`, `client.Pull`.
- **Container**: `containerd.Container` — `NewTask`, `Task`, `Spec`, `Delete`.
- **Task**: `containerd.Task` — `Start`, `Kill`, `Wait`, `Delete`, `Pid`.
- **I/O**: `github.com/containerd/containerd/v2/pkg/cio` — `NullIO`, `NewCreator`, `WithStreams` for detached vs attached.
- **OCI spec helpers**: `github.com/containerd/containerd/v2/pkg/oci` — `WithImageConfig`, `WithDefaultSpecForPlatform`, `WithPortMappings`, etc.
- **Errors**: `github.com/containerd/errdefs` — `errdefs.IsNotFound(err)` to detect missing container/task.

The ctr commands use v2 client and `containerd/v2/pkg/oci`; for vecfs we can depend on the same v2 modules (or the stable v1 client if we prefer) and implement a small internal package that wraps this lifecycle with configurable image ref, container id, snapshot id, and port mapping from `vecfs.yaml` (e.g. `embed.local_image`, `embed.local_container_id`, `embed.local_port`).

# Configurable MCP and Embedder Combinations

## Desired Behaviour

The CLI should be configurable so that any combination of MCP implementation and embedder implementation can be started, for example:

| MCP server       | Embedder           |
|------------------|--------------------|
| Go (vecfs-mcp-go)   | Python (vecfs_embed)  |
| Go (vecfs-mcp-go)   | Go (vecfs-embed-go)   |
| TypeScript (vecfs-mcp) | Go (vecfs-embed-go)   |
| TypeScript (vecfs-mcp) | Python (vecfs_embed)  |

Additional combinations (e.g. MCP only, embed only) are already in scope from the CLI design: `vecfs mcp`, `vecfs embed`.

## Design Approach

### Configuration

Extend `vecfs.yaml` (or equivalent) with a section that identifies which implementations to use, and optionally where they live:

```yaml
# Example extension; exact keys TBD
cli:
  mcp: go          # or "node" / "ts"
  embed: python    # or "go"

# Optional: paths or commands for each (default: assume in PATH or well-known locations)
mcp:
  go_bin: vecfs-mcp-go
  node_bin: vecfs-mcp
embed:
  python_module: vecfs_embed
  go_bin: vecfs-embed-go
```

Environment overrides (e.g. `VECFS_MCP_IMPL=go`, `VECFS_EMBED_IMPL=python`) would allow CI or power users to override without editing the file.

### Orchestration

The vecfs CLI (in whichever language) would:

1. Read config and determine which MCP and which embed implementation to use.
2. For `vecfs mcp`: start the chosen MCP binary (e.g. `vecfs-mcp-go` or `node … vecfs-mcp`), passing `vecfs.yaml` path and env (e.g. `VECFS_FILE`, `PORT`).
3. For `vecfs embed`: start the chosen embed binary or interpreter (e.g. `vecfs-embed-go` or `python -m vecfs_embed.cli`), passing config and env.
4. Optionally, for a "local" embedder that requires a container (e.g. TEI): before starting vecfs-embed-go with `provider: local`, start the container via the containerd client (see "Implementing Start and Stop with containerd Directly" above), then start vecfs-embed-go; on shutdown, stop the container.

So yes, we can make the CLI configurable to start any combination of MCP and embedder; the CLI is an orchestrator that launches the right processes (and optionally the right container) according to config.

### Implementation split

- **Go CLI**: Can spawn Node (vecfs-mcp), Go (vecfs-mcp-go, vecfs-embed-go), and Python (vecfs_embed) as subprocesses; can use containerd or Docker API to manage the embedder container. One codebase, one binary.
- **TypeScript CLI**: Can spawn Go and Python binaries as child processes; container management would require a Node library that talks to Docker or containerd (e.g. `dockerode`), or the CLI could delegate "start embedder container" to a small Go helper.
- **Python CLI**: Same idea: subprocess for Node or Go MCP/embed; container management via a Python library (e.g. Docker SDK for Python) or a small Go/Node helper.

The Go CLI is the preferred place to integrate the containerd client for embedder container lifecycle; vessel is not used because it is GPL-3.0 and VecFS is Apache-2.0.

# Summary

| Topic | Conclusion |
|-------|------------|
| CLI language | Go is preferred: fast, lightweight launcher for configured MCP and embedder; single binary, no runtime; can orchestrate all components and manage embedder container via containerd (Apache-2.0). |
| vecfs-embed-go and containers | vecfs-embed-go is an HTTP client to a local embedding service; that service may run in a container. The CLI can start/stop that container so the user does not need to run Docker manually. |
| Container control without Docker CLI | Use the containerd Go client directly (Apache-2.0). Vessel is set aside because it is GPL-3.0 and incompatible with VecFS’s Apache-2.0 license. Start/stop semantics: NewContainer → NewTask (NullIO) → Start; stop via LoadContainer → Task(cio.Load) → Kill(SIGTERM) → Delete task (and optionally Delete container). |
| Any MCP + embed combination | Yes: the CLI can be configured (e.g. in vecfs.yaml and env) to start Go or TypeScript MCP and Go or Python embedder by launching the corresponding binaries and passing config. |
| Containerd / Docker detection | When the CLI must start an embedder container, explicitly check for containerd (and optionally Docker). If containerd is not present, fail with a clear message asking for containerd to be installed and suggest using the Python embedder for now (no container required). |

# Next steps

1. **Prove we can start and stop containers directly with containerd** — Implement a minimal vecfs CLI with a subcommand (e.g. `vecfs container demo`) that connects to containerd, pulls a small image, creates a container, starts the task, then stops and deletes the task and container. This validates the approach before building the full launcher. (Initial test implementation added under `go-src/cmd/vecfs`.)
2. Document the Go CLI as the preferred vecfs launcher in an implementation plan.
3. Define the exact `vecfs.yaml` schema for `cli.mcp` / `cli.embed` (or equivalent) and binary paths.
4. Implement a minimal containerd-based run/start/stop layer in the Go CLI (internal package) using the lifecycle described above; document that containerd must be available (or document Docker Engine API as an alternative for Docker-only environments).
5. Before starting an embedder container, explicitly check for containerd (e.g. connect to default socket); if missing, fail with a user-facing message that asks for containerd to be installed and suggests using the Python embedder for now. Include “if installed but not running: sudo systemctl start containerd (Linux)” in the message.
6. Optional enhancement: when connect fails, try starting containerd via `systemctl start containerd` (or `--user`), then retry connect; if still failing, show the message from step 5.
7. Implement `vecfs mcp` and `vecfs embed` subcommands that respect the chosen MCP and embed implementation and, if needed, start the embedder container before vecfs-embed-go with `provider: local` (after the containerd check above).
