---
name: vecfs-memory
description: >
  Gives an agent persistent long-term memory backed by a local sparse-vector
  file. Use when the agent should recall past context, learn from interactions,
  or incorporate reinforcement feedback. Relevant for tasks mentioning memory,
  recall, learning, history, or context retention.
license: Apache-2.0
compatibility: >
  Requires a running VecFS MCP server (stdio or HTTP mode). The server
  handles embedding; use text in and get text out. Node.js 22+ for the server.
metadata:
  author: warwick-molloy
  version: "0.1"
allowed-tools: search memorize feedback delete
---

# When to Activate

Activate this skill when any of the following apply:

- The user's task is non-trivial and could benefit from prior context.
- The user explicitly mentions remembering, recalling, or learning.
- The agent encounters a repeated error or pattern it has seen before.
- The conversation involves a project that spans multiple sessions.
- The conversation or a markdown file indicates that a decision has been made.

# Text In, Text Out

Use **text** for MCP commands and get **text** back. VecFS handles vector
embedding; you do not supply or interpret vectors.

- **search:** Send a natural-language `query` string. The server embeds it and
  returns results as text: `id`, `metadata` (including stored text), `score`,
  `timestamp`, `similarity`. No vectors in the response.
- **memorize:** Send `id` and `text` (and optional `metadata`). The server
  embeds the text and stores it. You do not need to compute or pass a vector.

# Context Sweep (Proactive Recall)

At the start of any non-trivial task, perform a Context Sweep:

1. Extract keywords and concepts from the current user prompt.
2. Call the `search` tool with a `query` string (e.g. the user's question or
   a short phrase summarising the task). Do not supply a vector.
3. Use the text response: each result has `id`, `metadata` (with stored text),
   and `similarity`. If results have high similarity, incorporate them into
   your reasoning (including any stored decisions). Mention to the user that
   you found relevant history.
4. If results have low similarity or no results are returned, proceed without
   historical context. Do not force irrelevant recall.

# Memorisation (Reflective Learning)

After completing a task or achieving a milestone:

1. Identify key lessons, corrections, decisions, or facts worth retaining.
2. Filter for long-term value: avoid storing transient details like
   one-time commands or session-specific paths.
3. Summarise the lesson as a short, clear text (one to three sentences).
4. Call the `memorize` tool with:
   - A descriptive `id` (e.g., `lesson-react-useeffect-cleanup`).
   - The `text` content (VecFS will embed it).
   - Optional `metadata` tags (e.g., `{"topic": "react", "type": "correction"}`).

If an entry with the same `id` already exists, `memorize` updates it in place.

# Decisions

Decisions detected in the user-agent conversation or in markdown files
(e.g. "we decided to use X", "Decision: ...", or a documented choice)
should be stored in VecFS memory so they are available in future
context sweeps.

## Storing decisions

When you detect a decision:

1. Summarise it in one to three sentences.
2. Call `memorize` with a descriptive `id` (e.g. `decision-use-react-query`),
   the `text`, and metadata such as `{"type": "decision"}`. VecFS handles embedding.

## Discovering decisions during a context sweep

Context sweep results may include stored decisions. Treat them as
relevant history: incorporate recalled decisions into your reasoning and
mention them to the user when they affect the current task.

# Feedback Loop

Actively process reinforcement signals to improve recall quality:

## Positive Feedback

When the user confirms that recalled context was helpful, call `feedback`
with a positive `scoreAdjustment` (e.g., `+1`) for the entries that were used.

## Negative Feedback

When the user corrects you or says recalled context was wrong, call `feedback`
with a negative `scoreAdjustment` (e.g., `-1`).

## Implicit Success

If the task completes without correction, call `feedback` with a small
positive adjustment (e.g., `+0.5`) for any context entries that contributed.

# Cleanup

Use the `delete` tool to remove entries that are clearly outdated or wrong.
If two entries contradict each other, keep the one with the higher score and
delete the other.

# Edge Cases

- **Empty search results:** Proceed without context. Do not fabricate recall.
- **Conflicting memories:** Prefer the entry with the higher reinforcement
  score. Consider deleting the lower-scored conflicting entry.
- **Large text:** Summarise before memorising. Keep stored text concise to
  maximise retrieval quality.
- **Bulk indexing:** Call `memorize` with `id` and `text` for each item;
  VecFS embeds each one.

# Tool Quick Reference

See [references/tool-reference.md](references/tool-reference.md) for full
parameter details.

| Tool     | Purpose                          | Recommended Params        |
|----------|----------------------------------|--------------------------|
| search   | Find relevant past context       | query (text)             |
| memorize | Store a new lesson or fact       | id, text                 |
| feedback | Adjust reinforcement score       | id, scoreAdjustment      |
| delete   | Remove an outdated entry         | id                       |
