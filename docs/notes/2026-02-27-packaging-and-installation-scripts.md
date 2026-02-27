# Packaging and Installation Scripts for Multiple Implementations

This note reviews `install-from-github.sh` and `scripts/package.sh` and outlines how to evolve them for multiple VecFS implementations (Go, Python, TypeScript). It also compares script-per-language vs single multi-language scripts for packaging and installation.

# Current Scripts Summary

`install-from-github.sh` installs the TypeScript MCP server (`dist/mcp-server.js`) and the Python embedder (`py-src/vecfs_embed`) directly from a cloned repo into a prefix (`$HOME/.local` by default). It:

- Detects options (`--server`, `--embed`, `--prefix`, `--install-python-deps`).
- Builds the TS bundle if `dist/mcp-server.js` is missing.
- Copies the Python package into `lib/vecfs/embed` and creates a `vecfs-embed` wrapper.

`scripts/package.sh` builds a tarball `vecfs-<version>.tar.gz` containing:

- The MCP server bundle (`mcp-server.js`) and minimal `package.json`.
- The Python embedding wheel.
- `vecfs-memory` skill directory and top-level docs.
- An `install.sh` helper that uses `npm install -g` for the server and `uv` or `pip` for the wheel.

Both scripts currently assume the TS MCP server + Python embedder combination as the primary distribution.

# Updates Needed for Multi-Implementation Support

To support distinct implementations (Go, Python, TypeScript) with consistent user experience, the scripts need to:

- Distinguish **implementation stack** (e.g. `--lang ts`, `--lang py`, `--lang go`) from **component type** (`--server`, `--embed`).
- Provide **separate binary names** (`vecfs-go`, `vecfs-py`, `vecfs-ts`) alongside the common `vecfs` and `vecfs-embed-*` CLIs, matching the CLI consistency work.
- Allow packaging and installation that target:
  - A single implementation stack (e.g. “Go only” VecFS).
  - A “mixed” distribution (e.g. TS server + Python embedder), while keeping that combination explicit in naming and options.

Concretely:

- `install-from-github.sh` should either:
  - Gain language-aware flags (for example `--lang ts`, `--lang py`, `--lang go`) and know how to install each stack’s binaries and artifacts, or
  - Be split into stack-specific installers (`install-ts-from-github.sh`, `install-py-from-github.sh`, `install-go-from-github.sh`) with a thin umbrella script if needed.
- `scripts/package.sh` should either:
  - Become a multi-language packager that can emit one or more tarballs based on a `--lang` argument or a `--profile` describing a combination, or
  - Be split into `scripts/package-ts.sh`, `scripts/package-py.sh`, `scripts/package-go.sh`, each producing a stack-specific distributable.

# Option 1 — One Script per Language per Role

In this option, we introduce **separate scripts per language and purpose**, for example:

- `scripts/package-ts.sh`, `scripts/package-py.sh`, `scripts/package-go.sh`.
- `install-ts-from-github.sh`, `install-py-from-github.sh`, `install-go-from-github.sh`.

The existing `scripts/package.sh` becomes a thin orchestrator that calls the language-specific packagers when a “combo” package is desired, and `install-from-github.sh` could either be:

- A convenience wrapper that dispatches to the appropriate `install-*-from-github.sh`, or
- Deprecated in favour of language-specific installers.

## Pros

- **Clarity of responsibility**: Each script has a narrow single responsibility aligned with a specific stack. This matches the project’s SOLID and small-file guidelines.
- **Simpler dependencies**: A Go packager script does not need Node or Python tools; a Python packager does not need Node or Go. This avoids cross-language toolchain coupling.
- **Easier for contributors**: A maintainer focused on Go can work only in `package-go.sh` and `install-go-from-github.sh` without understanding TS/Python packaging details.
- **Safer evolution**: Changes in one stack’s build (for example replacing `uv` in Python) do not risk breaking the others.
- **Natural mapping to single-stack distributions**: A user who wants “just Go” uses the Go scripts and artifacts without extra flags.

## Cons

