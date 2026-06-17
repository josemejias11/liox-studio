# Current Project State (Working Memory / "RAM")

> Rewritten by `/commit`, re-read by `/standup`. Keep it short — pointers, not
> copies. Reference task briefs by path; don't inline them.

## Active Phase
RAG eval on real corpus (post-clean-slate)

## 1. What Was Just Completed (last ~5 — prune older)
* TASK-0006 done: clean-slate reset — 18 sessions / 149 analytics rows wiped from Postgres; 15 Sanity docs deleted; ChromaDB wiped. `reset-all.sh` (repo root) handles all three layers idempotently. (`dev` branch)
* `web/scripts/reset-db.ts` + `web/scripts/reset-sanity.ts` created; typecheck + vitest (5/5) pass.
* `web/.gitignore` updated: `/tmp/` added.
* TASK-0005 done & verified: Sanity CMS health check — all 7 checks pass. (`c3eb894`)
* `web/sanity.cli.ts` created — unblocks CLI tooling. (`c3eb894`)

## 2. Immediate Next Priority (the one active task)
* Run `/route` to brief **RAG eval on real corpus** — author fresh Sanity content first (Motorola Qira course), then re-run `parser-service/eval/` to baseline chunk quality.

## 3. Open Blockers / Known Issues
* QA agent deleted `CLAUDE.md` during TASK-0005 run (restored). Consider scoping forge write permissions.
* ChromaDB is now empty — parser-service will recreate `chroma_db/` on next upload.

## 4. Recent Architectural Decisions (ADRs)
* `reset-all.sh` is the canonical one-command reset — loads `web/.env` + `web/.env.local`, runs tsx scripts, then `rm -rf parser-service/chroma_db`.
* `sanity.cli.ts` lives at `web/sanity.cli.ts` (not repo root) — Sanity CLI must be run from `web/`.
* `PARSER_PORT` (not `PORT`) is the env var to override the parser service port.
* RAG tuning is eval-gated: tunable changes must beat recorded baseline on `parser-service/eval/`.

---
**Agent instruction:** on `/commit`, move done work into §1, prune §1 to ~5
items, set §2 to the next task. This is a rolling window, never an append log.