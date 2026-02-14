import { spawn, ChildProcess } from "child_process";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";

// Define message types for MCP protocol
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

  async function cleanup() {
    try {
      await fs.unlink(testDataFile);
    } catch {}
  }

  async function startServer() {
    serverProcess = spawn("node", ["dist/mcp-server.js"], {
      stdio: ["pipe", "pipe", "inherit"], 
      env: { ...process.env, VECFS_FILE: testDataFile } 
    });
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  function stopServer() {
    if (serverProcess) {
      serverProcess.kill();
    }
  }

  beforeAll(async () => {
    await cleanup();
    await startServer();
  });

  afterAll(async () => {
    stopServer();
    await cleanup();
  });

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
            // Ignore parse errors
          }
        }
      };

      serverProcess.stdout?.on("data", onData);
      serverProcess.stdin?.write(JSON.stringify(request) + "\n");
    });
  }

  it("should list available tools", async () => {
    const result = await sendRequest("tools/list", {});
    expect(result).toBeDefined();
    expect(result.tools).toBeDefined();
    const toolNames = result.tools.map((t: any) => t.name);
    expect(toolNames).toContain("search");
    expect(toolNames).toContain("memorize");
  });

  it("should memorize and then search for a vector", async () => {
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

  it("should retrieve relevant context among noise", async () => {
    // 1. Store Topic A
    await sendRequest("tools/call", {
      name: "memorize",
      arguments: {
        id: "topic-a",
        text: "This is topic A",
        vector: { "10": 1, "11": 1 },
        metadata: { tag: "A" }
      }
    });

    // 2. Store Topic B (Noise)
    await sendRequest("tools/call", {
      name: "memorize",
      arguments: {
        id: "topic-b",
        text: "This is topic B",
        vector: { "20": 1, "21": 1 },
        metadata: { tag: "B" }
      }
    });

    // 3. Search for Topic A
    const searchResult = await sendRequest("tools/call", {
      name: "search",
      arguments: {
        vector: { "10": 1, "11": 0.5 }, // Close to A
        limit: 5
      }
    });

    const content = JSON.parse(searchResult.content[0].text);
    // Should find topic-a
    expect(content.length).toBeGreaterThan(0);
    expect(content[0].id).toBe("topic-a");
    
    // Should not find topic-b or it should be very low similarity
    const topicB = content.find((r: any) => r.id === "topic-b");
    if (topicB) {
        expect(topicB.similarity).toBe(0);
    }
  });

  it("should improve context ranking with feedback", async () => {
    // 1. Store an entry
    const entryId = "feedback-test-1";
    await sendRequest("tools/call", {
      name: "memorize",
      arguments: {
        id: entryId,
        text: "Feedback test entry",
        vector: { "30": 1 },
        metadata: { tag: "feedback" }
      }
    });

    // 2. Search and get initial score
    let searchResult = await sendRequest("tools/call", {
      name: "search",
      arguments: {
        vector: { "30": 1 },
        limit: 1
      }
    });
    let content = JSON.parse(searchResult.content[0].text);
    const initialScore = content[0].score;

    // 3. Apply positive feedback
    await sendRequest("tools/call", {
      name: "feedback",
      arguments: {
        id: entryId,
        scoreAdjustment: 5
      }
    });

    // 4. Search again and verify score increase
    searchResult = await sendRequest("tools/call", {
      name: "search",
      arguments: {
        vector: { "30": 1 },
        limit: 1
      }
    });
    content = JSON.parse(searchResult.content[0].text);
    expect(content[0].score).toBe(initialScore + 5);
  });

  it("should persist data across server restarts", async () => {
     const persistId = "persist-1";
     await sendRequest("tools/call", {
        name: "memorize",
        arguments: {
           id: persistId,
           text: "Persistence test",
           vector: { "40": 1 },
           metadata: {}
        }
     });
     
     stopServer();
     await startServer();
     
     const searchResult = await sendRequest("tools/call", {
        name: "search",
        arguments: {
           vector: { "40": 1 },
           limit: 1
        }
     });
     const content = JSON.parse(searchResult.content[0].text);
     expect(content).toHaveLength(1);
     expect(content[0].id).toBe(persistId);
  });

  it("should handle larger datasets (stress test)", async () => {
    const entryCount = 100;
    for (let i = 0; i < entryCount; i++) {
        await sendRequest("tools/call", {
            name: "memorize",
            arguments: {
                id: `stress-${i}`,
                text: `Stress test entry ${i}`,
                vector: { [i % 100]: 1 },
                metadata: { index: i }
            }
        });
    }
    
    const stats = await fs.stat(testDataFile);
    console.log(`File size after ${entryCount} entries: ${stats.size} bytes`);
    expect(stats.size).toBeGreaterThan(0);
    // Safety check for user
    expect(stats.size).toBeLessThan(10 * 1024 * 1024); // 10MB limit check

    const searchResult = await sendRequest("tools/call", {
        name: "search",
        arguments: { vector: { "0": 1 }, limit: 5 }
    });
    const content = JSON.parse(searchResult.content[0].text);
    expect(content.length).toBeGreaterThan(0);
  });
});
