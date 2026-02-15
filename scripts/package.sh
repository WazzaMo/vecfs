#!/usr/bin/env bash
# package.sh — Build and package VecFS into a minimal distributable tar.gz.
#
# Produces: vecfs-<version>.tar.gz
#
# Contents:
#   vecfs/
#   ├── mcp-server.js          MCP server (single-file Node.js bundle)
#   ├── package.json            Minimal runtime manifest
#   ├── vecfs-memory/           Agent Skill directory
#   ├── vecfs-embed.whl         Python embedding script (wheel)
#   ├── install.sh              Installer helper
#   ├── README.md
#   ├── CONTRIBUTING.md
#   └── LICENSE
#
# Usage:
#   ./scripts/package.sh
#
# Prerequisites:
#   - Node.js (see .node-version) with npm
#   - Python 3.10+ with uv

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# ---------------------------------------------------------------------------
# Read version from package.json
# ---------------------------------------------------------------------------
VERSION=$(node -e "process.stdout.write(require('./package.json').version)")
PACKAGE_NAME="vecfs-${VERSION}"
STAGE_DIR="$REPO_ROOT/build/${PACKAGE_NAME}"

echo "=== VecFS Packager v${VERSION} ==="
echo ""

# ---------------------------------------------------------------------------
# Clean previous build
# ---------------------------------------------------------------------------
echo "[1/6] Cleaning previous build..."
rm -rf "$REPO_ROOT/build"
rm -rf "$REPO_ROOT/dist"

# ---------------------------------------------------------------------------
# Build the MCP server (TypeScript → single-file JS bundle)
# ---------------------------------------------------------------------------
echo "[2/6] Building MCP server..."
npm run build --silent
echo "       dist/mcp-server.js ($(du -h dist/mcp-server.js | cut -f1))"

# ---------------------------------------------------------------------------
# Build the Python embedding wheel
# ---------------------------------------------------------------------------
echo "[3/6] Building embedding script wheel..."
(cd py-src && uv build --quiet 2>&1)
WHEEL=$(find py-src/dist -name '*.whl' -type f | head -1)
if [ -z "$WHEEL" ]; then
  echo "Error: Python wheel not found in py-src/dist/" >&2
  exit 1
fi
echo "       $(basename "$WHEEL") ($(du -h "$WHEEL" | cut -f1))"

# ---------------------------------------------------------------------------
# Run tests
# ---------------------------------------------------------------------------
echo "[4/6] Running tests..."
npm test --silent 2>&1 | tail -3
(cd py-src && uv run pytest tests/test_sparsify.py -q 2>&1 | tail -1)

# ---------------------------------------------------------------------------
# Assemble staging directory
# ---------------------------------------------------------------------------
echo "[5/6] Assembling package..."
mkdir -p "$STAGE_DIR"

# MCP server bundle (single file, no node_modules needed)
cp dist/mcp-server.js "$STAGE_DIR/mcp-server.js"
chmod +x "$STAGE_DIR/mcp-server.js"

# Minimal package.json for the server (runtime fields only)
node -e "
const pkg = require('./package.json');
const minimal = {
  name: pkg.name,
  version: pkg.version,
  description: pkg.description,
  type: pkg.type,
  main: 'mcp-server.js',
  bin: { vecfs: 'mcp-server.js' },
  author: pkg.author,
  license: pkg.license,
  repository: pkg.repository,
  homepage: pkg.homepage
};
process.stdout.write(JSON.stringify(minimal, null, 2) + '\n');
" > "$STAGE_DIR/package.json"

# Python wheel
cp "$WHEEL" "$STAGE_DIR/"

# Agent Skill directory
cp -r vecfs-memory "$STAGE_DIR/vecfs-memory"

# Documentation
cp README.md "$STAGE_DIR/"
cp CONTRIBUTING.md "$STAGE_DIR/"
cp LICENSE "$STAGE_DIR/"

# Install helper script
cat > "$STAGE_DIR/install.sh" << 'INSTALL_EOF'
#!/usr/bin/env bash
# install.sh — Install VecFS from this package.
#
# Installs the MCP server globally via npm and the embedding script via pip/uv.
#
# Usage:
#   ./install.sh              Install both components
#   ./install.sh --server     Install MCP server only
#   ./install.sh --embed      Install embedding script only

set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
INSTALL_SERVER=true
INSTALL_EMBED=true

for arg in "$@"; do
  case "$arg" in
    --server) INSTALL_EMBED=false ;;
    --embed)  INSTALL_SERVER=false ;;
    --help|-h)
      echo "Usage: ./install.sh [--server] [--embed]"
      echo "  --server  Install MCP server only"
      echo "  --embed   Install embedding script only"
      echo "  (default) Install both"
      exit 0
      ;;
    *) echo "Unknown option: $arg"; exit 1 ;;
  esac
done

if $INSTALL_SERVER; then
  echo "Installing VecFS MCP server..."
  if ! command -v node >/dev/null 2>&1; then
    echo "Error: Node.js is required. Install it from https://nodejs.org/" >&2
    exit 1
  fi
  npm install -g "$DIR"
  echo "Done. Run 'vecfs' or 'vecfs --http' to start the server."
  echo ""
fi

if $INSTALL_EMBED; then
  echo "Installing vecfs-embed..."
  WHEEL=$(find "$DIR" -name '*.whl' -maxdepth 1 | head -1)
  if [ -z "$WHEEL" ]; then
    echo "Error: wheel not found in package." >&2
    exit 1
  fi
  if command -v uv >/dev/null 2>&1; then
    uv tool install "$WHEEL"
  elif command -v pip >/dev/null 2>&1; then
    pip install "$WHEEL"
  else
    echo "Error: Python pip or uv is required." >&2
    exit 1
  fi
  echo "Done. Run 'vecfs-embed --help' for usage."
fi
INSTALL_EOF
chmod +x "$STAGE_DIR/install.sh"

# ---------------------------------------------------------------------------
# Create the tarball
# ---------------------------------------------------------------------------
echo "[6/6] Creating tarball..."
(cd "$REPO_ROOT/build" && tar czf "$REPO_ROOT/${PACKAGE_NAME}.tar.gz" "$PACKAGE_NAME")

# Report
TARBALL_SIZE=$(du -h "$REPO_ROOT/${PACKAGE_NAME}.tar.gz" | cut -f1)
FILE_COUNT=$(tar tzf "$REPO_ROOT/${PACKAGE_NAME}.tar.gz" | wc -l | tr -d ' ')

echo ""
echo "=== Package complete ==="
echo "File:    ${PACKAGE_NAME}.tar.gz"
echo "Size:    ${TARBALL_SIZE}"
echo "Files:   ${FILE_COUNT}"
echo ""
echo "To install from the package:"
echo "  tar xzf ${PACKAGE_NAME}.tar.gz"
echo "  cd ${PACKAGE_NAME}"
echo "  ./install.sh"

# Clean up staging directory
rm -rf "$REPO_ROOT/build"
