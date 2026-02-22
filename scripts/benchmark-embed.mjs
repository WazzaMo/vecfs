#!/usr/bin/env node
/**
 * Benchmark embedding implementations: Python (vecfs_embed), Go local (TEI), Go HuggingFace.
 * Usage: node scripts/benchmark-embed.mjs [runs]
 *   runs = number of runs per implementation (default 30). Reports min/avg/max ms per run.
 *
 * Prerequisites:
 *   - Python: pip/uv install deps for py-src/vecfs_embed (sentence-transformers etc.)
 *   - Go local: docker compose -f sentence-transformer-compose.yaml up -d (TEI on :8080)
 *   - Go HuggingFace: HUGGINGFACEHUB_API_TOKEN or embed.huggingface_token in config
 */
import { spawnSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const runs = Math.max(1, Math.min(parseInt(process.argv[2], 10) || 30, 1000));
const testText = "The quick brown fox jumps over the lazy dog. Semantic search and vector embeddings.";

function timeRun(impl, args, opts = {}) {
  const { env = {}, cwd = root } = opts;
  const start = performance.now();
  const result = spawnSync(impl, args, {
    cwd,
    env: { ...process.env, ...env },
    input: null,
    timeout: 60000,
    encoding: "utf8",
  });
  const ms = performance.now() - start;
  if (result.status !== 0) {
    throw new Error(`${impl} ${args.join(" ")} failed: ${result.stderr || result.error}`);
  }
  return ms;
}

function runBenchmark(name, runOne) {
  const times = [];
  for (let i = 0; i < runs; i++) {
    const ms = runOne();
    times.push(ms);
  }
  times.sort((a, b) => a - b);
  const min = times[0];
  const max = times[times.length - 1];
  const sum = times.reduce((a, b) => a + b, 0);
  const avg = sum / times.length;
  return { name, runs: times.length, min, max, avg, times };
}

function main() {
  const goBin = join(root, "go-src", "vecfs-embed-go");
  const results = [];

  console.log(`Embedding benchmark: ${runs} runs per implementation`);
  console.log(`Test text: "${testText.slice(0, 50)}..."`);
  console.log("");

  // 1. Python (vecfs_embed)
  try {
    const r = runBenchmark("python", () =>
      timeRun("python3", ["-m", "vecfs_embed.cli", testText], {
        env: { PYTHONPATH: join(root, "py-src") },
      })
    );
    results.push(r);
  } catch (e) {
    console.error("Python (vecfs_embed) skipped:", e.message);
  }

  // 2. Go local (TEI)
  try {
    const r = runBenchmark("go-local", () =>
      timeRun(goBin, ["--provider", "local", testText], { cwd: join(root, "go-src") })
    );
    results.push(r);
  } catch (e) {
    console.error("Go local (TEI) skipped:", e.message);
  }

  // 3. Go HuggingFace
  try {
    const r = runBenchmark("go-huggingface", () =>
      timeRun(goBin, ["--provider", "huggingface", testText], { cwd: join(root, "go-src") })
    );
    results.push(r);
  } catch (e) {
    console.error("Go HuggingFace skipped:", e.message);
  }

  if (results.length === 0) {
    console.error("No implementation succeeded.");
    process.exit(1);
  }

  // Report table
  console.log("Implementation      | Runs | Min (ms) | Avg (ms) | Max (ms)");
  console.log("--------------------|------|---------|----------|---------");
  for (const { name, runs: n, min, avg, max } of results) {
    console.log(
      `${name.padEnd(18)} | ${String(n).padStart(4)} | ${min.toFixed(2).padStart(7)} | ${avg.toFixed(2).padStart(8)} | ${max.toFixed(2).padStart(7)}`
    );
  }
}

main();
