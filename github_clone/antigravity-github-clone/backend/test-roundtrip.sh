#!/usr/bin/env bash
# backend/test-roundtrip.sh
#
# Full round-trip integration test for the Day 5-6 repo lifecycle API.
# Run against a live server:  bash backend/test-roundtrip.sh
#
# Requires: curl, jq (optional — falls back to raw JSON if jq is absent)
# Server must be listening on $BASE_URL (default: http://localhost:3001)

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3001}"
REPO="test-repo"
SEP="──────────────────────────────────────────────────"

# Pretty-print JSON if jq is available, otherwise just echo raw
pretty() {
  if command -v jq &>/dev/null; then
    echo "$1" | jq .
  else
    echo "$1"
  fi
}

# Helper: POST request
#   $1 = endpoint path (e.g. /api/repos/test-repo/init)
#   $2 = JSON body (optional, defaults to '{}')
post() {
  local path="$1"
  local body="${2:-{}}"
  local url="${BASE_URL}${path}"
  local status body_out

  body_out=$(curl -s -w '\n%{http_code}' \
    -X POST \
    -H 'Content-Type: application/json' \
    -d "$body" \
    "$url")

  local response status
  status=$(echo "$body_out" | tail -n1)
  response=$(echo "$body_out" | sed '$d')

  echo "POST $path  →  HTTP $status"
  pretty "$response"
  echo ""
}

# Helper: GET request
#   $1 = endpoint path
get() {
  local path="$1"
  local url="${BASE_URL}${path}"
  local body_out

  body_out=$(curl -s -w '\n%{http_code}' "$url")

  local response status
  status=$(echo "$body_out" | tail -n1)
  response=$(echo "$body_out" | sed '$d')

  echo "GET  $path  →  HTTP $status"
  pretty "$response"
  echo ""
}

echo "$SEP"
echo "  VRel — Round-trip Integration Test"
echo "  Server: $BASE_URL"
echo "$SEP"
echo ""

# ── Step 1: Init repo ──────────────────────────────────────────────────────────
echo "[ 1 ] Init repo '$REPO'"
post "/api/repos/${REPO}/init"

# ── Step 2: Stage src/hello.js ────────────────────────────────────────────────
echo "[ 2 ] git add src/hello.js"
post "/api/repos/${REPO}/add" \
  '{"filepath":"src/hello.js","content":"console.log('"'"'hello world'"'"');"}'

# ── Step 3: Stage src/index.js ────────────────────────────────────────────────
echo "[ 3 ] git add src/index.js"
post "/api/repos/${REPO}/add" \
  '{"filepath":"src/index.js","content":"import '"'"'./hello.js'"'"';"}'

# ── Step 4: First commit ───────────────────────────────────────────────────────
echo "[ 4 ] git commit -m 'initial commit'"
post "/api/repos/${REPO}/commit" \
  '{"author":"Prabhaharan","message":"initial commit"}'

# ── Step 5: Stage src/utils.js ────────────────────────────────────────────────
echo "[ 5 ] git add src/utils.js"
post "/api/repos/${REPO}/add" \
  '{"filepath":"src/utils.js","content":"export const add = (a,b) => a+b;"}'

# ── Step 6: Second commit ─────────────────────────────────────────────────────
echo "[ 6 ] git commit -m 'add utils'"
post "/api/repos/${REPO}/commit" \
  '{"author":"Prabhaharan","message":"add utils"}'

# ── Step 7: git log ───────────────────────────────────────────────────────────
echo "[ 7 ] git log"
get "/api/repos/${REPO}/log"

# ── Step 8: git status ────────────────────────────────────────────────────────
echo "[ 8 ] git status"
get "/api/repos/${REPO}/status"

echo "$SEP"
echo "  Round-trip complete."
echo "$SEP"
