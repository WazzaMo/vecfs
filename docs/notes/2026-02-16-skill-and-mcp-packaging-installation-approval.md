# 2026-02-16 Skill and MCP Server Packaging, Installation and Approval

This note examines how skills and MCP servers are created, packaged, installed and approved for use within the Cursor agent CLI, using VecFS as the working example, and proposes conventions the project should follow going forward.

# Background

VecFS has two runtime components an agent depends on: an MCP server (TypeScript/Node.js) that provides tools via the Model Context Protocol, and an agent skill (`vecfs-memory/`) that teaches the agent when and how to use those tools. A third companion, the embedding script (`vecfs-embed`, Python), generates sparse vectors but is not directly visible to the agent host. Understanding how each piece is packaged, discovered and authorised is essential for a smooth installation experience.

# How MCP Servers Are Installed in Cursor

Cursor discovers MCP servers through a JSON configuration file. The file can be scoped to a project or to the user's global settings.

## Project-Scoped Configuration

A `.cursor/mcp.json` file at the project root registers MCP servers for that workspace only. This is the recommended approach for project-specific memory stores.

```json
{
  "mcpServers": {
    "vecfs": {
      "command": "npx",
      "args": ["vecfs"],
      "env": {
        "VECFS_FILE": "./vecfs-memory.jsonl"
      }
    }
  }
}
```

## Global Configuration

A `~/.cursor/mcp.json` (or equivalent per-platform path) registers MCP servers available to every workspace. This suits servers that provide general-purpose capabilities rather than project-specific data.

## Key Points

### Command Must Be Resolvable

The `command` field must resolve on the user's PATH. For Node.js servers, `npx` is the standard launcher because it handles package resolution, caching and execution in one step. The VecFS packaging plan already ensures the `bin` field in `package.json` maps `vecfs` to the bundled `dist/mcp-server.js`, so `npx vecfs` works without a global install.

### Environment Variables Are the Configuration Surface

MCP server configuration in Cursor is limited to `command`, `args`, and `env`. There is no UI for richer settings. Any tuneable behaviour (file paths, ports, thresholds) must be driven by environment variables. VecFS uses `VECFS_FILE` and `PORT` for this purpose.

### Stdio Is the Default Transport

Cursor launches MCP servers as child processes and communicates over stdio. The HTTP/SSE transport is available for remote or containerised deployments but is not the primary path for local Cursor usage.

# How Skills Are Installed in Cursor

Cursor does not yet have a built-in skill registry or discovery mechanism. Skills are loaded by the agent through filesystem access, which means the skill directory must be present on disk where the agent can read it.

## Filesystem-Based Discovery

