#!/usr/bin/env bash
# Build VecFS Go binaries with version from VERSION.txt (repo root).
# Usage: from repo root, ./scripts/build-go.sh [optional: output dir, default go-src]

set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION=$(cat "$ROOT/VERSION.txt" | tr -d '\n\r ')
OUT="${1:-$ROOT/go-src}"
cd "$ROOT/go-src"
LDFLAGS="-X main.version=$VERSION"

go build -ldflags "$LDFLAGS" -o "$OUT/vecfs" ./cmd/vecfs/
go build -ldflags "$LDFLAGS" -o "$OUT/vecfs-mcp-go" ./cmd/vecfs-mcp-go/
go build -ldflags "$LDFLAGS" -o "$OUT/vecfs-embed-go" ./cmd/vecfs-embed-go/

echo "Built with version $VERSION: $OUT/vecfs $OUT/vecfs-mcp-go $OUT/vecfs-embed-go"
