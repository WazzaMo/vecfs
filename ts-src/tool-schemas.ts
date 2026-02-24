/**
 * MCP tool schema definitions for the VecFS server.
 *
 * Centralises all tool definitions so the vector schema is declared once
 * and reused across tools that accept vectors.
 */

const vectorSchema = {
  oneOf: [
    {
      type: "object",
      description: "Sparse vector (key=dimension index, value=weight).",
      additionalProperties: { type: "number" },
    },
    {
      type: "array",
      description: "Dense vector array.",
      items: { type: "number" },
    },
  ],
};

/**
 * The complete list of tools exposed by the VecFS MCP server.
 * Each entry follows the MCP tool definition format.
 */
export const toolDefinitions = [
  {
    name: "search",
    description:
      "Search memory by natural-language query. Prefer sending query (text); VecFS embeds it. Returns text-only results: id, metadata (including stored text), score, timestamp, similarity. No vectors in the response.",
    inputSchema: {
      type: "object",
      properties: {
        vector: vectorSchema,
        query: {
          type: "string",
          description: "Natural-language search query. Recommended: let VecFS embed it; do not supply vector unless you computed it with the same model as the store.",
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return.",
          default: 5,
        },
      },
      required: [],
    },
  },
  {
    name: "memorize",
    description:
      "Store a lesson, fact, or decision in memory. Prefer sending id and text; VecFS embeds the text. Updates the entry if the ID already exists.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        text: {
          type: "string",
          description: "Text to store. Recommended: send this and omit vector; VecFS handles embedding.",
        },
        vector: vectorSchema,
        metadata: { type: "object" },
      },
      required: ["id"],
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
