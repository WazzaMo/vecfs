#!/usr/bin/env bash
# validate-store.sh — Report health metrics for a VecFS JSONL data file.
#
# Usage:
#   ./validate-store.sh [path-to-file]
#
# Defaults to VECFS_FILE or ./vecfs-data.jsonl if no argument is given.

set -euo pipefail

FILE="${1:-${VECFS_FILE:-./vecfs-data.jsonl}}"

if [ ! -f "$FILE" ]; then
  echo "Error: file not found: $FILE" >&2
  exit 1
fi

TOTAL=$(wc -l < "$FILE" | tr -d ' ')

if [ "$TOTAL" -eq 0 ]; then
  echo "Store is empty: $FILE"
  exit 0
fi

echo "VecFS Store Health Report"
echo "========================="
echo "File:    $FILE"
echo "Entries: $TOTAL"
echo ""

# Average sparsity (non-zero dimensions per vector)
AVG_DIMS=$(python3 -c "
import json, sys
dims = []
with open('$FILE') as f:
    for line in f:
        line = line.strip()
        if not line:
            continue
        entry = json.loads(line)
        vec = entry.get('vector', {})
        dims.append(len(vec))
if dims:
    print(f'{sum(dims)/len(dims):.1f}')
else:
    print('0')
" 2>/dev/null || echo "N/A")
echo "Avg dimensions per vector: $AVG_DIMS"

# Score distribution
python3 -c "
import json, sys
scores = []
with open('$FILE') as f:
    for line in f:
        line = line.strip()
        if not line:
            continue
        entry = json.loads(line)
        scores.append(entry.get('score', 0))
if not scores:
    sys.exit(0)
scores.sort()
print(f'Score range:  {scores[0]:+.1f} to {scores[-1]:+.1f}')
print(f'Mean score:   {sum(scores)/len(scores):+.2f}')
high = [s for s in scores if s >= 3]
low = [s for s in scores if s <= -3]
if high:
    print(f'High scorers (>= +3): {len(high)}')
if low:
    print(f'Low scorers  (<= -3): {len(low)}')
" 2>/dev/null || echo "Score analysis: N/A (requires python3)"
