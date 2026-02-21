# Rename vecfs Package to vecfs-mcp and Add vecfs CLI

## Purpose

Clarify that the current npm package is the MCP server component, not the whole VecFS system.
Introduce a single `vecfs` program as the main entry point for users: configuration, version
information, and starting the MCP or embed components.

## Rename Package to vecfs-mcp

### Scope

The existing package today ships the MCP server. Its name and installed binary should reflect
that it is one part of VecFS, not the entire product.

### package.json

- Set `"name": "vecfs-mcp"` (replacing `"name": "vecfs"`).
- Update `bin` so the installed program name matches: e.g. `"vecfs-mcp": "dist/mcp-server.js"` instead of `"vecfs": "dist/mcp-server.js"`.

### Installed program name

When users run `npm install -g vecfs-mcp` (or use it as a dependency), the executable they get
should be `vecfs-mcp`. That makes it clear they are running the MCP server, not a generic
VecFS CLI.

### Other references

- Update README, docs, and any scripts or docs that refer to installing or running `vecfs` as
  the MCP server so they say `vecfs-mcp` where appropriate.
- Consider whether the repository and GitHub project name stay as "vecfs" (the overall project)
  while the published npm package is "vecfs-mcp".

## New vecfs Program (CLI)

### Role

A separate `vecfs` program will act as the main user-facing entry point for the VecFS system.
It does not replace vecfs-mcp; it orchestrates and invokes it (and later the embed component).

### Capabilities

#### Configure vecfs

Provide a way to view and edit VecFS configuration (e.g. paths, endpoints, which components
to run). See the "Common configuration file" section below for the chosen mechanism.

#### Version information

Report the version of VecFS that is installed (and optionally versions of vecfs-mcp and
vecfs-embed if they are separate packages). For example: `vecfs --version` or `vecfs version`.

#### Start MCP or embed

Subcommands (or flags) to start the MCP server or the embed program, e.g.:
   - `vecfs mcp` — start the MCP server (by invoking vecfs-mcp or the local MCP implementation).
   - `vecfs embed` — start the embed program (when that component exists).

### Packaging and distribution

- The `vecfs` CLI could be its own npm package (e.g. name `vecfs`) so that `npm install -g vecfs`
  gives users the single entry point; it would depend on `vecfs-mcp` (and later `vecfs-embed`) or
  bundle/ invoke them.
- Alternatively it could live in a monorepo with vecfs-mcp and vecfs-embed, with the `vecfs`
  package being the one users install for the CLI and the others as dependencies or sibling
  packages.

### Summary

| Item            | Current           | Proposed                          |
|-----------------|-------------------|-----------------------------------|
| MCP package     | vecfs             | vecfs-mcp                         |
| MCP binary      | vecfs             | vecfs-mcp                         |
| Main CLI        | (none)            | vecfs (configure, version, mcp, embed) |

## Common configuration file

### Current situation and problem

Today, configuration is passed only via environment variables:

- **VECFS_FILE** — Path to the vector storage file. Used by the Node/TypeScript MCP server
  (`ts-src/mcp-server.ts`) and is intended for the Python `vecfs_embed` script as well.
- **PORT** — Port for the MCP HTTP server (TypeScript only).

This is clumsy: the same variable name must be set in different environments (Node vs Python),
there is no single place to document or edit settings, and MCP config (e.g. in Cursor) is limited
to `env` blocks. We need one configuration file that any VecFS tool (vecfs CLI, vecfs-mcp,
vecfs_embed) can read, so the file path and port (and future options) are defined once and shared.

### Requirement

A common configuration file for VecFS that:

- Can be used by the vecfs CLI, vecfs-mcp (TypeScript), and vecfs_embed (Python).
- Holds at least: storage file path, MCP/HTTP port, and room for future options (e.g. embed
  model, endpoints).
- Remains overridable by environment variables where needed (e.g. CI, containers).

### Research: YAML vs .env

