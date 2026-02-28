#!/usr/bin/env bash
# package-ts.sh — Build and package the TypeScript VecFS stack.
#
# This script packages only the TypeScript artifacts:
# - vecfs (MCP server JS bundle)
# - vecfs-embed-ts (TS embedder CLI)
# - any TS-only CLI entry points defined in package.json.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

VERSION=$(node -e "process.stdout.write(require('./package.json').version)")
PACKAGE_NAME="vecfs-ts-${VERSION}"
STAGE_DIR="$REPO_ROOT/build/${PACKAGE_NAME}"

echo "=== VecFS TypeScript Packager v${VERSION} ==="
echo ""

echo "[1/4] Cleaning previous build..."
rm -rf "$REPO_ROOT/build"
rm -rf "$REPO_ROOT/dist"

echo "[2/4] Building TypeScript project (MCP server + embed CLI)..."
npm run build --silent
echo "       dist/mcp-server.js ($(du -h dist/mcp-server.js | cut -f1))"

echo "[3/4] Running TypeScript tests (ONNX embedder)..."
VECFS_EMBEDDER=onnx npm test --silent 2>&1 | tail -3

echo "[4/4] Assembling package..."
mkdir -p "$STAGE_DIR"

cp dist/mcp-server.js "$STAGE_DIR/mcp-server.js"
chmod +x "$STAGE_DIR/mcp-server.js"

node -e "
const pkg = require('./package.json');
const minimal = {
  name: pkg.name,
  version: pkg.version,
  description: pkg.description,
  type: pkg.type,
  main: 'mcp-server.js',
  bin: {
    vecfs: 'mcp-server.js',
    ...(pkg.bin || {}),
  },
  author: pkg.author,
  license: pkg.license,
  repository: pkg.repository,
  homepage: pkg.homepage
};
process.stdout.write(JSON.stringify(minimal, null, 2) + '\n');
" > "$STAGE_DIR/package.json"

cp -r vecfs-memory "$STAGE_DIR/vecfs-memory"
cp README.md "$STAGE_DIR/"
cp CONTRIBUTING.md "$STAGE_DIR/"
cp LICENSE "$STAGE_DIR/"

# Default config: ONNX as best local embedder (per performance tests)
cat > "$STAGE_DIR/vecfs.yaml" << 'CONFIG_EOF'
# VecFS config — ONNX embedder (recommended for local use)
embedder:
  provider: onnx
CONFIG_EOF

cat > "$STAGE_DIR/install.sh" << 'INSTALL_EOF'
#!/usr/bin/env bash
# install.sh — Install VecFS TypeScript stack from this package.

set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"

for arg in "$@"; do
  case "$arg" in
    --help|-h)
      echo "Usage: ./install.sh"
      echo ""
      echo "Installs the VecFS TypeScript MCP server and any TS CLIs defined in package.json."
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 1
      ;;
  esac
done

echo "Installing VecFS TypeScript stack..."
if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node.js is required. Install it from https://nodejs.org/" >&2
  exit 1
fi
npm install -g "$DIR"

# Install default config (ONNX embedder) if user has none
CONFIG_DIR="$HOME/.config/vecfs"
CONFIG_FILE="$CONFIG_DIR/vecfs.yaml"
if [ ! -f "$CONFIG_FILE" ]; then
  mkdir -p "$CONFIG_DIR"
  cp "$DIR/vecfs.yaml" "$CONFIG_FILE"
  echo "Installed default config at $CONFIG_FILE (ONNX embedder)."
fi

echo "Done. Run 'vecfs --help' and 'vecfs-embed-ts --help' for usage."
INSTALL_EOF
chmod +x "$STAGE_DIR/install.sh"

echo "Creating tarball..."
(cd "$REPO_ROOT/build" && tar czf "$REPO_ROOT/${PACKAGE_NAME}.tar.gz" "$PACKAGE_NAME")

TARBALL_SIZE=$(du -h "$REPO_ROOT/${PACKAGE_NAME}.tar.gz" | cut -f1)
FILE_COUNT=$(tar tzf "$REPO_ROOT/${PACKAGE_NAME}.tar.gz" | wc -l | tr -d ' ')

echo ""
echo "=== Package complete (TypeScript stack) ==="
echo "File:    ${PACKAGE_NAME}.tar.gz"
echo "Size:    ${TARBALL_SIZE}"
echo "Files:   ${FILE_COUNT}"

