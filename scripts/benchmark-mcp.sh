#!/usr/bin/env bash
# Run MCP benchmark: Node vs Go.
# From repo root: ./scripts/benchmark-mcp.sh [node|go|both] [count]
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
IMPL="${1:-both}"
COUNT="${2:-50}"

if [[ "$IMPL" == "go" || "$IMPL" == "both" ]]; then
  if [[ ! -x "$ROOT/go-src/vecfs-mcp-go" ]]; then
    echo "Building vecfs-mcp-go..."
    (cd go-src && go build -o vecfs-mcp-go ./cmd/vecfs-mcp-go/)
  fi
fi
if [[ "$IMPL" == "node" || "$IMPL" == "both" ]]; then
  if [[ ! -f "$ROOT/dist/mcp-server.js" ]]; then
    echo "Building Node MCP server..."
    npm run build
  fi
fi

run_one() {
  node "$ROOT/scripts/benchmark-mcp.mjs" "$1" "$COUNT"
}

echo "---"
if [[ "$IMPL" == "both" ]]; then
  run_one node
  echo "---"
  run_one go
else
  run_one "$IMPL"
fi
