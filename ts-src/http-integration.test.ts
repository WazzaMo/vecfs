import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, ChildProcess } from "child_process";
import * as fs from "fs/promises";
import * as http from "http";

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

  beforeAll(async () => {
    await cleanup();
    
    // Start server in HTTP mode
    serverProcess = spawn("node", ["dist/mcp-server.js", "--http"], {
      // Pipe stdout/stderr to inherit for debugging
      stdio: "inherit",
      env: { ...process.env, VECFS_FILE: testDataFile, PORT: port.toString() }
    });

    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));
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
            expect(res.headers['content-type']).toBe('text/event-stream');

            res.on('data', (chunk) => {
                const text = chunk.toString();
                const lines = text.split('\n');
                
                let currentEvent = "message";

                for (const line of lines) {
                    if (line.trim() === "") continue;
                    
                    if (line.startsWith("event: ")) {
                        currentEvent = line.slice(7).trim();
                    } else if (line.startsWith("data: ")) {
                        const dataStr = line.slice(6).trim();
                        try {
                            if (currentEvent === "endpoint") {
                                // SDK sends relative URI like "/messages?sessionId=..."
                                messageEndpoint = dataStr;
                                eventEmitter.emit("endpoint", messageEndpoint);
                            } else if (currentEvent === "message") {
                                const json = JSON.parse(dataStr);
                                eventEmitter.emit("message", json);
                            }
                        } catch (e) {
                            // ignore parse errors
                        }
                    }
                }
            });
            resolve();
        });
        
        sseReq.on('error', reject);
    });

    // 3. Wait for 'endpoint' event to get session ID
    if (!messageEndpoint) {
        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error("Timeout waiting for endpoint event")), 5000);
            eventEmitter.once("endpoint", () => {
                clearTimeout(timeout);
                resolve();
            });
        });
    }
    
    expect(messageEndpoint).toBeDefined();
    expect(messageEndpoint).toContain("/messages?sessionId=");

    // Helper to send JSON-RPC request via POST
    const sendRequest = (method: string, params: any): Promise<any> => {
        return new Promise((resolve, reject) => {
            const id = Date.now();
            const payload = JSON.stringify({
                jsonrpc: "2.0",
                id,
                method,
                params
            });
            
            // Listen for response on SSE stream
            const listener = (msg: any) => {
                if (msg.id === id) {
                    eventEmitter.off("message", listener);
                    if (msg.error) reject(msg.error);
                    else resolve(msg.result);
                }
            };
            eventEmitter.on("message", listener);

            // Send POST request
            const options = {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Content-Length": Buffer.byteLength(payload)
                }
            };
            
            // Construct full URL using base + relative endpoint from SSE
            const req = http.request(`${baseUrl}${messageEndpoint}`, options, (res) => {
                // Consume response
                res.resume();
                if (res.statusCode !== 200 && res.statusCode !== 202) {
                   eventEmitter.off("message", listener);
                   reject(new Error(`POST failed: ${res.statusCode}`));
                }
            });
            
            req.on("error", (err) => {
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
            vector: { "0": 1 },
            metadata: { transport: "http" }
        }
    });
    expect(memResult.content[0].text).toContain("Stored entry: http-test-1");

    // 5. Perform Search Operation
    const searchResult = await sendRequest("tools/call", {
        name: "search",
        arguments: {
            vector: { "0": 1 },
            limit: 1
        }
    });
    
    const content = JSON.parse(searchResult.content[0].text);
    expect(content).toHaveLength(1);
    expect(content[0].id).toBe("http-test-1");

    // Cleanup
    sseReq!.destroy();
  });
});
