#!/usr/bin/env bash
# Benchmark vector embedding: Python (vecfs_embed), Go local (TEI), Go HuggingFace.
# Usage: ./scripts/benchmark-embed.sh [runs]
#   runs = number of runs per implementation (default 30). Reports min/avg/max ms.
#
# Prerequisites:
#   - Python: pip/uv install deps for py-src/vecfs_embed (sentence-transformers etc.); run from repo root
#   - Go local: docker compose -f sentence-transformer-compose.yaml up -d
#   - Go HuggingFace: HUGGINGFACEHUB_API_TOKEN or embed.huggingface_token in config
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
RUNS="${1:-30}"

if [[ ! -x "$ROOT/go-src/vecfs-embed-go" ]]; then
  echo "Building vecfs-embed-go..."
  (cd "$ROOT/go-src" && go build -o vecfs-embed-go ./cmd/vecfs-embed-go/)
fi

node "$ROOT/scripts/benchmark-embed.mjs" "$RUNS"
