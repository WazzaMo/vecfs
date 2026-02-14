# 2026-02-15 Agent Skill Definition Plan

This note describes how to package the VecFS behavioral logic as a formal Agent Skill following the specification at https://agentskills.io/specification.

# Motivation

The project already defines skill behaviors in `docs/skills.md` (proactive recall, reflective learning, feedback integration). Today these behaviors exist only as documentation. The Agent Skills specification provides a portable, machine-readable format that any compatible agent can discover, activate, and execute. Packaging VecFS as a skill turns the documentation into an installable capability.

# Specification Summary

An Agent Skill is a directory containing a required `SKILL.md` file with YAML frontmatter and Markdown instructions. Optional subdirectories (`scripts/`, `references/`, `assets/`) provide supporting material. Agents load the `name` and `description` at startup for discovery, the full `SKILL.md` body on activation, and reference files on demand.

# Proposed Skill Name

The skill name must be lowercase alphanumeric with hyphens, match the parent directory name, and be 1-64 characters.

Proposed name: `vecfs-memory`

This clearly communicates the purpose (vector-based long-term memory) and satisfies all naming constraints.

# Directory Layout

The skill will live at the repository root alongside `ts-src/` and `docs/`.

```
vecfs-memory/
├── SKILL.md
├── scripts/
│   └── validate-store.sh
├── references/
│   ├── tool-reference.md
│   └── vector-encoding.md
└── assets/
    └── interaction-flow.md
```

# SKILL.md Design

## Frontmatter

The frontmatter defines identity and discovery metadata.

```yaml
---
name: vecfs-memory
description: >
  Gives an agent persistent long-term memory backed by a local sparse-vector
  file. Use when the agent should recall past context, learn from interactions,
  or incorporate reinforcement feedback. Relevant for tasks mentioning memory,
  recall, learning, history, or context retention.
license: Apache-2.0
compatibility: >
  Requires a running VecFS MCP server (stdio or HTTP mode) and Node.js 18+.
metadata:
  author: warwick-molloy
  version: "0.1"
allowed-tools: search memorize feedback
---
```

### Field Rationale

#### name

`vecfs-memory` matches the directory name, uses only lowercase letters and hyphens, and is well under 64 characters.

#### description

The description names both what the skill does (persistent memory via sparse vectors) and when to activate it (tasks involving recall, learning, history). It includes keywords an agent would match against user prompts.

#### compatibility

Documents the runtime dependency on the VecFS MCP server and Node.js, since the skill is meaningless without a running server to call.

#### allowed-tools

Lists the three MCP tools the skill needs: `search`, `memorize`, and `feedback`. These map directly to the tools defined in `ts-src/mcp-server.ts`.

## Body Content

The Markdown body will contain the agent instructions currently described in `docs/skills.md`, restructured for progressive disclosure. The body should stay under 500 lines and under 5000 tokens as recommended by the specification.

### Proposed Sections

#### When to Activate

A concise trigger description. The agent should activate this skill when any of the following apply:

- The user's task is non-trivial and could benefit from prior context.
- The user explicitly mentions remembering, recalling, or learning.
- The agent encounters a repeated error or pattern it has seen before.

#### Context Sweep (Proactive Recall)

Step-by-step instructions derived from the "Proactive Recall" behavior in `docs/skills.md`:

1. Extract keywords and concepts from the current user prompt.
2. Construct a sparse vector from those keywords (or pass a dense embedding).
3. Call the `search` tool with that vector.
4. If results are returned with high similarity, incorporate them into reasoning.
5. If results have low similarity, proceed without historical context.

#### Memorization (Reflective Learning)

Instructions for the "Reflective Learning" behavior:

1. After completing a task, identify key lessons or facts worth retaining.
2. Filter for long-term value: avoid storing transient details.
3. Call the `memorize` tool with a descriptive `id`, the `text` content, a sparse vector, and relevant metadata tags.

#### Feedback Loop

Instructions for the "Feedback Integration" behavior:

1. On explicit positive feedback from the user, call `feedback` with a positive `scoreAdjustment` for the context entries that were used.
2. On negative feedback or correction, call `feedback` with a negative `scoreAdjustment`.
3. On implicit success (task completed without correction), call `feedback` with a small positive adjustment.

#### Edge Cases

- Empty search results: proceed without context; do not force irrelevant recall.
- Conflicting memories: if two results contradict each other, prefer the one with the higher reinforcement score.
- Large text: summarize before memorizing; keep stored text concise.

# Reference Files

## references/tool-reference.md

A focused description of each MCP tool's input schema and expected output, extracted from the tool definitions in `ts-src/mcp-server.ts`. This gives the agent quick access to parameter details without loading the full SKILL.md again.

| Tool     | Required Params              | Optional Params |
|----------|------------------------------|-----------------|
| search   | vector                       | limit           |
| memorize | id, vector                   | text, metadata  |
| feedback | id, scoreAdjustment          | (none)          |

## references/vector-encoding.md

Guidance on constructing sparse vectors from text. Covers:

- Dense-to-sparse conversion via the `toSparse` function logic.
- Threshold selection for dropping near-zero components.
- How cosine similarity drives result ranking.

This material comes from the math in `ts-src/sparse-vector.ts` and the design principles in `docs/goals.md`.

# Scripts

## scripts/validate-store.sh

A shell script that reads the JSONL data file and reports basic health metrics:

