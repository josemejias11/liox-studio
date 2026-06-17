#!/usr/bin/env bash
# reset-all.sh — wipe all three persistence layers to a clean slate
# Usage: bash reset-all.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load env from web/ so the TypeScript scripts have DB + Sanity credentials
set -a
# shellcheck disable=SC1091
[[ -f "$REPO_ROOT/web/.env" ]]       && source "$REPO_ROOT/web/.env"
[[ -f "$REPO_ROOT/web/.env.local" ]] && source "$REPO_ROOT/web/.env.local"
set +a

echo "=== 1/3  Postgres reset ==="
npx tsx "$REPO_ROOT/web/scripts/reset-db.ts"

echo ""
echo "=== 2/3  Sanity content wipe ==="
npx tsx "$REPO_ROOT/web/scripts/reset-sanity.ts"

echo ""
echo "=== 3/3  ChromaDB wipe ==="
CHROMA_DIR="$REPO_ROOT/parser-service/chroma_db"
if [[ -d "$CHROMA_DIR" ]]; then
  rm -rf "$CHROMA_DIR"
  echo "✓ parser-service/chroma_db deleted"
else
  echo "  (parser-service/chroma_db not found — already clean)"
fi

echo ""
echo "Clean slate achieved. All three persistence layers are now empty."
