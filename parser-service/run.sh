#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-8000}"

if [ "$PORT" -lt 1024 ] 2>/dev/null; then
  echo "ERROR: PORT=$PORT is a privileged port (< 1024). Set PORT to 1024 or higher, or leave it unset to use the default 8000." >&2
  exit 1
fi

exec uvicorn main:app --host 127.0.0.1 --port "$PORT" --reload
