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
import { toolDefinitions } from "./tool-schemas.js";
import { createToolHandlers } from "./tool-handlers.js";

/**
 * The VecFS MCP Server.
 *
 * Provides vector storage and search capabilities to connected agents
 * via the Model Context Protocol.
 */
const dataFile = process.env.VECFS_FILE || "./vecfs-data.jsonl";
const storage = new VecFSStorage(dataFile);
const handlers = createToolHandlers(storage);

const server = new Server(
  { name: "vecfs-server", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: toolDefinitions,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const handler = handlers[name];
  if (!handler) {
    throw new Error(`Unknown tool: ${name}`);
  }
  return handler(args);
});

/**
 * Main entry point.
 * Initialises storage then connects the server to either stdio or HTTP/SSE.
 */
async function main() {
  await storage.ensureFile();

  const args = process.argv.slice(2);
  const mode = args.includes("--http") ? "http" : "stdio";
  const port = parseInt(process.env.PORT || "3000", 10);

  if (mode === "stdio") {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("VecFS MCP Server running on stdio");
  } else {
    const app = express();
    app.use(cors());

    let transport: SSEServerTransport;

    app.get("/sse", async (_req, res) => {
      transport = new SSEServerTransport("/messages", res);
      await server.connect(transport);
    });

    app.post("/messages", async (req, res) => {
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
