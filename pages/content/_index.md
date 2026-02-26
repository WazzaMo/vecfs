---
title: "VecFS"
description: "Lightweight, local-first vector storage for AI agent long-term memory"
---

**VecFS** (Vector File System) is a lightweight, local-first vector storage specification and implementation designed for AI agent long-term memory.

(c) Copyright 2026 Warwick Molloy. Contribution to this project is supported and contributors will be recognised.

## Overview

VecFS gives AI agents a simple, efficient way to store and retrieve context locally. Through the Model Context Protocol (MCP), agents can learn from their interactions and recall relevant information in future sessions without the complexity of a full-scale vector database.

## Key Features

- **Sparse vector storage** — Follows the principle of "not storing zeros" for natural data compression and minimal disk footprint.
- **Local-first** — Designed to run on a laptop (WSL2, Linux, macOS) with simple file-based storage.
- **MCP integration** — Acts as an MCP server, providing tools for agents to `search`, `memorize`, `feedback`, and `delete` context.
- **Agent skill** — Ships with a portable Agent Skill definition that teaches agents how to use long-term memory effectively.
- **Embedding script** — Includes a model-agnostic Python tool for converting text to sparse vectors.

## Quick Start

### Install from GitHub (no npm or pip)

Clone the repo and run the installer. You only need Node.js and Python runtimes.

```bash
git clone https://github.com/WazzaMo/vecfs.git
cd vecfs
./install-from-github.sh
```

This installs into `~/.local` by default. Add `~/.local/bin` to your PATH if needed.

### Install the MCP server (npm)

```bash
npm install -g vecfs
```

Or run directly without installing:

```bash
npx vecfs
```

### Agent configuration

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

## Transport modes

- **Stdio (default)** — `vecfs` — Used with CLI-based agents. Simple, secure, no network ports.
- **HTTP / SSE** — `vecfs --http` or `PORT=8080 vecfs --http` — For remote agents or debugging.

## Documentation

- [Goals](/vecfs/docs/goals/) — Objectives and design goals for VecFS.
- [Requirements](/vecfs/docs/requirements/) — Technical requirements for the MCP server and storage layer.
- [Releases](/vecfs/docs/releases/) — Release notes and version history.

## License

This project is licensed under the Apache License, Version 2.0.
