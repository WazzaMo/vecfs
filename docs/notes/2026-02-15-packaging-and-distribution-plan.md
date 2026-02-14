# 2026-02-15 Packaging and Distribution Plan

This note describes how to package the VecFS MCP server, the embedding script, and the agent skill into distributable artefacts that users can install with minimal friction.

# What Ships

VecFS has three distributable components, each with a different audience and installation mechanism.

## MCP Server (TypeScript)

The core product. An MCP server that agents connect to for search, memorize, feedback, and delete operations. It runs on Node.js and communicates via stdio or HTTP/SSE.

## Embedding Script (Python)

A companion tool that converts text to sparse vectors. Agents call it locally before passing vectors to the MCP server. It runs on Python 3.10+ and uses `uv` for dependency management.

## Agent Skill (SKILL.md)

A machine-readable skill definition following the Agent Skills specification. It teaches agents how to use the MCP server and embedding script together. This is a directory of Markdown files and shell scripts with no runtime dependencies of its own.

# Distribution Channels

## npm (MCP Server)

The MCP server is the primary deliverable and npm is the natural channel. Most MCP servers in the ecosystem are distributed this way, and both Claude Desktop and Cursor expect an `npx` invocation for MCP server configuration.

### Package Name

`vecfs` (matching the existing `package.json` name). If taken, `@vecfs/server` as a scoped alternative.

### What Gets Published

The npm package should contain only what is needed to run the server.

```
vecfs/
├── package.json
├── dist/
│   └── mcp-server.js      (single-file esbuild bundle)
├── vecfs-memory/
│   └── SKILL.md            (+ scripts/, references/, assets/)
├── README.md
└── LICENSE
```

Source files (`ts-src/`, `py-src/`, `docs/`, tests, configs) are excluded via the `files` field in `package.json`. This keeps the published package small and avoids shipping dev dependencies.

### package.json Changes

```json
{
  "name": "vecfs",
  "version": "0.1.0",
  "bin": {
    "vecfs": "dist/mcp-server.js"
  },
  "files": [
    "dist/",
    "vecfs-memory/",
    "README.md",
    "LICENSE"
  ]
}
```

The `bin` field enables `npx vecfs` as a direct invocation. The bundled `dist/mcp-server.js` already has a single entry point so no wrapper script is needed; it just needs a `#!/usr/bin/env node` shebang added by esbuild's banner.

### Installation

```bash
# Global install
npm install -g vecfs

# Or run directly
npx vecfs

# Or with flags
npx vecfs --http
```

### Agent Configuration

For Claude Desktop or Cursor, the user adds the server to their MCP config:

```json
{
  "mcpServers": {
    "vecfs": {
      "command": "npx",
      "args": ["-y", "vecfs"],
      "env": {
        "VECFS_FILE": "/path/to/memory.jsonl"
      }
    }
  }
}
```

## PyPI (Embedding Script)

The embedding script is published as a separate Python package so it can be installed independently of the MCP server.

### Package Name

`vecfs-embed` (matching `py-src/pyproject.toml`).

### What Gets Published

```
vecfs-embed/
├── pyproject.toml
└── vecfs_embed/
    ├── __init__.py
    ├── __main__.py
    ├── cli.py
    ├── embed.py
    └── sparsify.py
```

Tests are excluded via hatchling's default source layout.

### Installation

```bash
# Using uv (recommended)
uv tool install vecfs-embed

# Or pip
pip install vecfs-embed

# With a cloud provider extra
pip install vecfs-embed[openai]
```

### Usage

```bash
# After install, the CLI is available as a command
vecfs-embed --mode query "some text"

# Or via python -m
python -m vecfs_embed --mode query "some text"
```

## Skill Directory (Agent Skills)

The skill directory (`vecfs-memory/`) ships inside the npm package so it is available on disk after `npm install`. It can also be copied independently from the git repository.

A future skill registry (if the Agent Skills ecosystem develops one) could host the skill separately, but for now bundling it with the npm package is the simplest approach.

# Build Pipeline

## Current State

The build already produces a single `dist/mcp-server.js` via esbuild. Type checking is done by `tsc --noEmit`. The Python package is managed by `uv` with a `pyproject.toml`.

## Changes Needed

### Add Shebang to Bundle

The esbuild banner must include a Node.js shebang so `npx` can execute the file directly.

```javascript
banner: {
  js: "#!/usr/bin/env node\nimport { createRequire } from 'module'; const require = createRequire(import.meta.url);",
},
```

### Add files Field to package.json

Restrict what npm publishes to only the runtime artefacts.

### Add bin Field to package.json

Map the `vecfs` command to `dist/mcp-server.js`.

### Validate Skill Before Publish

Add a prepublish script that validates the skill directory.

```json
{
  "scripts": {
    "prepublishOnly": "npm run build && npx skills-ref validate ./vecfs-memory"
  }
}
```

### Python Build

Add a build command for the Python package. Publishing to PyPI uses standard tooling.

```bash
cd py-src
uv build
uv publish
```

# Versioning Strategy

Both packages start at `0.1.0` to indicate early development. They are versioned independently because they have different release cadences (server changes are more frequent than embedding script changes).

## Semantic Versioning

Both packages follow semver:

- Patch: bug fixes, dependency updates, documentation.
- Minor: new tools, new CLI flags, new embedding providers.
- Major: breaking changes to the MCP tool schemas, CLI interface, or file format.

