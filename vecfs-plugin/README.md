# VecFS Cursor Plugin

Local-first vector storage for AI agent long-term memory. This plugin bundles the VecFS MCP server and the vecfs-memory skill for Cursor.

# Contents

- **MCP Server:** VecFS vector storage (search, memorize, feedback, delete)
- **Skill:** vecfs-memory — teaches agents to recall context, learn from interactions, and use reinforcement feedback

# Installation

Install from the [Cursor Marketplace](https://cursor.com/marketplace) or configure manually:

1. Install the VecFS MCP server: `npm install -g vecfs` or `npx vecfs`
2. Add this plugin's `mcp.json` and `skills/` to your Cursor configuration

# Configuration

The MCP server uses `VECFS_FILE` (default: `./vecfs-memory.jsonl`) for storage. Override via environment in your MCP config.

# Validation

From the `vecfs-plugin/` directory:

```bash
node scripts/validate-plugin.mjs
```

# License

Apache-2.0