- Total entry count.
- Average sparsity (non-zero dimensions per vector).
- Entries with extreme reinforcement scores.

This supports the "Audit the archive" guideline from `docs/skills.md` and gives agents a concrete tool for self-audit behavior.

# Assets

## assets/interaction-flow.md

A Mermaid diagram (already drafted in `docs/requirements.md`) showing the full search-memorize-feedback loop. Kept in a separate file so it is only loaded when the agent needs to explain or visualize the interaction pattern.

# Mapping to Existing Code

The table below maps each skill behavior to the TypeScript implementation that supports it.

| Skill Behavior    | MCP Tool   | Source File              | Key Function            |
|-------------------|------------|--------------------------|-------------------------|
| Context Sweep     | search     | ts-src/storage.ts        | VecFSStorage.search     |
| Memorization      | memorize   | ts-src/storage.ts        | VecFSStorage.store      |
| Feedback Loop     | feedback   | ts-src/storage.ts        | VecFSStorage.updateScore|
| Vector Conversion | (internal) | ts-src/sparse-vector.ts  | toSparse                |
| Similarity Calc   | (internal) | ts-src/sparse-vector.ts  | cosineSimilarity        |

# Implementation Steps

## Step 1: Create the Skill Directory

Create `vecfs-memory/` at the repository root with the `SKILL.md` file containing the frontmatter and body content described above.

## Step 2: Write Reference Files

Extract tool schemas from `ts-src/mcp-server.ts` into `references/tool-reference.md`. Summarize the sparse vector math from `ts-src/sparse-vector.ts` into `references/vector-encoding.md`.

## Step 3: Create the Validation Script

Write `scripts/validate-store.sh` to parse the JSONL file and output health metrics.

## Step 4: Add the Interaction Diagram

Move the Mermaid sequence diagram from `docs/requirements.md` into `assets/interaction-flow.md` as a standalone reference asset.

## Step 5: Validate

Use the `skills-ref` reference library to validate the skill:

```bash
npx skills-ref validate ./vecfs-memory
```

## Step 6: Update Project Documentation

Update `docs/requirements.md` to note the skill package as a deliverable. Update `docs/skills.md` to reference the formal skill directory and explain the relationship between the documentation and the portable skill format.

# Installing the Skill into an Agent

The Agent Skills integration guide (https://agentskills.io/integrate-skills) describes two approaches for making a skill available to an agent. Both begin the same way: the agent discovers skill directories, parses frontmatter for metadata, and injects that metadata into its context so it knows when to activate the skill.

## Filesystem-Based Agents

Filesystem-based agents (such as Claude Code or similar CLI agents) operate within a shell environment. Installation is straightforward:

1. Place the `vecfs-memory/` directory in a location the agent is configured to scan for skills.
2. At startup the agent reads only the YAML frontmatter of `SKILL.md` to learn the skill's name and description.
3. When a user task matches the description, the agent reads the full `SKILL.md` body via a shell command (e.g., `cat vecfs-memory/SKILL.md`).
4. Scripts and references are accessed through further shell reads as needed.

For VecFS this means shipping the `vecfs-memory/` directory alongside the project or copying it into the agent's skill search path.

## Tool-Based Agents

Tool-based agents lack direct filesystem access. Instead, the agent platform exposes tools that let the model trigger skill loading. The platform developer implements:

1. A discovery tool that lists available skills from a configured registry or directory.
2. An activation tool that returns the full SKILL.md content when the model requests it.
3. A resource-access tool for loading files from `scripts/`, `references/`, or `assets/`.

For VecFS, if the target agent is tool-based, the skill directory could be bundled into the npm package and served through a small wrapper that exposes these discovery and activation tools.

## Metadata Injection

Regardless of approach, the agent's system prompt should include the skill metadata so the model can decide when to activate the skill. The recommended format for Claude models uses XML:

```xml
<skills>
  <skill>
    <name>vecfs-memory</name>
    <description>Gives an agent persistent long-term memory backed by a local sparse-vector file. Use when the agent should recall past context, learn from interactions, or incorporate reinforcement feedback.</description>
    <location>/path/to/vecfs-memory/SKILL.md</location>
  </skill>
</skills>
```

The `skills-ref` CLI can generate this XML automatically:

```bash
skills-ref to-prompt ./vecfs-memory
```

Each skill adds roughly 50-100 tokens to the system prompt, so the VecFS skill's metadata footprint is minimal.

## Security Considerations

If the skill bundles executable scripts (such as `scripts/validate-store.sh`), the host agent should:

- Sandbox script execution or run in an isolated environment.
- Allowlist only trusted skill directories.
- Prompt the user for confirmation before running scripts.
- Log all script executions for auditing.

# Open Questions

## Embedding Generation

The current MCP server accepts pre-computed vectors. Should the skill instruct the agent to generate embeddings itself, or should a future `scripts/embed.py` handle this? This affects whether the skill needs an additional script and a `compatibility` note about Python or an embedding API.

## Skill Distribution

The installation section above covers how an agent loads a local skill directory. The remaining question is how to distribute the directory to users: bundle it in the npm package, publish it as a standalone archive, or register it in a future skill registry. The simplest initial approach is to include `vecfs-memory/` in the git repository so it ships with the source.

## Token Budget

The full body content must stay under 5000 tokens. The current `docs/skills.md` is roughly 95 lines. Combined with the structured instructions above, this should fit comfortably, but the final SKILL.md should be measured after drafting.
