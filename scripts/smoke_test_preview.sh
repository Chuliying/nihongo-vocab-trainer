#!/usr/bin/env bash
# T07 smoke test — run against a preview or production URL
# Usage: ./scripts/smoke_test_preview.sh https://your-preview-url.vercel.app
set -euo pipefail

BASE="${1:-}"
if [ -z "$BASE" ]; then
  echo "Usage: $0 <base-url>" >&2
  exit 1
fi

pass=0
fail=0

check() {
  local name="$1"
  local url="$2"
  local expect="$3"   # jq expression that should return "true"
  
  local body
  body=$(curl -sf "$url" 2>/dev/null) || { echo "FAIL [$name] — request failed"; ((fail++)); return; }
  
  local result
  result=$(echo "$body" | python3 -c "
import sys, json
data = json.load(sys.stdin)
$expect
" 2>/dev/null) || { echo "FAIL [$name] — parse/assertion error"; ((fail++)); return; }
  
  if [ "$result" = "True" ]; then
    echo "PASS [$name]"
    ((pass++))
  else
    echo "FAIL [$name] — assertion returned: $result"
    ((fail++))
  fi
}

echo "=== Smoke test: $BASE ==="

# /api/vocab-index — should return a dict with 13000 entries
check "vocab-index count" \
  "$BASE/api/vocab-index" \
  "print(len(data) == 13000)"

# /api/vocab-index — spot check: id 1 maps to tranche 1
check "vocab-index spot" \
  "$BASE/api/vocab-index" \
  "print(data.get('1') == 1)"

# /api/tranche/1 — should return 1000 entries
check "tranche-1 count" \
  "$BASE/api/tranche/1" \
  "print(len(data) == 1000)"

# /api/tranche/1 — first entry has required fields
check "tranche-1 fields" \
  "$BASE/api/tranche/1" \
  "e=data[0]; print(all(k in e for k in ['id','word','reading','meaning','example','jlpt_level']))"

# /api/tranche/1 — example key order: japanese before reading before chinese
check "tranche-1 example-key-order" \
  "$BASE/api/tranche/1" \
  "e=data[0]['example']; keys=list(e.keys()); print(keys == ['japanese','reading','chinese'])"

# /api/tranche/13 — last tranche, 1000 entries
check "tranche-13 count" \
  "$BASE/api/tranche/13" \
  "print(len(data) == 1000)"

# /api/popular-verbs — exactly 300 entries
check "popular-verbs count" \
  "$BASE/api/popular-verbs" \
  "print(len(data) == 300)"

# /api/popular-verbs — ordered by frequency_rank ascending
check "popular-verbs ordering" \
  "$BASE/api/popular-verbs" \
  "ranks=[e['frequency_rank'] for e in data]; print(ranks == sorted(ranks))"

echo ""
echo "=== Results: $pass passed, $fail failed ==="
[ "$fail" -eq 0 ]
