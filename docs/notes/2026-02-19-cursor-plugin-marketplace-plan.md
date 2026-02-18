# Cursor Plugin and Marketplace Plan

This note outlines what needs to be created to package VecFS as a Cursor plugin and prepare it for the Cursor Marketplace.

# References

- [Cursor Plugin Docs](https://cursor.com/docs/plugins)
- [Cursor Marketplace](https://cursor.com/marketplace)
- [Publish Plugins](https://cursor.com/marketplace/publish)
- [cursor/plugin-template](https://github.com/cursor/plugin-template)

# Plugin Primitives

Cursor plugins bundle one or more of these primitives:

- **Rules:** System-level instructions (`.mdc` files)
- **Skills:** Domain-specific prompts and code (SKILL.md with frontmatter)
- **MCP servers:** Connections to external tools (mcp.json)
- **Subagents:** Specialized agents
- **Hooks:** Custom scripts for observing/controlling agent behaviour
- **Commands:** User-invokable commands

VecFS will bundle: **MCP server** (vecfs) and **Skill** (vecfs-memory).

# Recommended Structure: Single Plugin

VecFS has one logical plugin (agent memory). Use the single-plugin layout:

- Plugin contents at repository root
- One `.cursor-plugin/plugin.json`
- No `.cursor-plugin/marketplace.json`

# What Needs to Be Created

## 1. Plugin Manifest

Create `.cursor-plugin/plugin.json` with:

- `name`: `vecfs` (lowercase kebab-case)
- `displayName`: `VecFS`
- `version`: Align with package.json (e.g. `0.1.1`)
- `description`: Short summary for marketplace listing
- `author`: `{ "name": "Warwick Molloy", "email": "..." }`
- `license`: `Apache-2.0`
- `keywords`: `["vecfs", "memory", "mcp", "vector", "agent-memory", "local-first"]`
- `logo`: Path to logo asset (e.g. `assets/logo.svg`)
- `skills`: Reference to skill directory or file
- `mcpServers`: Reference to mcp.json (or inline MCP config)

## 2. MCP Configuration

Create `mcp.json` at repository root (or path referenced from plugin.json):

```json
{
  "mcpServers": {
    "vecfs": {
      "command": "npx",
      "args": ["-y", "vecfs"],
      "env": {
        "VECFS_FILE": "./vecfs-memory.jsonl"
      }
    }
  }
}
```

Consider:

- Default `VECFS_FILE` relative to project (e.g. `.cursor/vecfs-memory.jsonl` or project root)
- Document that users can override via env

## 3. Skill Integration

The existing `vecfs-memory/` directory contains the skill. Cursor plugin expects:

- Skills in `skills/` directory
- Each skill as `SKILL.md` with YAML frontmatter including `name` and `description`

Actions:

- Either move/copy `vecfs-memory/SKILL.md` to `skills/vecfs-memory/SKILL.md`
- Or add a `skills` entry in plugin.json pointing at `vecfs-memory/` if the validator supports directory references
- Ensure frontmatter has required keys: `name`, `description` (vecfs-memory already has these)

## 4. Logo Asset

Create `assets/logo.svg` for marketplace display. Requirements:

- SVG format
- Recognisable icon for VecFS (e.g. vector/memory motif)
- Reasonable size for marketplace thumbnail

## 5. Validation Script

Adopt or adapt the Cursor template validator:

- Copy `scripts/validate-template.mjs` from [cursor/plugin-template](https://github.com/cursor/plugin-template)
- For single-plugin layout, the official validator expects `marketplace.json`. Two options:
  - **Option A:** Create a minimal `.cursor-plugin/marketplace.json` with one plugin entry whose `source` is `"."` (repo root), so the validator runs against the root as the plugin directory
  - **Option B:** Fork the validator to support single-plugin mode (skip marketplace check when only `plugin.json` exists)
- Add `npm run validate:plugin` (or similar) to run validation before release

## 6. Documentation Updates

- Add a "Cursor Plugin" section to README.md with install-from-marketplace instructions
- Document that the plugin bundles the MCP server config and vecfs-memory skill
- Update docs/requirements.md if the plugin is a new distribution channel

## 7. Submission Checklist (from Cursor Template)

Before submitting to Cursor:

- [ ] Valid `.cursor-plugin/plugin.json`
- [ ] Plugin name is unique, lowercase, kebab-case
- [ ] All frontmatter metadata present in skill files
- [ ] Logo committed and referenced with relative path
- [ ] Validation script passes
- [ ] Repository link ready for submission (Slack or kniparko@anysphere.com)

# Structural Decisions

## Option A: Plugin-First Layout

Restructure repo so the plugin is the primary artifact:

```
vecfs/
├── .cursor-plugin/
│   └── plugin.json
├── mcp.json
├── skills/
│   └── vecfs-memory/
│       └── SKILL.md
├── assets/
│   └── logo.svg
├── ts-src/           # MCP server source
├── py-src/           # Embedding script
├── vecfs-memory/     # Keep for npm package / backward compat, or remove
└── ...
```

## Option B: Add Plugin Alongside Existing Layout

Keep current layout, add plugin files:

```
vecfs/
├── .cursor-plugin/
│   └── plugin.json
├── mcp.json          # At root, used when installed as plugin
├── vecfs-memory/     # Existing skill - reference from plugin.json
├── assets/
│   └── logo.svg
├── ts-src/
├── py-src/
└── ...
```

Recommendation: **Option B** — minimal change, reuse existing vecfs-memory. Ensure plugin.json correctly references `vecfs-memory/SKILL.md` or `vecfs-memory/` as the skills path.

## MCP Command: npx vs Global

Plugin mcp.json should use `npx -y vecfs` so users get the published npm package without pre-installing. Users who install from GitHub can override via Cursor's MCP config (project or global) to point at a local binary.

# Implementation Order

1. Create `.cursor-plugin/plugin.json` with correct metadata
2. Create `mcp.json` at repo root
3. Create `assets/logo.svg`
4. Add validation script (single-plugin variant) and npm script
5. Verify skill frontmatter and path references
6. Update README with Cursor Plugin section
7. Run validation, fix any issues
8. Submit to Cursor (cursor.com/marketplace/publish, sign in, provide repo link)

# Open Questions

- Does Cursor support `skills` as a path to a directory containing SKILL.md, or must skills live under `skills/` with a specific structure?
- For users who install from GitHub (install-from-github.sh), how do they configure the plugin to use their local `vecfs` binary instead of npx?
- Is there a way to bundle the embedding script (vecfs-embed) in the plugin, or is it documented as a separate install?

# Success Criteria

1. VecFS appears as an installable plugin on the Cursor Marketplace
2. One-click install configures the VecFS MCP server and vecfs-memory skill
3. Validation script passes for the plugin structure
4. Documentation clearly explains installation and configuration
