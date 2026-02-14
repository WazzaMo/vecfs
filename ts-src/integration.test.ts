// Integration test logic updated for clarity and robustness
import { spawn, ChildProcess } from "child_process";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";

// Helper interface for JSON-RPC
interface JSONRPCRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params: any;
}

interface JSONRPCResponse {
  jsonrpc: "2.0";
  id: number;
  result?: any;
  error?: any;
}

describe("MCP Integration Test", () => {
  let serverProcess: ChildProcess;
  const testDataFile = "integration-test-data.jsonl";

  // Cleanup function for test data
  async function cleanup() {
    try {
      await fs.unlink(testDataFile);
    } catch {}
  }

  beforeAll(async () => {
    await cleanup();
    
    // Start the server process
    serverProcess = spawn("node", ["dist/mcp-server.js"], {
      stdio: ["pipe", "pipe", "inherit"], // Pipe stdin/stdout, inherit stderr
      env: { ...process.env, VECFS_FILE: testDataFile } // Assuming server supports env var override or we modify it
    });

    // Wait for server to be ready (simple delay or handshake)
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    if (serverProcess) {
      serverProcess.kill();
    }
    await cleanup();
  });

  // Helper to send request and get response
  function sendRequest(method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = Date.now();
      const request: JSONRPCRequest = {
        jsonrpc: "2.0",
        id,
        method,
        params
      };

      const onData = (data: Buffer) => {
        const lines = data.toString().split("\n");
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const response: JSONRPCResponse = JSON.parse(line);
            if (response.id === id) {
              serverProcess.stdout?.off("data", onData);
              if (response.error) reject(response.error);
              else resolve(response.result);
            }
          } catch (e) {
            // Ignore parse errors from partial chunks
          }
        }
      };

      serverProcess.stdout?.on("data", onData);
      serverProcess.stdin?.write(JSON.stringify(request) + "\n");
    });
  }

  // NOTE: This test suite assumes the server speaks standard JSON-RPC 2.0 over Stdio
  // The current MCP SDK might wrap this, so we are testing the `main` loop behavior via stdio.

  it("should list available tools", async () => {
    const result = await sendRequest("tools/list", {});
    expect(result).toBeDefined();
    expect(result.tools).toBeDefined();
    const toolNames = result.tools.map((t: any) => t.name);
    expect(toolNames).toContain("search");
    expect(toolNames).toContain("memorize");
  });

  it("should memorize and then search for a vector", async () => {
    // 1. Memorize
    const memResult = await sendRequest("tools/call", {
      name: "memorize",
      arguments: {
        id: "integration-1",
        text: "integration test entry",
        vector: { "0": 1, "1": 0.5 },
        metadata: { source: "test" }
      }
    });
    expect(memResult.content[0].text).toContain("Stored entry: integration-1");

    // 2. Search
    const searchResult = await sendRequest("tools/call", {
      name: "search",
      arguments: {
        vector: { "0": 1, "1": 0.5 },
        limit: 1
      }
    });
    
    const content = JSON.parse(searchResult.content[0].text);
    expect(content).toHaveLength(1);
    expect(content[0].id).toBe("integration-1");
    expect(content[0].similarity).toBeCloseTo(1);
  });
});
