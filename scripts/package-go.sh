#!/usr/bin/env bash
# package-go.sh — Build and package the Go VecFS stack.
#
# Packages:
# - vecfs          (Go CLI)
# - vecfs-mcp-go   (Go MCP server)
# - vecfs-embed-go (Go embedder CLI)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

VERSION=$(cat VERSION.txt | tr -d '\n\r ')
PACKAGE_NAME="vecfs-go-${VERSION}"
STAGE_DIR="$REPO_ROOT/build/${PACKAGE_NAME}"

echo "=== VecFS Go Packager v${VERSION} ==="
echo ""

echo "[1/4] Cleaning previous Go build..."
rm -rf "$REPO_ROOT/build"

echo "[2/4] Building Go binaries..."
./scripts/build-go.sh "$REPO_ROOT/build"

echo "[3/4] Running Go tests..."
cd "$REPO_ROOT/go-src"
go test ./... ./internal/... ./cmd/... ./internal/embed/... ./internal/storage/... ./internal/sparse/... 2>&1 | tail -10
cd "$REPO_ROOT"

echo "[4/4] Assembling Go package..."
mkdir -p "$STAGE_DIR/bin"

cp build/vecfs "$STAGE_DIR/bin/vecfs"
cp build/vecfs-mcp-go "$STAGE_DIR/bin/vecfs-mcp-go"
cp build/vecfs-embed-go "$STAGE_DIR/bin/vecfs-embed-go"
chmod +x "$STAGE_DIR"/bin/*

cp go-src/README.md "$STAGE_DIR/README-go.md"
cp LICENSE "$STAGE_DIR/LICENSE"

cat > "$STAGE_DIR/install.sh" << 'INSTALL_EOF'
#!/usr/bin/env bash
# install.sh — Install VecFS Go stack from this package.

set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
PREFIX="${HOME}/.local"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --prefix)
      shift
      PREFIX="${1:-$PREFIX}"
      ;;
    --prefix=*)
      PREFIX="${1#--prefix=}"
      ;;
    --help|-h)
      echo "Usage: ./install.sh [--prefix DIR]"
      echo ""
      echo "Installs vecfs, vecfs-mcp-go, and vecfs-embed-go into DIR/bin (default: \$HOME/.local/bin)."
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
  shift
done

BIN_DIR=\"$PREFIX/bin\"
mkdir -p \"$BIN_DIR\"

cp \"$DIR/bin/vecfs\" \"$BIN_DIR/vecfs\"
cp \"$DIR/bin/vecfs-mcp-go\" \"$BIN_DIR/vecfs-mcp-go\"
cp \"$DIR/bin/vecfs-embed-go\" \"$BIN_DIR/vecfs-embed-go\"
chmod +x \"$BIN_DIR/vecfs\" \"$BIN_DIR/vecfs-mcp-go\" \"$BIN_DIR/vecfs-embed-go\"

echo \"Installed Go binaries to $BIN_DIR\"
echo \"Add to PATH if needed: export PATH=\\\"$BIN_DIR:\\$PATH\\\"\"
echo \"Run 'vecfs --help', 'vecfs-mcp-go --help', and 'vecfs-embed-go --help' for usage.\"
INSTALL_EOF
chmod +x "$STAGE_DIR/install.sh"

(cd "$REPO_ROOT/build" && tar czf "$REPO_ROOT/${PACKAGE_NAME}.tar.gz" "$PACKAGE_NAME")

TARBALL_SIZE=$(du -h "$REPO_ROOT/${PACKAGE_NAME}.tar.gz" | cut -f1)
FILE_COUNT=$(tar tzf "$REPO_ROOT/${PACKAGE_NAME}.tar.gz" | wc -l | tr -d ' ')

echo ""
echo "=== Package complete (Go stack) ==="
echo "File:    ${PACKAGE_NAME}.tar.gz"
echo "Size:    ${TARBALL_SIZE}"
echo "Files:   ${FILE_COUNT}"