Following the Agent Skills specification, a filesystem-based agent (which is what Cursor's agent mode is) discovers skills by scanning configured directories and reading `SKILL.md` frontmatter. The metadata (name and description) is injected into the system prompt so the model knows what skills are available and when to activate them.

## Where to Place the Skill Directory

There are three practical locations for the `vecfs-memory/` skill directory.

### Inside the Project

Copy or symlink `vecfs-memory/` into the project root. The agent sees it during workspace scanning. This is the simplest approach and keeps the skill version-controlled alongside the project.

### Inside the npm Package

The VecFS npm package already includes `vecfs-memory/` via the `files` field in `package.json`. After `npm install -g vecfs` or the first `npx vecfs` invocation, the skill directory exists inside the npm cache or global prefix. An agent configured to scan the package directory can find it automatically.

### In a Dedicated Skills Directory

A user-level skills directory (for example `~/.agent-skills/`) could hold skills from multiple packages. An install step would copy the skill there. This approach scales better when many skills are installed but requires the agent to be configured with the scan path.

## Recommended Convention for VecFS

Ship the skill inside the npm package. After installation, users who want project-scoped skill access can copy or symlink the directory.

```bash
# After npm install -g vecfs
ln -s "$(npm root -g)/vecfs/vecfs-memory" ./vecfs-memory
```

Or for a project using a local install:

```bash
npm install vecfs
ln -s node_modules/vecfs/vecfs-memory ./vecfs-memory
```

The agent then finds `vecfs-memory/SKILL.md` during workspace scanning and loads the frontmatter at startup.

# Packaging Conventions

## MCP Server

### Single-File Bundle

The MCP server is packaged as a single esbuild bundle (`dist/mcp-server.js`) with a `#!/usr/bin/env node` shebang. No `node_modules` are needed at runtime. This keeps the npm tarball small (under 2 MB) and avoids dependency conflicts with other globally installed packages.

### bin and files Fields

The `package.json` must declare both the `bin` field (for `npx` resolution) and the `files` field (to control what gets published).

```json
{
  "bin": { "vecfs": "dist/mcp-server.js" },
  "files": ["dist/", "vecfs-memory/", "README.md", "LICENSE"]
}
```

### prepublishOnly Gate

The `prepublishOnly` script should build the server and validate the skill before any publish.

```json
{
  "scripts": {
    "prepublishOnly": "npm run build"
  }
}
```

When the `skills-ref` tool is available, add skill validation to this gate:

```bash
npm run build && npx skills-ref validate ./vecfs-memory
```

## Embedding Script

### Separate Python Package

The embedding script is published as `vecfs-embed` on PyPI. It has its own version and release cadence. Users install it with `uv tool install vecfs-embed` or `pip install vecfs-embed`.

### Wheel in the Tarball

For offline or self-contained distribution, the `scripts/package.sh` script bundles the built wheel into the `vecfs-<version>.tar.gz` archive alongside the MCP server bundle and the skill directory. The included `install.sh` helper installs both components.

## Skill Directory

### Must Follow the Agent Skills Specification

The `vecfs-memory/` directory must contain a valid `SKILL.md` with YAML frontmatter. The `name` field must match the directory name. Optional `scripts/`, `references/`, and `assets/` subdirectories provide supporting material loaded on demand.

### Bundled With the npm Package

The skill directory is included in the npm package via the `files` field. This ensures it is always co-versioned with the MCP server it depends on.

### Standalone Copyable

The skill directory must also be usable when copied out of the npm package. All internal references should use relative paths from the skill root. No build step or external dependency should be required to read the skill.

# Approval for Use

Approval covers two concerns: the user trusting the MCP server to run, and the agent trusting the skill to execute its tools.

## MCP Server Approval

### Explicit Configuration

In Cursor, an MCP server does not run unless the user explicitly adds it to `.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (global). This is the primary approval gate. No server auto-discovers or self-registers.

### Tool Confirmation

When an agent calls an MCP tool for the first time in a session, Cursor may prompt the user to approve the tool invocation depending on the agent mode settings (auto-approve vs. confirm). This provides a runtime approval layer on top of the configuration-time registration.

### No Secret Exposure

MCP server configuration supports `env` for passing environment variables. These should never contain secrets that would be logged or exposed to the agent. VecFS only uses `VECFS_FILE` (a file path) and `PORT` (a number), both of which are safe to expose.

## Skill Approval

### Frontmatter Metadata as Declaration of Intent

The `allowed-tools` field in the SKILL.md frontmatter declares which tools the skill needs. This acts as a manifest that a host agent or reviewer can inspect before granting access. VecFS declares `search memorize feedback delete`.

### User Must Place the Skill

Since Cursor discovers skills through filesystem scanning, the user controls approval by choosing whether to place the skill directory in a scanned location. Removing the directory revokes the skill.

### Script Execution Requires Caution

The `vecfs-memory/scripts/validate-store.sh` script reads the JSONL data file and reports metrics. It does not modify data. However, any skill that bundles executable scripts should follow these practices.

#### Sandboxing

Run scripts in the same sandbox as the agent's other shell commands. Do not grant elevated privileges.

#### Transparency

Scripts should be short, readable, and do one thing. A reviewer should be able to audit the script in under a minute.

#### User Confirmation

Agents should confirm with the user before running a skill script, especially if it modifies files or makes network requests.

#### Logging

All script executions should be logged so the user can review what the skill did after the fact.

## Coordinated Trust

The MCP server and the skill are coupled. The server provides the tools; the skill provides the instructions for using them. Both must be approved together for the system to function. The recommended approach is to version them together in the same npm package so users install and approve a single coherent unit rather than managing two independent trust decisions.

# Summary of Conventions

## Packaging

Ship the MCP server as a single-file Node.js bundle published to npm with the skill directory included. Ship the embedding script as a separate Python wheel on PyPI. For offline distribution, use the `scripts/package.sh` tarball that contains both plus an installer.

## Installation

Users add the MCP server to `.cursor/mcp.json` with an `npx vecfs` command entry. The skill directory is made available by symlinking or copying from the installed npm package into the project workspace.

## Approval

MCP server approval is granted by the user adding the configuration entry. Skill approval is granted by placing the skill directory in a scannable location. Runtime tool invocations may require per-session confirmation depending on the agent mode. Scripts bundled with skills should be auditable, transparent and non-destructive.
