import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import express from "express";
import cors from "cors";
import { loadConfig } from "./config.js";
import { VecFSStorage } from "./storage.js";
import { toolDefinitions } from "./tool-schemas.js";
import { createToolHandlers } from "./tool-handlers.js";

/**
 * Main entry point.
 * Loads config (vecfs.yaml or env), initialises storage, then connects the server
 * to either stdio or HTTP/SSE.
 */
async function main() {
  const config = await loadConfig(process.argv);
  const storage = new VecFSStorage(config.storage.file);
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

  await storage.ensureFile();

  const args = process.argv.slice(2);
  const mode = args.includes("--http") ? "http" : "stdio";
  const port = config.mcp.port;

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
