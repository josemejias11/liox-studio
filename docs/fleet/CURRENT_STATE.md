# Current Project State (Working Memory / "RAM")

> Rewritten by `/commit`, re-read by `/standup`. Keep it short — pointers, not
> copies. Reference task briefs by path; don't inline them.

## Active Phase
Fleet health hardening + RAG eval on real corpus

## 1. What Was Just Completed (last ~5 — prune older)
* Fleet Health: `fleet: ✓ engine ok · 6 run(s) · last pass · $0.71` (last `/commit`)
* TASK-0005 done & verified: Sanity CMS health check — all 7 checks pass (env vars, live GROQ round-trip, GROQ↔Zod parity, lessonType enum sync, QUIZ_GRADING_QUERY isolation, schema deployment, typecheck). (`c3eb894`)
* `web/sanity.cli.ts` created — unblocks CLI tooling (`sanity schema extract`, `sanity dataset export`); confirmed working. (`c3eb894`)
* TASK-0004 done: python-dotenv support in parser-service; .env.example → .env one-time setup. (`b9b5bec`)
* PORT → PARSER_PORT rename to prevent Node/Heroku ambient env collision. (`de910a6`)

## 2. Immediate Next Priority (the one active task)
* Run `/route` to brief **RAG eval on real corpus** — re-run `parser-service/eval/` against production Sanity content ("motorola Qira", 3 chapters); chunk size is the likeliest quality knob (deferred from TASK-0001). Parser service is stable; Sanity integration is verified healthy.

## 3. Open Blockers / Known Issues
* QA agent deleted `CLAUDE.md` during TASK-0005 run (restored from HEAD before commit). Root cause: agent had write permissions to the repo root. Consider scoping forge permissions or adding a git pre-commit guard if this recurs.
* `web/tmp/` directory created by agent (sanity schema extract output) — untracked, safe to add to `.gitignore`.

## 4. Recent Architectural Decisions (ADRs)
* `sanity.cli.ts` lives at `web/sanity.cli.ts` (not repo root) — Sanity CLI must be run from `web/`.
* `PARSER_PORT` (not `PORT`) is the env var to override the parser service port.
* python-dotenv loads with `override=False` — shell exports always win over the `.env` file.
* RAG tuning is eval-gated: tunable changes must beat a recorded baseline on `parser-service/eval/` without lowering faithfulness/refusal rate (TASK-0001).

---
**Agent instruction:** on `/commit`, move done work into §1, prune §1 to ~5
items, set §2 to the next task. This is a rolling window, never an append log.