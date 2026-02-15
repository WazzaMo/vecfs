# Tool Reference

Complete parameter reference for the VecFS MCP server tools.

# search

Search the vector space for entries similar to a query vector.

## Parameters

| Name   | Type             | Required | Description                          |
|--------|------------------|----------|--------------------------------------|
| vector | object or array  | Yes      | Sparse object or dense array         |
| limit  | number           | No       | Maximum results to return (default 5)|

## Vector Format

The `vector` parameter accepts either format:

### Sparse Object

Keys are dimension indices (as strings), values are weights.

```json
{"3": 0.42, "17": -0.31, "128": 0.15}
```

### Dense Array

A flat array of numbers. The server converts it to sparse internally.

```json
[0.0, 0.0, 0.42, 0.0, ...]
```

## Response

A JSON array of matching entries, sorted by cosine similarity (highest first). Each entry includes `id`, `vector`, `metadata`, `score`, and `similarity`.

# memorize

Store a new entry in the vector space. If an entry with the same `id` already exists, it is replaced (upsert semantics).

## Parameters

| Name     | Type            | Required | Description                           |
|----------|-----------------|----------|---------------------------------------|
| id       | string          | Yes      | Unique identifier for the entry       |
| vector   | object or array | Yes      | Sparse object or dense array          |
| text     | string          | No       | Human-readable text of the memory     |
| metadata | object          | No       | Arbitrary key-value metadata tags     |

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
