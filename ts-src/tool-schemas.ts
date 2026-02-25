/**
 * MCP tool schema definitions for the VecFS server.
 * Text-only API: search and memorize accept only text; vectorisation happens inside VecFS.
 */

/**
 * The complete list of tools exposed by the VecFS MCP server.
 * Each entry follows the MCP tool definition format.
 */
export const toolDefinitions = [
  {
    name: "search",
    description:
      "Semantic search: find entries with similar meaning to the query text. Vectorisation happens inside VecFS. Returns id, metadata, score, timestamp, similarity (no vectors in response).",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search by text (semantic).",
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return.",
          default: 5,
        },
      },
      required: ["query"],
    },
  },
  {
    name: "memorize",
    description:
      "Store a lesson, fact, or decision in memory by text. Vectorisation happens inside VecFS. Updates the entry if the ID already exists.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        text: {
          type: "string",
          description: "Text to store; VecFS embeds it.",
        },
        metadata: { type: "object" },
      },
      required: ["id", "text"],
    },
  },
  {
    name: "feedback",
    description: "Record feedback for a specific memory entry.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        scoreAdjustment: { type: "number" },
      },
      required: ["id", "scoreAdjustment"],
    },
  },
  {
    name: "delete",
    description: "Delete an entry from the vector space by its unique ID.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The unique identifier of the entry to delete.",
        },
      },
      required: ["id"],
    },
  },
];
