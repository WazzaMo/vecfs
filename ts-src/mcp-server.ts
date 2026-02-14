import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import express from "express";
import cors from "cors";
import { VecFSStorage } from "./storage.js";
import { toSparse } from "./sparse-vector.js";

/**
 * Helper to ensure a vector is in sparse format.
 * Accepts either a sparse object or a dense array.
 */
function normalizeVector(input: any): Record<number, number> {
  if (Array.isArray(input)) {
    return toSparse(input);
  }
  return input;
}

/**
 * The VecFS MCP Server.
 * 
 * This server implements the Model Context Protocol (MCP) to provide vector storage and search capabilities
 * to connected agents. It exposes the following tools:
 * - `search`: Query the vector database.
 * - `memorize`: Store new context.
 * - `feedback`: Reinforce existing memories.
 */
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

/**
 * Handles the "tools/list" request.
 * Returns the schema definitions for all available tools.
 * 
 * @returns An object containing the tool definitions.
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "search",
        description: "Search the vector space using a sparse or dense vector.",
        inputSchema: {
          type: "object",
          properties: {
            vector: {
              oneOf: [
                {
                  type: "object",
                  description: "Sparse vector (key=index, value=weight).",
                  additionalProperties: { type: "number" },
                },
                {
                  type: "array",
                  description: "Dense vector array.",
                  items: { type: "number" },
                },
              ],
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
              oneOf: [
                {
                  type: "object",
                  description: "Sparse vector (key=index, value=weight).",
                  additionalProperties: { type: "number" },
                },
                {
                  type: "array",
                  description: "Dense vector array.",
                  items: { type: "number" },
                },
              ],
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

/**
 * Handles the "tools/call" request.
 * Executes the requested tool logic.
 * 
 * @param request - The tool execution request containing the tool name and arguments.
 * @returns The result of the tool execution.
 * @throws {Error} If the tool name is unknown or if the underlying storage operation fails.
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  await storage.ensureFile();

  if (name === "search") {
    const { vector, limit } = (args as any) || {};
    const sparseVector = normalizeVector(vector);
    const results = await storage.search(sparseVector, limit);
    return {
      content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
    };
  }

  if (name === "memorize") {
    const { id, text, vector, metadata } = (args as any) || {};
    const sparseVector = normalizeVector(vector);
    await storage.store({
      id,
      vector: sparseVector,
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

/**
 * Main entry point for the MCP server.
 * Connects the server to the stdio or SSE/HTTP transport.
 */
async function main() {
  const args = process.argv.slice(2);
  const mode = args.includes("--http") ? "http" : "stdio";
  const port = parseInt(process.env.PORT || "3000", 10);

  if (mode === "stdio") {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("VecFS MCP Server running on stdio");
  } else {
    const app = express();
    // Do not use express.json() as SDK handles stream reading
    // app.use(express.json());
    app.use(cors());

    let transport: SSEServerTransport;

    app.get("/sse", async (req, res) => {
      transport = new SSEServerTransport("/messages", res);
      await server.connect(transport);
    });

    app.post("/messages", async (req, res) => {
      // Note: This simple implementation only supports one active client at a time for SSE.
      // For production multi-client support, you would need to manage a map of transports by session ID.
      if (!transport) {
         res.status(500).send("SSE connection not established");
         return;
      }
      await transport.handlePostMessage(req, res);
    });

    app.listen(port, () => {
      console.log(`VecFS MCP Server running on HTTP port ${port}`);
      console.log(`SSE endpoint: http://localhost:${port}/sse`);
    });
  }
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
