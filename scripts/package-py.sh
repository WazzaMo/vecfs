#!/usr/bin/env bash
# package-py.sh — Build and package the Python VecFS stack.
#
# Packages:
# - vecfs-embed-py / vecfs-embed (Python embedder wheel)
# - vecfs-py (Python MCP server/CLI)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT/py-src"

VERSION=$(python - << 'PY'
from pathlib import Path
import tomllib
data = tomllib.loads(Path("pyproject.toml").read_text(encoding="utf-8"))
print(data["project"].get("version", ""), end="")
PY
)

if [ -z "$VERSION" ]; then
  VERSION=$(cat ../VERSION.txt | tr -d '\n\r ')
fi

PACKAGE_NAME="vecfs-py-${VERSION}"
STAGE_DIR="$REPO_ROOT/build/${PACKAGE_NAME}"

echo "=== VecFS Python Packager v${VERSION} ==="
echo ""

echo "[1/4] Cleaning previous Python build..."
rm -rf "$REPO_ROOT/build"
rm -rf "$REPO_ROOT/py-src/dist"

echo "[2/4] Building Python wheel (vecfs-embed / vecfs-py)..."
uv build --quiet 2>&1
WHEEL=$(find dist -name '*.whl' -type f | head -1)
if [ -z "$WHEEL" ]; then
  echo "Error: Python wheel not found in py-src/dist/" >&2
  exit 1
fi
echo "       $(basename "$WHEEL") ($(du -h "$WHEEL" | cut -f1))"

echo "[3/4] Running Python tests..."
uv run pytest -q 2>&1 | tail -5

echo "[4/4] Assembling Python package..."
mkdir -p "$STAGE_DIR"

cp "$WHEEL" "$STAGE_DIR/"
cp README.md "$STAGE_DIR/README-py.md"

cat > "$STAGE_DIR/install.sh" << 'INSTALL_EOF'
#!/usr/bin/env bash
# install.sh — Install VecFS Python stack from this package.

set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"

for arg in "$@"; do
  case "$arg" in
    --help|-h)
      echo "Usage: ./install.sh"
      echo ""
      echo "Installs the vecfs-embed-py / vecfs-embed and vecfs-py CLIs from the wheel."
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 1
      ;;
  esac
done

WHEEL=$(find "$DIR" -name '*.whl' -maxdepth 1 | head -1)
if [ -z "$WHEEL" ]; then
  echo "Error: wheel not found in package." >&2
  exit 1
fi

if command -v uv >/dev/null 2>&1; then
  echo "Installing VecFS Python stack with uv..."
  uv tool install "$WHEEL"
elif command -v pip >/dev/null 2>&1; then
  echo "Installing VecFS Python stack with pip..."
  pip install "$WHEEL"
else
  echo "Error: Python pip or uv is required." >&2
  exit 1
fi

echo "Done. Run 'vecfs-embed-py --help', 'vecfs-embed --help', and 'vecfs-py --help' for usage."
INSTALL_EOF
chmod +x "$STAGE_DIR/install.sh"

(cd "$REPO_ROOT/build" && tar czf "$REPO_ROOT/${PACKAGE_NAME}.tar.gz" "$PACKAGE_NAME")

TARBALL_SIZE=$(du -h "$REPO_ROOT/${PACKAGE_NAME}.tar.gz" | cut -f1)
FILE_COUNT=$(tar tzf "$REPO_ROOT/${PACKAGE_NAME}.tar.gz" | wc -l | tr -d ' ')

echo ""
echo "=== Package complete (Python stack) ==="
echo "File:    ${PACKAGE_NAME}.tar.gz"
echo "Size:    ${TARBALL_SIZE}"
echo "Files:   ${FILE_COUNT}"

