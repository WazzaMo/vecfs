/**
 * Performance comparison of embedders: fastembed, transformers, onnx.
 * Run: npx vitest run embedder-perf
 * Results are logged and can be copied to docs/notes.
 */

import { describe, it } from "vitest";
import { createFastEmbedEmbedder } from "./embedder/index.js";
import { createTransformersJsEmbedder } from "./embedder/index.js";
import { createOnnxEmbedder } from "./embedder/index.js";

const TEST_TEXT = "The quick brown fox jumps over the lazy dog.";
const WARM_RUNS = 50;

function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

async function measureEmbedder(
  name: string,
  create: () => Promise<{ embedText: (t: string) => Promise<unknown> } | null>,
) {
  const embedder = await create();
  if (!embedder) {
    return { name, error: "failed to create embedder" };
  }

  const coldStartStart = performance.now();
  await embedder.embedText(TEST_TEXT);
  const coldStartMs = performance.now() - coldStartStart;

  const rssAfterLoad = process.memoryUsage().rss;

  const warmTimes: number[] = [];
  for (let i = 0; i < WARM_RUNS; i++) {
    const start = performance.now();
    await embedder.embedText(TEST_TEXT);
    warmTimes.push(performance.now() - start);
  }

  const rssAfterWarm = process.memoryUsage().rss;

  const mean = warmTimes.reduce((a, b) => a + b, 0) / warmTimes.length;
  const throughput = 1000 / mean;

  return {
    name,
    coldStartMs,
    warmMeanMs: mean,
    warmP50Ms: percentile(warmTimes, 50),
    warmP95Ms: percentile(warmTimes, 95),
    warmP99Ms: percentile(warmTimes, 99),
    throughputPerSec: throughput,
    rssAfterLoadMb: (rssAfterLoad / 1024 / 1024).toFixed(2),
    rssAfterWarmMb: (rssAfterWarm / 1024 / 1024).toFixed(2),
  };
}

describe("Embedder performance", () => {
  it(
    "measures fastembed, transformers, onnx",
    { timeout: 60000 },
    async () => {
    const results: Record<string, unknown>[] = [];

    for (const [label, create] of [
      ["fastembed", () => createFastEmbedEmbedder()],
      ["transformers", () => createTransformersJsEmbedder()],
      ["onnx", () => createOnnxEmbedder()],
    ] as const) {
      const r = await measureEmbedder(label, create);
      if ("error" in r) {
        results.push({ name: label, error: r.error });
      } else {
        results.push(r);
      }
    }

    console.log("\n--- Embedder performance results ---\n");
    console.log(JSON.stringify(results, null, 2));
    console.log("\n--- End results ---\n");
  },
  );
});
