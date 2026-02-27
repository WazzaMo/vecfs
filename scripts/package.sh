#!/usr/bin/env bash
# package.sh — Wrapper for VecFS packaging across implementations.
#
# Delegates to per-language packagers:
# - scripts/package-ts.sh  (TypeScript stack)
# - scripts/package-py.sh  (Python stack)
# - scripts/package-go.sh  (Go stack)
#
# Usage:
#   ./scripts/package.sh            # default TS stack
#   ./scripts/package.sh --lang ts  # explicit TypeScript stack
#   ./scripts/package.sh --lang py  # Python stack
#   ./scripts/package.sh --lang go  # Go stack

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

LANG="ts"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --lang)
      shift
      LANG="${1:-}"
      if [[ -z "$LANG" ]]; then
        echo "Error: --lang requires a value (ts|py|go)" >&2
        exit 1
      fi
      ;;
    --lang=*)
      LANG="${1#--lang=}"
      ;;
    --help|-h)
      echo "Usage: $0 [--lang ts|py|go]"
      echo ""
      echo "  --lang ts   Package TypeScript stack (default)."
      echo "  --lang py   Package Python stack (vecfs-embed[-py], vecfs-py)."
      echo "  --lang go   Package Go stack (vecfs, vecfs-mcp-go, vecfs-embed-go)."
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
  shift
done

case "$LANG" in
  ts)
    exec "${SCRIPT_DIR}/package-ts.sh"
    ;;
  py)
    exec "${SCRIPT_DIR}/package-py.sh"
    ;;
  go)
    exec "${SCRIPT_DIR}/package-go.sh"
    ;;
  *)
    echo "Error: unknown language '$LANG' (expected ts|py|go)." >&2
    exit 1
    ;;
esac