- **More files and entry points**: Users must choose the right script name (`install-go-from-github.sh` vs `install-py-from-github.sh`), which can be slightly more cognitive overhead.
- **Duplication of shared logic**: Common tasks (path handling, version detection, PATH hints) may be repeated, unless factored into shared helper fragments.
- **Umbrella packaging complexity**: Creating a “combo” tarball that ships multiple stacks requires a coordinating script anyway.

# Option 2 — Single Multi-Language Script per Role with Language Parameter

In this option, there is **one packager** and **one installer-from-repo**:

- `scripts/package.sh --lang ts|py|go|all` (or `--profile ts+py`, etc.).
- `install-from-github.sh --lang ts|py|go|combo` plus `--server` / `--embed` flags.

Internally, the scripts branch on the `--lang` parameter and call language-specific build/install functions in a single file.

## Pros

- **Fewer top-level commands**: Users remember only `package.sh` and `install-from-github.sh`, then pass a language flag. This can be more discoverable for new users.
- **Shared UX and messaging**: Help text, usage examples, and PATH reminders live in one place and remain consistent across stacks.
- **Easier automation**: CI pipelines can use the same script with different `--lang` arguments, reducing boilerplate in build configs.
- **Centralised version logic**: Version extraction from `package.json` or other sources can be centralised, reducing divergence.

## Cons

- **Growing script complexity**: As each stack adds its own flags, build flows, and edge cases, a single script can become long and harder to maintain, pushing against the “short focused files” guideline.
- **Cross-toolchain coupling**: The multi-language packager may require Node, Python, and Go tools to be present, even if only one stack is being targeted, unless the script is carefully gated.
- **Higher risk of regressions**: Changes for one language path may accidentally impact others (for example shared clean steps that remove needed artifacts).
- **Harder mental model for contributors**: Maintaining branching logic (`case "$LANG" in ...`) increases cognitive load versus editing a dedicated per-language script.

# Option 3 — Hybrid: Per-Language Scripts with a Thin Unified Front-End

A middle ground is to:

- Keep **per-language packagers and installers** as the primary implementation units.
- Provide a **thin wrapper** `scripts/package.sh` that:
  - Parses `--lang` (or `--profile`) and calls `package-ts.sh`, `package-py.sh`, `package-go.sh`, possibly composing outputs.
- Provide a **thin wrapper** `install-from-github.sh` that:
  - Parses `--lang` and forwards to the appropriate `install-*-from-github.sh` with the remaining flags.

## Pros

- **Aligns with SOLID and doc guidelines**: Core logic is kept in smaller, language-focused scripts; unified UX is handled by light wrappers.
- **User-friendly entry points**: Users can still call `./scripts/package.sh --lang go` or `./install-from-github.sh --lang ts` without remembering multiple script names.
- **Extensible to new stacks**: Adding a new implementation involves adding `package-newlang.sh` and `install-newlang-from-github.sh`, plus a small change in the wrappers.
- **Focused dependencies**: The wrapper scripts only orchestrate; language-specific scripts can assume and check their own toolchains.

## Cons

- **More moving parts**: There are more files overall, even if most users touch only the top-level wrappers.
- **Requires a minimal contract**: Wrapper and per-language scripts need a stable interface (arguments, exit codes) so composition stays predictable.

# Recommended Direction and Decision

Given VecFS’s emphasis on small, focused files and clear responsibilities, the **hybrid approach** is adopted:

- Introduce per-language packager and installer scripts for Go, Python, and TypeScript.
- Refactor `scripts/package.sh` and `install-from-github.sh` into:
  - Thin front-ends that parse generic options (`--lang`, `--server`, `--embed`, `--prefix`) and dispatch to language-specific scripts.
  - Shared helper functions (for example a small `scripts/lib/common.sh`) to avoid duplicated boilerplate while keeping language-specific logic separate.

This preserves a simple UX (`package.sh` and `install-from-github.sh` as primary entry points) while keeping implementation details per language modular and maintainable. Implementation should start with language-specific scripts that mirror the current TypeScript + Python behaviour, then factor the existing monolithic scripts into wrappers.

