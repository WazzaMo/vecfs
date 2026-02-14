import { spawn, ChildProcess } from "child_process";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";

// Helper function for text-to-vector mock
function mockEmbed(text: string): Record<string, number> {
  const vector: Record<string, number> = {};
  // Normalize and split into words
  const words = text.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/).filter(w => w.length > 2);
  
  if (words.length === 0) return {};

  for (const word of words) {
    // Simple hash to map words to dimensions 0-99
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = ((hash << 5) - hash) + word.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
    }
    const dim = Math.abs(hash) % 100;
    vector[dim.toString()] = (vector[dim.toString()] || 0) + 1;
  }
  
  // L2 Normalize
  let sumSq = 0;
  for (const k in vector) {
    sumSq += vector[k] * vector[k];
  }
  const norm = Math.sqrt(sumSq);
  
  if (norm > 0) {
    for (const k in vector) {
      vector[k] /= norm;
    }
  }
  
  return vector;
}

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

  it("should index and retrieve real documentation", async () => {
    // 1. Read all markdown files from docs/
    const docsDir = path.join(process.cwd(), "docs");
    const files = await fs.readdir(docsDir);
    const mdFiles = files.filter(f => f.endsWith(".md"));
    
    for (const file of mdFiles) {
      const content = await fs.readFile(path.join(docsDir, file), "utf-8");
      // Split by double newline to simulate paragraphs/chunks
      const chunks = content.split("\n\n").filter(c => c.trim().length > 20);
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        // Use the global mockEmbed function
        const vector = mockEmbed(chunk);
        
        // Skip empty vectors
        if (Object.keys(vector).length === 0) continue;

        await sendRequest("tools/call", {
          name: "memorize",
          arguments: {
            id: `${file}-chunk-${i}`,
            text: chunk,
            vector: vector,
            metadata: { source: file }
          }
        });
      }
    }
    
    // 2. Search for "sparse vector"
    const queryText = "sparse vector storage efficiency";
    const queryVector = mockEmbed(queryText);
    
    const searchResult = await sendRequest("tools/call", {
      name: "search",
      arguments: {
        vector: queryVector,
        limit: 3
      }
    });
    
    const content = JSON.parse(searchResult.content[0].text);
    //console.log("Top results for 'sparse vector storage efficiency':");
    //content.forEach((r: any) => console.log(`- [${r.similarity.toFixed(4)}] ${r.metadata.source}: ${r.metadata.text.substring(0, 50)}...`));
    
    expect(content.length).toBeGreaterThan(0);
    // Should find something from requirements.md or goals.md or similar
    // The mock embedding is simple, but "sparse" and "vector" appear heavily in requirements.md
    const sources = content.map((r: any) => r.metadata.source);
    const relevantDocs = sources.some((s: string) => s.includes("requirements") || s.includes("goals") || s.includes("README") || s.includes("skills"));
    // Note: Due to mock embedding simplicity (hashing), there might be collisions, but it should generally find relevant docs
    expect(relevantDocs).toBe(true);
  });

  it("should accept dense vector arrays", async () => {
    // 1. Memorize with dense array (using high index to avoid collision)
    await sendRequest("tools/call", {
      name: "memorize",
      arguments: {
        id: "dense-test-unique",
        text: "Dense vector test",
        // [0, 0, 0, 0, 1] -> Sparse: {4:1}
        vector: [0, 0, 0, 0, 1], 
        metadata: { type: "dense" }
      }
    });

    // 2. Search with dense array
    const searchResult = await sendRequest("tools/call", {
      name: "search",
      arguments: {
        // [0, 0, 0, 0, 1]
        vector: [0, 0, 0, 0, 1],
        limit: 1
      }
    });

    const content = JSON.parse(searchResult.content[0].text);
    expect(content).toHaveLength(1);
    expect(content[0].id).toBe("dense-test-unique");
    expect(content[0].similarity).toBeCloseTo(1);
  });

  it("should handle random dense arrays", async () => {
    // Generate a random vector
    const length = 50;
    const denseVector: number[] = [];
    for (let i = 0; i < length; i++) {
        denseVector.push(Math.random());
    }
    
    // Store it
    const id = "random-dense-1";
    await sendRequest("tools/call", {
      name: "memorize",
      arguments: {
        id: id,
        text: "Random dense vector test",
        vector: denseVector,
        metadata: { type: "random-dense" }
      }
    });

    // Search for it using the exact same dense vector
    const searchResult = await sendRequest("tools/call", {
      name: "search",
      arguments: {
        vector: denseVector,
        limit: 1
      }
    });

    const content = JSON.parse(searchResult.content[0].text);
    expect(content).toHaveLength(1);
    expect(content[0].id).toBe(id);
    expect(content[0].similarity).toBeCloseTo(1);
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
