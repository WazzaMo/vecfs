import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, ChildProcess } from "child_process";
import * as fs from "fs/promises";
import * as http from "http";
import * as net from "net";

describe("MCP HTTP Integration Test", () => {
  let serverProcess: ChildProcess;
  const testDataFile = "http-integration-test-data.jsonl";
  const port = 3001;
  const baseUrl = `http://localhost:${port}`;

  async function cleanup() {
    try {
      await fs.unlink(testDataFile);
    } catch {}
  }

  /**
   * Polls the target port until a TCP connection succeeds, replacing the
   * fragile fixed-duration sleep.
   */
  async function waitForPort(
    targetPort: number,
    timeoutMs: number = 5000,
  ): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        await new Promise<void>((resolve, reject) => {
          const socket = net.createConnection({
            port: targetPort,
            host: "localhost",
          });
          socket.once("connect", () => {
            socket.destroy();
            resolve();
          });
          socket.once("error", reject);
        });
        return;
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    throw new Error(`Port ${targetPort} not available within ${timeoutMs}ms`);
  }

  beforeAll(async () => {
    await cleanup();

    serverProcess = spawn("node", ["dist/mcp-server.js", "--http"], {
      stdio: "inherit",
      env: {
        ...process.env,
        VECFS_FILE: testDataFile,
        PORT: port.toString(),
      },
    });

    await waitForPort(port);
  });

  afterAll(async () => {
    if (serverProcess) {
      serverProcess.kill();
    }
    await cleanup();
  });

  it("should connect to SSE endpoint and perform operations", async () => {
    // 1. Setup SSE listener variables
    let messageEndpoint: string | null = null;
    const eventEmitter = new (await import("events")).EventEmitter();
    let sseReq: http.ClientRequest;

    // 2. Start SSE connection
    await new Promise<void>((resolve, reject) => {
      sseReq = http.get(`${baseUrl}/sse`, (res) => {
        expect(res.statusCode).toBe(200);
        expect(res.headers["content-type"]).toBe("text/event-stream");

        res.on("data", (chunk) => {
          const text = chunk.toString();
          const lines = text.split("\n");

          let currentEvent = "message";

          for (const line of lines) {
            if (line.trim() === "") continue;

            if (line.startsWith("event: ")) {
              currentEvent = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              const dataStr = line.slice(6).trim();
              try {
                if (currentEvent === "endpoint") {
                  messageEndpoint = dataStr;
                  eventEmitter.emit("endpoint", messageEndpoint);
                } else if (currentEvent === "message") {
                  const json = JSON.parse(dataStr);
                  eventEmitter.emit("message", json);
                }
              } catch {
                // ignore parse errors
              }
            }
          }
        });
        resolve();
      });

      sseReq.on("error", reject);
    });

    // 3. Wait for 'endpoint' event to get session ID
    if (!messageEndpoint) {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error("Timeout waiting for endpoint event")),
          5000,
        );
        eventEmitter.once("endpoint", () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }

    expect(messageEndpoint).toBeDefined();
    expect(messageEndpoint).toContain("/messages?sessionId=");

    // Helper to send JSON-RPC request via POST
    let postCounter = 0;
    const sendRequest = (method: string, params: any): Promise<any> => {
      return new Promise((resolve, reject) => {
        const id = ++postCounter;
        const payload = JSON.stringify({
          jsonrpc: "2.0",
          id,
          method,
          params,
        });

        const timer = setTimeout(() => {
          eventEmitter.off("message", listener);
          reject(new Error(`HTTP request '${method}' timed out`));
        }, 5000);

        const listener = (msg: any) => {
          if (msg.id === id) {
            clearTimeout(timer);
            eventEmitter.off("message", listener);
            if (msg.error) reject(msg.error);
            else resolve(msg.result);
          }
        };
        eventEmitter.on("message", listener);

        const options = {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload),
          },
        };

        const req = http.request(
          `${baseUrl}${messageEndpoint}`,
          options,
          (res) => {
            res.resume();
            if (res.statusCode !== 200 && res.statusCode !== 202) {
              clearTimeout(timer);
              eventEmitter.off("message", listener);
              reject(new Error(`POST failed: ${res.statusCode}`));
            }
          },
        );

        req.on("error", (err) => {
          clearTimeout(timer);
          eventEmitter.off("message", listener);
          reject(err);
        });

        req.write(payload);
        req.end();
      });
    };

    // 4. Perform Memorize Operation
    const memResult = await sendRequest("tools/call", {
      name: "memorize",
      arguments: {
        id: "http-test-1",
        text: "HTTP integration test",
        metadata: { transport: "http" },
      },
    });
    expect(memResult.content[0].text).toContain("Stored entry: http-test-1");

    // 5. Perform Search Operation
    const searchResult = await sendRequest("tools/call", {
      name: "search",
      arguments: { query: "HTTP integration test", limit: 1 },
    });

    const content = JSON.parse(searchResult.content[0].text);
    expect(content).toHaveLength(1);
    expect(content[0].id).toBe("http-test-1");

    // Cleanup
    sseReq!.destroy();
  });
});
