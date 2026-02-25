/**
 * vecfs-embed-ts: TypeScript CLI for text-to-sparse-vector conversion.
 * Aligns with vecfs-embed-go and vecfs-embed-py (--config, --mode, --threshold, --batch).
 */

import { createFastEmbedEmbedder } from "./embedder/index.js";
import type { SparseVector } from "./types.js";

const DEFAULT_THRESHOLD = 0.01;
const DEFAULT_MODE = "query";

function parseArgv(argv: string[]): {
  configPath: string | null;
  mode: "query" | "document";
  threshold: number;
  batch: boolean;
  textArgs: string[];
} {
  let configPath: string | null = null;
  let mode = DEFAULT_MODE as "query" | "document";
  let threshold = DEFAULT_THRESHOLD;
  let batch = false;
  const textArgs: string[] = [];

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--config" && i + 1 < argv.length) {
      configPath = argv[++i];
    } else if (arg === "--mode" && i + 1 < argv.length) {
      const v = argv[++i].toLowerCase();
      if (v === "query" || v === "document") mode = v;
    } else if (arg === "--threshold" && i + 1 < argv.length) {
      threshold = parseFloat(argv[++i]) || DEFAULT_THRESHOLD;
    } else if (arg === "--batch") {
      batch = true;
    } else if (!arg.startsWith("-")) {
      textArgs.push(arg);
    }
  }
  return { configPath, mode, threshold, batch, textArgs };
}

function sparseToJsonCompatible(v: SparseVector): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, val] of Object.entries(v)) {
    out[String(k)] = val;
  }
  return out;
}

async function main(): Promise<void> {
  const argv = process.argv;
  const { mode, threshold, batch, textArgs } = parseArgv(argv);

  const embedder = await createFastEmbedEmbedder();
  if (!embedder) {
    console.error("vecfs-embed-ts: embedder not available (fastembed required).");
    process.exit(1);
  }

  if (batch) {
    const lines: string[] = [];
    const readStdin = async (): Promise<string> => {
      const chunks: Buffer[] = [];
      for await (const chunk of process.stdin) chunks.push(chunk);
      return Buffer.concat(chunks).toString("utf-8");
    };
    const stdinText = await readStdin();
    for (const line of stdinText.split(/\r?\n/)) {
      const t = line.trim();
      if (t) lines.push(t);
    }
    if (lines.length === 0) {
      console.error("vecfs-embed-ts: --batch requires input on stdin (one text per line).");
      process.exit(1);
    }
    const results = await Promise.all(
      lines.map(async (text) => {
        const vector = await embedder.embedText(text, { mode, threshold });
        return {
          vector: sparseToJsonCompatible(vector),
          threshold,
          mode,
          non_zero_count: Object.keys(vector).length,
        };
      }),
    );
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  let text: string;
  if (textArgs.length > 0) {
    text = textArgs.join(" ").trim();
  } else {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    text = Buffer.concat(chunks).toString("utf-8").trim();
  }
  if (!text) {
    console.error("vecfs-embed-ts: no input text provided (args or stdin).");
    process.exit(1);
  }

  const vector = await embedder.embedText(text, { mode, threshold });
  const out = {
    vector: sparseToJsonCompatible(vector),
    threshold,
    mode,
    non_zero_count: Object.keys(vector).length,
  };
  console.log(JSON.stringify(out, null, 2));
}

main().catch((err) => {
  console.error("vecfs-embed-ts:", err);
  process.exit(1);
});
