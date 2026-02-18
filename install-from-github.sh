#!/usr/bin/env bash
# install-from-github.sh — Install VecFS from a cloned GitHub repository.
#
# Does not require npm or pip. Copies the MCP server bundle and Python
# embedding module into a prefix directory and creates executables in
# that prefix's bin. You only need Node.js and Python runtimes.
#
# Usage:
#   ./install-from-github.sh              Install both components
#   ./install-from-github.sh --server     Install MCP server only
#   ./install-from-github.sh --embed      Install embedding script only
#   ./install-from-github.sh --prefix /opt/vecfs
#
# Prerequisites:
#   - Node.js (for MCP server; used to build if dist/ is missing)
#   - Python 3.10+ (for vecfs-embed)
#   - Optional: pip or uv to install Python deps when prompted

set -euo pipefail

# ---------------------------------------------------------------------------
# Defaults and options
# ---------------------------------------------------------------------------
PREFIX="${HOME}/.local"
INSTALL_SERVER=true
INSTALL_EMBED=true
INSTALL_PYTHON_DEPS=""

# ---------------------------------------------------------------------------
# Repo root (directory containing this script when run from repo)
# ---------------------------------------------------------------------------
if [[ -f "${BASH_SOURCE[0]}" ]]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  REPO_ROOT="$(cd "$SCRIPT_DIR" && pwd)"
else
  REPO_ROOT="$(pwd)"
fi

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  arg="$1"
  shift
  case "$arg" in
    --server)
      INSTALL_EMBED=false
      ;;
    --embed)
      INSTALL_SERVER=false
      ;;
    --prefix=*)
      PREFIX="${arg#--prefix=}"
      ;;
    --prefix)
      [[ $# -gt 0 ]] || { echo "Error: --prefix requires DIR" >&2; exit 1; }
      PREFIX="$1"
      shift
      ;;
    --install-python-deps)
      INSTALL_PYTHON_DEPS=yes
      ;;
    --help|-h)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --server              Install MCP server only"
      echo "  --embed               Install embedding script only"
      echo "  --prefix DIR          Install to DIR (default: \$HOME/.local)"
      echo "  --install-python-deps Install Python deps for vecfs-embed (pip/uv)"
      echo "  --help                Show this help"
      echo ""
      echo "Prerequisites: Node.js, Python 3.10+. No npm or pip required for install;"
      echo "Python dependencies for vecfs-embed can be installed when prompted or with"
      echo "  --install-python-deps."
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 1
      ;;
  esac
done

# Allow override via environment (only if explicitly set)
if [[ -n "${VECFS_INSTALL_PREFIX:-}" ]]; then
  PREFIX="$VECFS_INSTALL_PREFIX"
fi

BIN_DIR="$PREFIX/bin"
LIB_DIR="$PREFIX/lib/vecfs"
EMBED_DIR="$LIB_DIR/embed"

echo "=== VecFS install-from-GitHub ==="
echo "Prefix: $PREFIX"
echo ""

# ---------------------------------------------------------------------------
# Ensure prefix and directories exist
# ---------------------------------------------------------------------------
mkdir -p "$BIN_DIR"
mkdir -p "$LIB_DIR"

# ---------------------------------------------------------------------------
# MCP Server
# ---------------------------------------------------------------------------
if $INSTALL_SERVER; then
  echo "[1] Installing VecFS MCP server..."

  if ! command -v node >/dev/null 2>&1; then
    echo "Error: Node.js is required. Install from https://nodejs.org/" >&2
    exit 1
  fi

  MCP_SRC="$REPO_ROOT/dist/mcp-server.js"
  if [[ ! -f "$MCP_SRC" ]]; then
    echo "    dist/mcp-server.js not found. Building..."
    if command -v npm >/dev/null 2>&1; then
      (cd "$REPO_ROOT" && npm run build --silent)
    else
      echo "Error: npm is required to build the server. Run 'npm run build' in the repo first, or install npm." >&2
      exit 1
    fi
  fi

  if [[ ! -f "$MCP_SRC" ]]; then
    echo "Error: Build did not produce dist/mcp-server.js" >&2
    exit 1
  fi

  cp "$MCP_SRC" "$LIB_DIR/mcp-server.js"
  chmod +x "$LIB_DIR/mcp-server.js"
  ln -sf "../lib/vecfs/mcp-server.js" "$BIN_DIR/vecfs"
  echo "    Installed: $BIN_DIR/vecfs -> $LIB_DIR/mcp-server.js"
  echo ""
fi

# ---------------------------------------------------------------------------
# Python embedding script
# ---------------------------------------------------------------------------
if $INSTALL_EMBED; then
  echo "[2] Installing vecfs-embed..."

  if ! command -v python3 >/dev/null 2>&1; then
    echo "Error: Python 3 is required. Install Python 3.10+ from your system or https://www.python.org/" >&2
    exit 1
  fi

  PY_SRC="$REPO_ROOT/py-src"
  if [[ ! -d "$PY_SRC/vecfs_embed" ]]; then
    echo "Error: py-src/vecfs_embed not found. Run this script from the VecFS repo root." >&2
    exit 1
  fi

  rm -rf "$EMBED_DIR"
  mkdir -p "$(dirname "$EMBED_DIR")"
  cp -r "$PY_SRC/vecfs_embed" "$EMBED_DIR/"
  [[ -f "$PY_SRC/pyproject.toml" ]] && cp "$PY_SRC/pyproject.toml" "$EMBED_DIR/"

  # Wrapper script that sets PYTHONPATH and runs the module (PREFIX embedded at install time)
  cat > "$BIN_DIR/vecfs-embed" << WRAPPER
#!/usr/bin/env bash
# VecFS embed wrapper — installed by install-from-github.sh
VECFS_PREFIX="\${VECFS_INSTALL_PREFIX:-$PREFIX}"
export PYTHONPATH="\${VECFS_PREFIX}/lib/vecfs/embed:\${PYTHONPATH:-}"
exec python3 -m vecfs_embed.cli "\$@"
WRAPPER
  chmod +x "$BIN_DIR/vecfs-embed"
  echo "    Installed: $BIN_DIR/vecfs-embed (uses $EMBED_DIR)"
  echo ""

  # Optional: install Python dependencies
  if [[ "$INSTALL_PYTHON_DEPS" == "yes" ]]; then
    if command -v uv >/dev/null 2>&1; then
      echo "    Installing Python dependencies with uv..."
      uv pip install --python "$(command -v python3)" "$EMBED_DIR" 2>/dev/null || true
    elif command -v pip >/dev/null 2>&1; then
      echo "    Installing Python dependencies with pip..."
      pip install "$EMBED_DIR" 2>/dev/null || true
    fi
  else
    echo "    To install Python dependencies for vecfs-embed (required for use), run:"
    echo "      pip install $EMBED_DIR"
    echo "    or (with uv):"
    echo "      uv pip install $EMBED_DIR"
    echo ""
  fi
fi

# ---------------------------------------------------------------------------
# PATH reminder
# ---------------------------------------------------------------------------
echo "=== Done ==="
if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
  echo "Add the install directory to your PATH:"
  echo "  export PATH=\"$BIN_DIR:\$PATH\""
  echo ""
  echo "To make this permanent, add the line above to ~/.bashrc or ~/.profile."
fi
echo ""
echo "Run 'vecfs' or 'vecfs --http' to start the MCP server."
echo "Run 'vecfs-embed --help' for the embedding script (install Python deps first if needed)."
