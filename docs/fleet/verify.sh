#!/usr/bin/env bash
#
# verify.sh — this project's verification gate.
#
# run_agent runs this after every /forge; a task only counts as done if this
# exits 0. These are the same checks CLAUDE.md requires before any commit.
# Keep it fast and deterministic. Exits non-zero on the first failure.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

echo "── verify: web typecheck + unit tests"
( cd "${repo_root}/web" && npm run typecheck && npm run test )

if [ -d "${repo_root}/parser-service" ]; then
  echo "── verify: parser-service pytest"
  cd "${repo_root}/parser-service"
  if [ -x venv/bin/pytest ]; then
    venv/bin/pytest -q
  else
    python3 -m pytest -q
  fi
fi