## Coordinated Releases

When a server change affects the skill instructions (e.g., a new tool is added), the skill body and the server should be updated in the same commit and released together.

# Pre-Release Checklist

Before the first publish, these items should be completed.

## MCP Server (npm)

### Verify Single-File Bundle

Run `npm run build` and confirm `dist/mcp-server.js` works in isolation (no `node_modules` needed at runtime).

### Test npx Invocation

Pack the package locally and test it without a global install.

```bash
npm pack
npx ./vecfs-0.1.0.tgz
```

### Verify Stdio Transport

Confirm the server starts and responds to MCP initialize over stdio when invoked via `npx`.

### Verify HTTP Transport

Confirm `npx vecfs -- --http` starts the Express server and responds on `/sse`.

### Confirm Package Size

Run `npm pack --dry-run` and check the tarball size. Target under 2 MB (the bundle is currently ~1.3 MB).

### Check Metadata

Ensure `package.json` has correct `description`, `keywords`, `repository`, `author`, and `license` fields for the npm listing page.

## Embedding Script (PyPI)

### Verify uv Build

Run `uv build` in `py-src/` and confirm the wheel is created.

### Test Install in Clean Environment

```bash
uv venv /tmp/test-env
uv pip install dist/vecfs_embed-0.1.0-py3-none-any.whl --python /tmp/test-env/bin/python
/tmp/test-env/bin/vecfs-embed --help
```

### Confirm Default Model Works

Run a single embed with the default Sentence Transformers model (no API key required) to verify the installed package works end-to-end.

### Check Metadata

Ensure `pyproject.toml` has correct `description`, `license`, `authors`, `urls`, and `classifiers` for the PyPI listing page.

## Skill Directory

### Validate With skills-ref

```bash
npx skills-ref validate ./vecfs-memory
```

### Token Budget

Measure the SKILL.md body to confirm it stays under 5000 tokens and 500 lines.

### Cross-Reference Tools

Verify the `allowed-tools` field in the frontmatter matches the tools the server actually exposes (search, memorize, feedback, delete).

# Container Distribution (Optional)

The existing `Dockerfile.integration` and `docker-compose.yml` are for testing only. A production Dockerfile could be added for users who prefer containers.

```dockerfile
FROM node:22-slim
WORKDIR /app
COPY dist/mcp-server.js .
ENV VECFS_FILE=/data/vecfs-data.jsonl
EXPOSE 3000
CMD ["node", "mcp-server.js", "--http"]
```

This image would be under 200 MB (Node.js slim base + 1.3 MB bundle). It could be published to Docker Hub or GitHub Container Registry.

Container distribution is a lower priority than npm and PyPI since most MCP agent hosts expect a local `npx` command, but it supports deployment scenarios like remote servers or CI pipelines.

# Installation Summary

The table below shows the target installation experience for each component.

| Component       | Channel | Install Command                        | Run Command           |
|-----------------|---------|----------------------------------------|-----------------------|
| MCP Server      | npm     | `npm install -g vecfs`                 | `vecfs` or `npx vecfs`|
| Embedding Script| PyPI    | `uv tool install vecfs-embed`          | `vecfs-embed`         |
| Agent Skill     | npm     | (bundled with MCP server)              | Read by agent         |
| Container       | Docker  | `docker pull vecfs/server`             | `docker run vecfs/server` |

# Implementation Steps

## Step 1: Prepare package.json for npm

Add `bin`, `files`, `keywords`, `author`, and `license` fields. Set version to `0.1.0`. Add `prepublishOnly` script.

## Step 2: Update esbuild Banner

Add the Node.js shebang to the bundle so it is directly executable.

## Step 3: Create the Skill Directory

Build out `vecfs-memory/` with `SKILL.md`, `scripts/`, `references/`, and `assets/` as described in the skill definition plan note.

## Step 4: Prepare pyproject.toml for PyPI

Add `authors`, `license`, `urls`, `classifiers`, and `readme` fields. Confirm `uv build` produces a valid wheel.

## Step 5: Local Smoke Test

Pack both packages locally, install them in clean environments, and verify end-to-end: embedding a text, memorizing it, and searching for it.

## Step 6: Publish

```bash
# npm
npm publish

# PyPI
cd py-src && uv build && uv publish
```

## Step 7: Update README

Rewrite the README to reflect the published installation commands and link to the skill documentation.

# Open Questions

## npm Scope

Should the package be published as `vecfs` (unscoped) or `@vecfs/server` (scoped)? Unscoped is simpler for `npx` usage. Scoped avoids name collisions and groups future packages (e.g., `@vecfs/embed`). The recommendation is unscoped for now and revisit if additional npm packages are added.

## Monorepo Tooling

The repository contains both a Node.js and a Python project. If more packages are added (e.g., a shared JSON schema package), a monorepo tool like Turborepo or Nx could coordinate builds and versioning. For now, with just two packages, manual coordination is sufficient.

## Embedding Script Distribution Channel

The note assumes PyPI for the Python package. An alternative is to skip PyPI and distribute `vecfs-embed` only through `uv tool install git+https://github.com/WazzaMo/vecfs#subdirectory=py-src`, which avoids the overhead of maintaining a PyPI listing. The trade-off is a less familiar install command for users. PyPI is recommended for discoverability.