Two candidate formats were compared: YAML (see [yaml.org](https://yaml.org/)) and the `.env`
format as used with [Vite env and mode](https://vite.dev/guide/env-and-mode) (JavaScript/TypeScript)
and [python-dotenv](https://pypi.org/project/python-dotenv/) (Python).

#### YAML

YAML is a human-friendly data serialization language with a published spec (YAML 1.2) and
broad, language-neutral adoption.

Good:

- Single, well-defined spec; same file works across languages with standard libraries (e.g. JS
  `yaml`, Python `PyYAML`).
- Supports nested structure (e.g. `mcp.port`, `storage.file`, `embed.model`) so config is
  organized and extensible without new env var names.
- Native types (numbers, booleans, lists) avoid string parsing and "everything is a string" issues.
- Comments are supported, so the config file can document options.
- Very common in DevOps and tooling (Kubernetes, Docker Compose, CI configs); familiar to many
  users.

Bad:

- Requires a YAML parser in each runtime; slightly heavier than "one key=value per line".
- Indentation-sensitive; mis-indentation can cause subtle errors.
- Spec complexity (e.g. optional types, anchors) can lead to implementation differences;
  for VecFS we would use a small, simple subset.

#### .env

The `.env` format is a de facto standard: key=value lines, often with variable expansion
(`${VAR}`). It is not a single formal spec; behaviour varies by implementation.

Good:

- Minimal: no extra dependencies in Node (Vite and many tools use [dotenv](https://github.com/motdotla/dotenv));
  in Python, [python-dotenv](https://pypi.org/project/python-dotenv/) is widely used and
  stable.
- Fits 12-factor and deployment practice: env vars are the usual override mechanism; `.env`
  files "fill in" the environment for local dev.
- Simple to edit and to generate (e.g. from scripts); no structure to learn.
- Vite supports mode-specific files (`.env`, `.env.local`, `.env.[mode]`) and variable
  expansion (dotenv-expand); python-dotenv supports `dotenv_values()` without mutating
  `os.environ` and optional variable expansion.

Bad:

- Flat key space: all keys are top-level. To avoid clashes we end up with prefixed names
  (e.g. `VECFS_FILE`, `VECFS_MCP_PORT`) which we already have; adding more options
  multiplies prefixes and is less readable than a small YAML tree.
- No standard for nesting or sections; no first-class comments in the "spec" (though
  `#` comments are supported by most implementations).
- Everything is strings; each tool must parse numbers, booleans, etc., and conversion
  rules can differ.
- Format details (quoting, multiline, expansion order) differ between Node and Python
  implementations; we would need to stick to a conservative subset and test both.

#### Summary

| Criterion              | YAML                         | .env                            |
|------------------------|------------------------------|----------------------------------|
| Cross-language support | Strong (spec + libs)         | Good (different impls per lang)  |
| Structure / nesting    | Yes                          | No (flat, prefixed keys)        |
| Types                  | Native                       | Strings only                     |
| Comments               | Yes                          | Yes (convention)                 |
| Simplicity             | Parser required; indentation | Minimal; key=value               |
| 12-factor / override   | Env override by convention   | Natural fit                      |

For a *common* config file shared by the vecfs CLI, vecfs-mcp (TypeScript), and vecfs_embed
(Python), YAML is the better fit: one format, one file, clear structure and types, and
better long-term extensibility without a long list of prefixed env-style keys. Environment
variables can still override specific values (e.g. `VECFS_FILE` or a single config path
`VECFS_CONFIG`) so deployment and CI remain simple.

### Proposed direction

- Introduce a single VecFS config file (e.g. `vecfs.yaml` or `.vecfs.yaml`), in a
  well-defined location (e.g. current directory, then `~/.config/vecfs/`), with a
  small, documented schema (e.g. `storage.file`, `mcp.port`, later `embed.*`).
- vecfs CLI: reads this file for `vecfs config` and when running `vecfs mcp` / `vecfs embed`;
  can pass path via env or `--config`.
- vecfs-mcp and vecfs_embed: read the same file when present; fall back to existing env
  vars (e.g. `VECFS_FILE`, `PORT`) so current usage keeps working.
- Document the file format and override behaviour (config file < environment variables).

## Decision: YAML config file

VecFS will use a YAML configuration file as the common format for all tools (vecfs CLI,
vecfs-mcp, vecfs_embed). File name: `vecfs.yaml` (or `.vecfs.yaml`). Lookup order: path given
by `--config` or `VECFS_CONFIG`, then current directory, then `~/.config/vecfs/`. Environment
variables override values from the file (e.g. `VECFS_FILE`, `PORT`) so deployment and CI
remain simple.

### Example config content

```yaml
# VecFS common configuration
# Used by vecfs CLI, vecfs-mcp, and vecfs_embed. Env vars override these values.

storage:
  file: ./vecfs-data.jsonl   # Path to the vector storage file (replaces VECFS_FILE)

mcp:
  port: 3000                 # HTTP/SSE port for MCP server (replaces PORT)

# Future: embed section for vecfs_embed (model, endpoint, etc.)
# embed:
#   model: ...
#   endpoint: ...
```
