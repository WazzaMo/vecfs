# VecFS

VecFS (Vector File System) is a lightweight, local-first vector storage specification and implementation designed for AI agent long-term memory.

# Copyright

(c) Copyright 2026 Warwick Molloy.
Contribution to this project is supported and contributors will be recognised.
Created by Warwick Molloy Feb 2026.

# Overview

VecFS gives AI agents a simple, efficient way to store and retrieve context locally. Through the Model Context Protocol (MCP), agents can learn from their interactions and recall relevant information in future sessions without the complexity of a full-scale vector database.

# Key Features

- **Sparse Vector Storage:** Follows the principle of "not storing zeros" for natural data compression and minimal disk footprint.
- **Local-First:** Designed to run on a laptop (WSL2, Linux, macOS) with simple file-based storage.
- **MCP Integration:** Acts as an MCP server, providing tools for agents to `search`, `memorize`, `feedback`, and `delete` context.
- **Agent Skill:** Ships with a portable Agent Skill definition that teaches agents how to use long-term memory effectively.
- **Embedding Script:** Includes a model-agnostic Python tool for converting text to sparse vectors.

# Quick Start

## Install from GitHub (no npm or pip)

Clone the repo and run the installer. You only need Node.js and Python runtimes.

```bash
git clone https://github.com/WazzaMo/vecfs.git
cd vecfs
./install-from-github.sh
```

This installs into `~/.local` by default. Add `~/.local/bin` to your PATH if needed. For the embedding script, install Python dependencies once: `pip install ~/.local/lib/vecfs/embed` (or use `./install-from-github.sh --install-python-deps`).

Options: `--server` (MCP server only), `--embed` (embedding script only), `--prefix DIR`, `--install-python-deps`, `--help`.

## Install the MCP Server (npm)

```bash
npm install -g vecfs
```

Or run directly without installing:

```bash
npx vecfs
```

## Agent Configuration

Add VecFS to your agent's MCP configuration (Claude Desktop, Cursor, etc.):

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

If you installed from GitHub with `install-from-github.sh`, use the full path to the binary, e.g. `"command": "/home/you/.local/bin/vecfs"` (and omit `args`), or ensure `~/.local/bin` is on the PATH used by your agent.

## Install the Embedding Script (pip/uv)

The embedding script converts text to sparse vectors for the MCP server.

```bash
pip install vecfs-embed
```

Or using uv:

```bash
uv tool install vecfs-embed
```

If you used the GitHub installer above, install deps from the installed copy: `pip install ~/.local/lib/vecfs/embed`.

### Usage

```bash
# Embed a query for searching
vecfs-embed --mode query "sparse vector storage"

# Embed a document for memorisation
vecfs-embed --mode document "key lesson to remember"

# Batch embed multiple texts
cat texts.txt | vecfs-embed --batch --mode document

# Find the right sparsification threshold for your model
cat sample.txt | vecfs-embed --calibrate
```

# Transport Modes

## Stdio (Default)

```bash
vecfs
```

Used with CLI-based agents like Claude Desktop and Cursor. Simple, secure, no network ports exposed.

## HTTP / SSE

```bash
vecfs --http
# Or with custom port
PORT=8080 vecfs --http
```

Used for remote agents, debugging, or containerised deployments. Endpoints: `GET /sse` and `POST /messages`.

# Configuration

| Environment Variable | Description                      | Default              |
|----------------------|----------------------------------|----------------------|
| `VECFS_FILE`         | Path to the vector storage file  | `./vecfs-data.jsonl` |
| `PORT`               | Port for HTTP mode               | `3000`               |

# Agent Skill

VecFS ships with a `vecfs-memory` skill in the [Agent Skills](https://agentskills.io) format. The skill directory is bundled in the npm package at `vecfs-memory/` and teaches agents:

- **Context Sweep:** Proactively search for relevant history at the start of a task.
- **Reflective Learning:** Memorise key lessons after completing work.
- **Feedback Loop:** Reinforce useful memories and demote unhelpful ones.

See [vecfs-memory/SKILL.md](vecfs-memory/SKILL.md) for the full skill definition.

# Development

## Prerequisites

- Node.js 22+ (see `.node-version`)
- Python 3.10+ and [uv](https://docs.astral.sh/uv/) (for the embedding script)

## Building from Source

```bash
# MCP server
npm install
npm run build

# Embedding script
cd py-src
uv sync
```

## Packaging for Distribution

To create a self-contained distributable archive containing the MCP server, the embedding script wheel, the agent skill, and an installer:

```bash
./scripts/package.sh
```

This runs all build steps, executes the test suites, and produces a minimal `vecfs-<version>.tar.gz` (~400 KB). The tarball contains no source code, no `node_modules`, and no dev tooling — just pre-built artefacts ready to install.

To install from the archive:

```bash
tar xzf vecfs-0.1.0.tar.gz
cd vecfs-0.1.0
./install.sh            # installs both MCP server and embedding script
./install.sh --server   # MCP server only
./install.sh --embed    # embedding script only
```

## Running Tests

```bash
# All TypeScript tests (unit + stdio integration)
npm test

# Stdio MCP server integration tests only
npm run test:integration

# HTTP/SSE MCP server integration tests (builds first)
npm run test:http

# Python unit tests (sparsify module, no model needed)
cd py-src
uv run pytest tests/test_sparsify.py -v

# Python embedding integration tests (uses docs/ as input, loads model)
cd py-src
uv run pytest tests/test_integration.py -v
```

# Local Agent installs

## Running VecFS in Cursor

Use the package script to bundle up VecFS and use it to install
the MCP server and `vecfs-embed` program globally.

In your local project where you want persistent memory add:

mkdir -p .cursor

create .cursor/mcp.json and give it this text.
```
{
  "mcpServers": {
    "vecfs": {
      "command": "npx",
      "args": ["vecfs"],
      "env": {
        "VECFS_FILE": "./vecfs-memory.jsonl",
        "PORT": "3000"
      }
    }
  }
} 
```


# Documentation

- [Goals](docs/goals.md) - The vision and core principles of VecFS.
- [Requirements](docs/requirements.md) - Technical requirements for the MCP server and storage layer.
- [Agent Skills](docs/skills.md) - Behavioral logic for AI agents.
- [Server Connections](docs/mcp-server-connections.md) - Transport configuration guide.
- [Doc Guide](docs/doc-guide.md) - Guidelines for contributing to documentation.

# License

This project is licensed under the Apache License, Version 2.0. See the [LICENSE](LICENSE) file for details.
