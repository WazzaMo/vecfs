#!/usr/bin/env node
/**
 * Benchmark driver for vecfs-mcp (Node) vs vecfs-mcp-go (Go).
 * Usage: from repo root, node scripts/benchmark-mcp.mjs <node|go> [count]
 *   count = number of memorize + search pairs (default 50). Total requests = 1 (tools/list) + 2*count.
 */
import { spawn } from "child_process";
import { mkdirSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const impl = process.argv[2] || "node";
const count = Math.min(parseInt(process.argv[3], 10) || 50, 500);
const tmpDir = join(tmpdir(), `vecfs-bench-${Date.now()}`);
mkdirSync(tmpDir, { recursive: true });
const dataFile = join(tmpDir, "bench-data.jsonl");

let proc;
if (impl === "go") {
  const goBin = join(root, "go-src", "vecfs-mcp-go");
  proc = spawn(goBin, [], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, VECFS_FILE: dataFile },
    cwd: join(root, "go-src"),
  });
} else {
  const serverPath = join(root, "dist", "mcp-server.js");
  proc = spawn("node", [serverPath], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, VECFS_FILE: dataFile },
    cwd: root,
  });
}

let reqId = 0;
const send = (method, params) => {
  return new Promise((resolve, reject) => {
    const id = ++reqId;
    const req = JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n";
    const timeout = setTimeout(() => {
      proc.stdout.off("data", onData);
      reject(new Error(`timeout ${method}`));
    }, 15000);
    const onData = (buf) => {
      const lines = buf.toString().split("\n");
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const res = JSON.parse(line);
          if (res.id === id) {
            clearTimeout(timeout);
            proc.stdout.off("data", onData);
            if (res.error) reject(res.error);
            else resolve(res.result);
            return;
          }
        } catch (_) {}
      }
    };
    proc.stdout.on("data", onData);
    proc.stdin.write(req);
  });
};

async function main() {
  const start = Date.now();
  await send("tools/list", {});
  for (let i = 0; i < count; i++) {
    await send("tools/call", {
      name: "memorize",
      arguments: {
        id: `bench-${i}`,
        text: `benchmark entry ${i}`,
        vector: { "0": 1, "1": 0.5, [i % 100]: 0.3 },
        metadata: { i },
      },
    });
  }
  const queryVector = { "0": 1, "1": 0.5 };
  for (let i = 0; i < count; i++) {
    await send("tools/call", {
      name: "search",
      arguments: { vector: queryVector, limit: 5 },
    });
  }
  const total = Date.now() - start;
  proc.kill();
  try { rmSync(tmpDir, { recursive: true }); } catch (_) {}
  console.log(`Implementation: ${impl}`);
  console.log(`Requests: 1 + ${count} memorize + ${count} search = ${1 + 2 * count}`);
  console.log(`Total time (ms): ${total}`);
  console.log(`Avg per request (ms): ${(total / (1 + 2 * count)).toFixed(2)}`);
}

main().catch((err) => {
  if (proc) proc.kill();
  try { rmSync(tmpDir, { recursive: true }); } catch (_) {}
  console.error(err);
  process.exit(1);
});
