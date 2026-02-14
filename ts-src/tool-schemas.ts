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
    description: "Search the vector space using a sparse or dense vector.",
    inputSchema: {
      type: "object",
      properties: {
        vector: vectorSchema,
        limit: {
          type: "number",
          description: "Maximum number of results to return.",
          default: 5,
        },
      },
      required: ["vector"],
    },
  },
  {
    name: "memorize",
    description:
      "Store a new entry in the vector space. Updates the entry if the ID already exists.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        text: { type: "string" },
        vector: vectorSchema,
        metadata: { type: "object" },
      },
      required: ["id", "vector"],
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
