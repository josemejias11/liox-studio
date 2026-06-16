#!/usr/bin/env bash
#
# verify.sh — this project's verification gate.
#
# run_agent runs this after every /forge; a task only counts as done if this
# exits 0. Make it the same checks you would run before committing by hand.
# Keep it fast and deterministic. Exit non-zero on the first failure.
#
# Edit the commands below to match this project. Examples:
#   cd web && npm run typecheck && npm run test
#   cargo check && cargo test
#   uv run pytest -q && uv run ruff check .
set -euo pipefail

echo "TODO: replace with this project's real checks"
exit 3   # 3 = "no verify configured" — remove once you add real checks above
