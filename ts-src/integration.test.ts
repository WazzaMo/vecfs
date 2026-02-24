import { spawn, ChildProcess } from "child_process";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import { tmpdir } from "os";

// ---------------------------------------------------------------------------
// Mock embedding helper
// ---------------------------------------------------------------------------

function mockEmbed(text: string): Record<string, number> {
  const vector: Record<string, number> = {};
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2);

  if (words.length === 0) return {};

  for (const word of words) {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = (hash << 5) - hash + word.charCodeAt(i);
      hash |= 0;
    }
    const dim = Math.abs(hash) % 100;
    vector[dim.toString()] = (vector[dim.toString()] || 0) + 1;
  }

  let sumSq = 0;
  for (const k in vector) {
    sumSq += vector[k] * vector[k];
  }
  const n = Math.sqrt(sumSq);

  if (n > 0) {
    for (const k in vector) {
      vector[k] /= n;
    }
  }

  return vector;
}

// ---------------------------------------------------------------------------
// JSON-RPC types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("MCP Integration Test", () => {
  let serverProcess: ChildProcess;
  const testDataFile = "integration-test-data.jsonl";
  let requestCounter = 0;

  async function cleanup() {
    try {
      await fs.unlink(testDataFile);
    } catch {}
  }

  function startServer() {
    serverProcess = spawn("node", ["dist/mcp-server.js"], {
      stdio: ["pipe", "pipe", "inherit"],
      env: { ...process.env, VECFS_FILE: testDataFile },
    });
  }

  function stopServer() {
    if (serverProcess) {
      serverProcess.kill();
    }
  }

  /**
   * Sends a JSON-RPC request over stdin and waits for the matching response
   * on stdout, with a configurable timeout.
   */
  function sendRequest(
    method: string,
    params: any,
    timeoutMs: number = 5000,
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = ++requestCounter;
      const request: JSONRPCRequest = {
        jsonrpc: "2.0",
        id,
        method,
        params,
      };

      const timer = setTimeout(() => {
        serverProcess.stdout?.off("data", onData);
        reject(
          new Error(
            `Request '${method}' (id=${id}) timed out after ${timeoutMs}ms`,
          ),
        );
      }, timeoutMs);

      const onData = (data: Buffer) => {
        const lines = data.toString().split("\n");
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const response: JSONRPCResponse = JSON.parse(line);
            if (response.id === id) {
              clearTimeout(timer);
              serverProcess.stdout?.off("data", onData);
              if (response.error) reject(response.error);
              else resolve(response.result);
            }
          } catch {
            // Ignore non-JSON lines
          }
        }
      };

      serverProcess.stdout?.on("data", onData);
      serverProcess.stdin?.write(JSON.stringify(request) + "\n");
    });
  }

  /**
   * Polls the server with tools/list until it responds, replacing the
   * fragile fixed-duration sleep.
   */
  async function waitForReady() {
    for (let i = 0; i < 30; i++) {
      try {
        await sendRequest("tools/list", {}, 1000);
        return;
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    throw new Error("Server failed to start within timeout");
  }

  beforeAll(async () => {
    await cleanup();
    startServer();
    await waitForReady();
  });

  afterAll(async () => {
    stopServer();
    await cleanup();
  });

  // -----------------------------------------------------------------------
  // Tool listing
  // -----------------------------------------------------------------------

  it("should list available tools", async () => {
    const result = await sendRequest("tools/list", {});
    expect(result).toBeDefined();
    expect(result.tools).toBeDefined();
    const toolNames = result.tools.map((t: any) => t.name);
    expect(toolNames).toContain("search");
    expect(toolNames).toContain("memorize");
    expect(toolNames).toContain("feedback");
    expect(toolNames).toContain("delete");
  });

  // -----------------------------------------------------------------------
  // Basic memorize / search
  // -----------------------------------------------------------------------

  it("should memorize and then search for a vector", async () => {
    const memResult = await sendRequest("tools/call", {
      name: "memorize",
      arguments: {
        id: "integration-1",
        text: "integration test entry",
        vector: { "0": 1, "1": 0.5 },
        metadata: { source: "test" },
      },
    });
    expect(memResult.content[0].text).toContain("Stored entry: integration-1");

    const searchResult = await sendRequest("tools/call", {
      name: "search",
      arguments: {
        vector: { "0": 1, "1": 0.5 },
        limit: 1,
      },
    });

    const content = JSON.parse(searchResult.content[0].text);
    expect(content).toHaveLength(1);
    expect(content[0].id).toBe("integration-1");
    expect(content[0].similarity).toBeCloseTo(1);
  });

  // -----------------------------------------------------------------------
  // Context relevance among noise
  // -----------------------------------------------------------------------

  it("should retrieve relevant context among noise", async () => {
    await sendRequest("tools/call", {
      name: "memorize",
      arguments: {
        id: "topic-a",
        text: "This is topic A",
        vector: { "10": 1, "11": 1 },
        metadata: { tag: "A" },
      },
    });

    await sendRequest("tools/call", {
      name: "memorize",
      arguments: {
        id: "topic-b",
        text: "This is topic B",
        vector: { "20": 1, "21": 1 },
        metadata: { tag: "B" },
      },
    });

    const searchResult = await sendRequest("tools/call", {
      name: "search",
      arguments: {
        vector: { "10": 1, "11": 0.5 },
        limit: 5,
      },
    });

    const content = JSON.parse(searchResult.content[0].text);
    expect(content.length).toBeGreaterThan(0);
    expect(content[0].id).toBe("topic-a");

    const topicB = content.find((r: any) => r.id === "topic-b");
    if (topicB) {
      expect(topicB.similarity).toBe(0);
    }
  });

  // -----------------------------------------------------------------------
  // Feedback
  // -----------------------------------------------------------------------

  it("should improve context ranking with feedback", async () => {
    const entryId = "feedback-test-1";
    await sendRequest("tools/call", {
      name: "memorize",
      arguments: {
        id: entryId,
        text: "Feedback test entry",
        vector: { "30": 1 },
        metadata: { tag: "feedback" },
      },
    });

    let searchResult = await sendRequest("tools/call", {
      name: "search",
      arguments: { vector: { "30": 1 }, limit: 1 },
    });
    let content = JSON.parse(searchResult.content[0].text);
    const initialScore = content[0].score;

    await sendRequest("tools/call", {
      name: "feedback",
      arguments: { id: entryId, scoreAdjustment: 5 },
    });

    searchResult = await sendRequest("tools/call", {
      name: "search",
      arguments: { vector: { "30": 1 }, limit: 1 },
    });
    content = JSON.parse(searchResult.content[0].text);
    expect(content[0].score).toBe(initialScore + 5);
  });

  it("should report not-found for feedback on nonexistent entry", async () => {
    const result = await sendRequest("tools/call", {
      name: "feedback",
      arguments: { id: "nonexistent-feedback-id", scoreAdjustment: 5 },
    });
    expect(result.content[0].text).toContain("Entry not found");
  });

  // -----------------------------------------------------------------------
  // Delete
  // -----------------------------------------------------------------------

  it("should delete an entry", async () => {
    const entryId = "delete-test-1";
    await sendRequest("tools/call", {
      name: "memorize",
      arguments: {
        id: entryId,
        text: "Entry to delete",
        vector: { "50": 1 },
        metadata: {},
      },
    });

    let searchResult = await sendRequest("tools/call", {
      name: "search",
      arguments: { vector: { "50": 1 }, limit: 1 },
    });
    let content = JSON.parse(searchResult.content[0].text);
    expect(content[0].id).toBe(entryId);

    const deleteResult = await sendRequest("tools/call", {
      name: "delete",
      arguments: { id: entryId },
    });
    expect(deleteResult.content[0].text).toContain("Deleted entry");

    searchResult = await sendRequest("tools/call", {
      name: "search",
      arguments: { vector: { "50": 1 }, limit: 10 },
    });
    content = JSON.parse(searchResult.content[0].text);
    expect(content.find((r: any) => r.id === entryId)).toBeUndefined();
  });

  it("should report not-found for delete on nonexistent entry", async () => {
    const result = await sendRequest("tools/call", {
      name: "delete",
      arguments: { id: "nonexistent-delete-id" },
    });
    expect(result.content[0].text).toContain("Entry not found");
  });

  // -----------------------------------------------------------------------
  // Persistence across restart
  // -----------------------------------------------------------------------

  it("should persist data across server restarts", async () => {
    const persistId = "persist-1";
    await sendRequest("tools/call", {
      name: "memorize",
      arguments: {
        id: persistId,
        text: "Persistence test",
        vector: { "40": 1 },
        metadata: {},
      },
    });

    stopServer();
    startServer();
    await waitForReady();

    const searchResult = await sendRequest("tools/call", {
      name: "search",
      arguments: { vector: { "40": 1 }, limit: 1 },
    });
    const content = JSON.parse(searchResult.content[0].text);
    expect(content).toHaveLength(1);
    expect(content[0].id).toBe(persistId);
  });

  // -----------------------------------------------------------------------
  // Real documentation indexing
  // -----------------------------------------------------------------------

  it("should index and retrieve real documentation", async () => {
    const docsDir = path.join(process.cwd(), "docs");
    const files = await fs.readdir(docsDir);
    const mdFiles = files.filter((f) => f.endsWith(".md"));

    for (const file of mdFiles) {
      const fileContent = await fs.readFile(
        path.join(docsDir, file),
        "utf-8",
      );
      const chunks = fileContent
        .split("\n\n")
        .filter((c) => c.trim().length > 20);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const vector = mockEmbed(chunk);
        if (Object.keys(vector).length === 0) continue;

        await sendRequest("tools/call", {
          name: "memorize",
          arguments: {
            id: `${file}-chunk-${i}`,
            text: chunk,
            vector,
            metadata: { source: file },
          },
        });
      }
    }

    const queryVector = mockEmbed("sparse vector storage efficiency");

    const searchResult = await sendRequest("tools/call", {
      name: "search",
      arguments: { vector: queryVector, limit: 3 },
    });

    const content = JSON.parse(searchResult.content[0].text);
    expect(content.length).toBeGreaterThan(0);
    const sources = content.map((r: any) => r.metadata.source);
    const relevantDocs = sources.some(
      (s: string) =>
        s.includes("requirements") ||
        s.includes("goals") ||
        s.includes("README") ||
        s.includes("skills"),
    );
    expect(relevantDocs).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Dense vector support
  // -----------------------------------------------------------------------

  it("should accept dense vector arrays", async () => {
    await sendRequest("tools/call", {
      name: "memorize",
      arguments: {
        id: "dense-test-unique",
        text: "Dense vector test",
        vector: [0, 0, 0, 0, 1],
        metadata: { type: "dense" },
      },
    });

    const searchResult = await sendRequest("tools/call", {
      name: "search",
      arguments: { vector: [0, 0, 0, 0, 1], limit: 1 },
    });

    const content = JSON.parse(searchResult.content[0].text);
    expect(content).toHaveLength(1);
    expect(content[0].id).toBe("dense-test-unique");
    expect(content[0].similarity).toBeCloseTo(1);
  });

  it("should handle random dense arrays", async () => {
    const length = 50;
    const denseVector: number[] = [];
    for (let i = 0; i < length; i++) {
      denseVector.push(Math.random());
    }

    const id = "random-dense-1";
    await sendRequest("tools/call", {
      name: "memorize",
      arguments: {
        id,
        text: "Random dense vector test",
        vector: denseVector,
        metadata: { type: "random-dense" },
      },
    });

    const searchResult = await sendRequest("tools/call", {
      name: "search",
      arguments: { vector: denseVector, limit: 1 },
    });

    const content = JSON.parse(searchResult.content[0].text);
    expect(content).toHaveLength(1);
    expect(content[0].id).toBe(id);
    expect(content[0].similarity).toBeCloseTo(1);
  });

  // -----------------------------------------------------------------------
  // Vector as JSON string (MCP client compatibility)
  // -----------------------------------------------------------------------

  it("should accept vector as JSON string in search and memorize", async () => {
    const id = "string-vector-test";
    const uniqueVector = { "99994": 1, "99995": 0.5 };
    await sendRequest("tools/call", {
      name: "memorize",
      arguments: {
        id,
        text: "Stored with string vector",
        vector: JSON.stringify(uniqueVector),
        metadata: {},
      },
    });

    const searchResult = await sendRequest("tools/call", {
      name: "search",
      arguments: {
        vector: JSON.stringify(uniqueVector),
        limit: 1,
      },
    });

    const content = JSON.parse(searchResult.content[0].text);
    expect(content).toHaveLength(1);
    expect(content[0].id).toBe(id);
  });

  // -----------------------------------------------------------------------
  // Stress test
  // -----------------------------------------------------------------------

  it("should handle larger datasets (stress test)", async () => {
    const entryCount = 100;
    for (let i = 0; i < entryCount; i++) {
      await sendRequest("tools/call", {
        name: "memorize",
        arguments: {
          id: `stress-${i}`,
          text: `Stress test entry ${i}`,
          vector: { [i % 100]: 1 },
          metadata: { index: i },
        },
      });
    }

    const stats = await fs.stat(testDataFile);
    console.log(
      `File size after ${entryCount} entries: ${stats.size} bytes`,
    );
    expect(stats.size).toBeGreaterThan(0);
    expect(stats.size).toBeLessThan(10 * 1024 * 1024);

    const searchResult = await sendRequest("tools/call", {
      name: "search",
      arguments: { vector: { "0": 1 }, limit: 5 },
    });
    const content = JSON.parse(searchResult.content[0].text);
    expect(content.length).toBeGreaterThan(0);
  });

  // -----------------------------------------------------------------------
  // Configuration file (vecfs.yaml)
  // -----------------------------------------------------------------------

  it(
    "should use storage file from vecfs.yaml when no env set",
    { timeout: 15000 },
    async () => {
    const configDir = path.join(
      tmpdir(),
      "vecfs-config-test-" + Date.now() + "-" + Math.random().toString(36).slice(2),
    );
    await fs.mkdir(configDir, { recursive: true });
    const configFilePath = path.join(configDir, "vecfs.yaml");
    const configDataFile = "config-file-storage.jsonl";
    await fs.writeFile(
      configFilePath,
      [
        "storage:",
        "  file: " + configDataFile,
        "mcp:",
        "  port: 3000",
      ].join("\n"),
    );

    const serverPath = path.join(process.cwd(), "dist", "mcp-server.js");
    function startConfigServer() {
      return spawn("node", [serverPath, "--config", configFilePath], {
        stdio: ["pipe", "pipe", "pipe"],
        cwd: configDir,
        env: { ...process.env },
      });
    }
    let reqId = 0;
    function send(proc: ChildProcess, method: string, params: any): Promise<any> {
      return new Promise((resolve, reject) => {
        const id = ++reqId;
        const req = { jsonrpc: "2.0", id, method, params };
        const timer = setTimeout(() => {
          proc.stdout?.off("data", onData);
          reject(new Error("Config server request timeout"));
        }, 5000);
        const onData = (data: Buffer) => {
          const lines = data.toString().split("\n");
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const res = JSON.parse(line);
              if (res.id === id) {
                clearTimeout(timer);
                proc.stdout?.off("data", onData);
                if (res.error) reject(res.error);
                else resolve(res.result);
                return;
              }
            } catch {}
          }
        };
        proc.stdout?.on("data", onData);
        proc.stdin?.write(JSON.stringify(req) + "\n");
      });
    }
    async function waitReady(proc: ChildProcess) {
      for (let i = 0; i < 30; i++) {
        try {
          await send(proc, "tools/list", {});
          return;
        } catch {
          await new Promise((r) => setTimeout(r, 100));
        }
      }
      throw new Error("Config server did not become ready");
    }

    const uniqueId = "config-file-test-" + Date.now();
    const testVector = { "77": 1, "78": 0.5 };

    let configServer = startConfigServer();
    await waitReady(configServer);
    await send(configServer, "tools/call", {
      name: "memorize",
      arguments: {
        id: uniqueId,
        text: "Stored via config file",
        vector: testVector,
        metadata: {},
      },
    });
    configServer.kill();

    configServer = startConfigServer();
    await waitReady(configServer);
    const searchResult = await send(configServer, "tools/call", {
      name: "search",
      arguments: { vector: testVector, limit: 1 },
    });
    configServer.kill();

    const content = JSON.parse(searchResult.content[0].text);
    expect(content).toHaveLength(1);
    expect(content[0].id).toBe(uniqueId);

    try {
      await fs.rm(configDir, { recursive: true, force: true });
    } catch {}
  });

  it(
    "should let VECFS_FILE override storage file from vecfs.yaml",
    { timeout: 15000 },
    async () => {
    const configDir = path.join(
      tmpdir(),
      "vecfs-env-override-" + Date.now() + "-" + Math.random().toString(36).slice(2),
    );
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(
      path.join(configDir, "vecfs.yaml"),
      ["storage:", "  file: from-yaml.jsonl", "mcp:", "  port: 3000"].join("\n"),
    );
    const envOverrideFile = path.join(configDir, "env-override.jsonl");

    const serverPath = path.join(process.cwd(), "dist", "mcp-server.js");
    const configServer = spawn("node", [serverPath], {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: configDir,
      env: { ...process.env, VECFS_FILE: envOverrideFile },
    });
    let reqId = 0;
    const send = (method: string, params: any): Promise<any> => {
      return new Promise((resolve, reject) => {
        const id = ++reqId;
        const req = { jsonrpc: "2.0", id, method, params };
        const timer = setTimeout(() => {
          configServer.stdout?.off("data", onData);
          reject(new Error("Config server request timeout"));
        }, 5000);
        const onData = (data: Buffer) => {
          const lines = data.toString().split("\n");
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const res = JSON.parse(line);
              if (res.id === id) {
                clearTimeout(timer);
                configServer.stdout?.off("data", onData);
                if (res.error) reject(res.error);
                else resolve(res.result);
                return;
              }
            } catch {}
          }
        };
        configServer.stdout?.on("data", onData);
        configServer.stdin?.write(JSON.stringify(req) + "\n");
      });
    };

    for (let i = 0; i < 30; i++) {
      try {
        await send("tools/list", {});
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
      if (i === 29) {
        configServer.kill();
        throw new Error("Config server did not become ready");
      }
    }

    const uniqueId = "env-override-test-" + Date.now();
    await send("tools/call", {
      name: "memorize",
      arguments: {
        id: uniqueId,
        text: "Stored via env override",
        vector: { "1": 1 },
        metadata: {},
      },
    });

    await expect(fs.access(envOverrideFile)).resolves.toBeUndefined();
    const content = await fs.readFile(envOverrideFile, "utf-8");
    expect(content).toContain(uniqueId);

    const yamlDataFile = path.join(configDir, "from-yaml.jsonl");
    try {
      await fs.access(yamlDataFile);
      const yamlContent = await fs.readFile(yamlDataFile, "utf-8");
      expect(yamlContent).not.toContain(uniqueId);
    } catch {
      // from-yaml.jsonl may not exist; that's fine
    }

    configServer.kill();
    try {
      await fs.rm(configDir, { recursive: true, force: true });
    } catch {}
  });
});
