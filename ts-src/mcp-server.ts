import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { VecFSStorage } from "./storage.js";

const dataFile = process.env.VECFS_FILE || "./vecfs-data.jsonl";
const storage = new VecFSStorage(dataFile);

const server = new Server(
  {
    name: "vecfs-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "search",
        description: "Search the vector space using a sparse vector.",
        inputSchema: {
          type: "object",
          properties: {
            vector: {
              type: "object",
              description: "The sparse vector to search for.",
              additionalProperties: { type: "number" },
            },
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
        description: "Store a new entry in the vector space.",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string" },
            text: { type: "string" },
            vector: {
              type: "object",
              description: "The sparse vector representation of the text.",
              additionalProperties: { type: "number" },
            },
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
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  await storage.ensureFile();

  if (name === "search") {
    const { vector, limit } = (args as any) || {};
    const results = await storage.search(vector, limit);
    return {
      content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
    };
  }

  if (name === "memorize") {
    const { id, text, vector, metadata } = (args as any) || {};
    await storage.store({
      id,
      vector,
      metadata: { ...metadata, text },
      score: 0,
    });
    return {
      content: [{ type: "text", text: `Stored entry: ${id}` }],
    };
  }

  if (name === "feedback") {
    const { id, scoreAdjustment } = (args as any) || {};
    await storage.updateScore(id, scoreAdjustment);
    return {
      content: [{ type: "text", text: `Updated score for entry: ${id}` }],
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("VecFS MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
