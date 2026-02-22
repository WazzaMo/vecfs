#!/usr/bin/env node
/**
 * TS/Node client for local Text Embeddings Inference (TEI).
 * Usage: node scripts/embed-tei.mjs [baseURL] "text to embed"
 *   baseURL defaults to http://localhost:8080. Outputs JSON with vector (sparse) and timing.
 * Used by benchmark-embed.mjs for the "ts" implementation.
 */
const baseURL = process.argv[2] || "http://localhost:8080";
const text = (process.argv[3] ?? process.argv.slice(3).join(" ")).trim();
if (!text) {
  process.stderr.write("Error: no input text. Usage: node embed-tei.mjs [baseURL] \"text\"\n");
  process.exit(1);
}

const url = baseURL.replace(/\/$/, "") + "/embed";
const start = performance.now();
fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ inputs: text }),
})
  .then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  })
  .then((embedding) => {
    const ms = performance.now() - start;
    // TEI returns [[f1, f2, ...]]. Convert to sparse (threshold 0.01) and L2 norm for VecFS format.
    const dense = Array.isArray(embedding[0]) ? embedding[0] : embedding;
    const threshold = 0.01;
    const sparse = {};
    let sumSq = 0;
    for (let i = 0; i < dense.length; i++) {
      const x = Number(dense[i]);
      if (Math.abs(x) > threshold) {
        sparse[String(i)] = x;
        sumSq += x * x;
      }
    }
    const norm = Math.sqrt(sumSq) || 1;
    for (const k of Object.keys(sparse)) sparse[k] /= norm;
    process.stdout.write(
      JSON.stringify({
        vector: sparse,
        provider: "ts",
        dense_dimensions: dense.length,
        non_zero_count: Object.keys(sparse).length,
        threshold,
        duration_ms: Math.round(ms * 100) / 100,
      }) + "\n"
    );
  })
  .catch((err) => {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(1);
  });
