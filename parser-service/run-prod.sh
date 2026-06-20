#!/usr/bin/env bash
# Production entry point — no hot-reload, binds to all interfaces.
# Use run.sh for local development (includes --reload).
set -euo pipefail

PARSER_PORT="${PARSER_PORT:-8000}"

if [ "$PARSER_PORT" -lt 1024 ] 2>/dev/null; then
  echo "ERROR: PARSER_PORT=$PARSER_PORT is a privileged port (< 1024). Set PARSER_PORT to 1024 or higher, or leave it unset to use the default 8000." >&2
  exit 1
fi

export ENV=production
exec uvicorn main:app --host 0.0.0.0 --port "$PARSER_PORT" --workers 1
