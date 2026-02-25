# Tool Reference

Complete parameter reference for the VecFS MCP server tools.

# search

Semantic search: find entries with similar meaning to the query text. Vectorisation happens inside VecFS (text-only API).

## Parameters

| Name   | Type   | Required | Description                          |
|--------|--------|----------|--------------------------------------|
| query  | string | Yes      | Search by text (semantic)            |
| limit  | number | No       | Maximum results to return (default 5)|

## Response

A JSON array of matching entries, sorted by similarity (highest first). Each entry includes `id`, `metadata`, `score`, `timestamp`, and `similarity`. Vectors are not returned.

# memorize

Store a new entry by text. Vectorisation happens inside VecFS (text-only API). If an entry with the same `id` already exists, it is replaced (upsert semantics).

## Parameters

| Name     | Type   | Required | Description                           |
|----------|--------|----------|---------------------------------------|
| id       | string | Yes      | Unique identifier for the entry       |
| text     | string | Yes      | Text to store; VecFS embeds it        |
| metadata | object | No       | Arbitrary key-value metadata tags     |

## Response

A confirmation message: `Stored entry: <id>`.

# feedback

Record reinforcement feedback for a specific memory entry. The score adjustment is added to the entry's current score.

## Parameters

| Name            | Type   | Required | Description                        |
|-----------------|--------|----------|------------------------------------|
| id              | string | Yes      | The entry to adjust                |
| scoreAdjustment | number | Yes      | Value to add to the current score  |

## Response

A confirmation message, or `Entry not found: <id>` if the ID does not exist.

## Score Guidance

| Signal              | Recommended Adjustment |
|---------------------|------------------------|
| Explicit praise     | +1                     |
| Implicit success    | +0.5                   |
| Correction needed   | -1                     |
| Completely wrong    | -2                     |

# delete

Remove an entry from the vector space by its unique ID.

## Parameters

| Name | Type   | Required | Description                            |
|------|--------|----------|----------------------------------------|
| id   | string | Yes      | The unique identifier of the entry     |

## Response

A confirmation message, or `Entry not found: <id>` if the ID does not exist.
