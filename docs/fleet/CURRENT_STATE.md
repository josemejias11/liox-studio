# Current Project State (Working Memory / "RAM")

> Rewritten by `/commit`, re-read by `/standup`. Keep it short — pointers, not
> copies. Reference task briefs by path; don't inline them.

## Active Phase
Fleet health hardening + RAG eval on real corpus

## 1. What Was Just Completed (last ~5 — prune older)
* TASK-0004 done & verified: python-dotenv support added to parser-service — `python main.py` loads token from `.env` without shell export; `cp .env.example .env` is the one-time setup step. (`b9b5bec`)
* PORT → PARSER_PORT rename: ambient `PORT=9000` (Node) was overriding the default 8000; scoped to `PARSER_PORT` so Node/Heroku tooling can't interfere. (`de910a6`)
* TASK-0003 done & verified: `parser-service/run.sh` + `__main__` port guard — blocks privileged ports (< 1024), CLAUDE.md and README updated to `python main.py`. (`fe25f83`)
* README.md updated: Step 2 startup instructions reflect dotenv workflow, `PARSER_PORT` override documented. (`7e1c504`)
* Fleet verify gate wired: `docs/fleet/verify.sh` runs web typecheck+test and parser-service pytest. (`e9a4f1f`)

## 2. Immediate Next Priority (the one active task)
* Run `/route` to brief **RAG eval on real corpus** — re-run `parser-service/eval/` against production Sanity content; chunk size is the likeliest quality knob (deferred from TASK-0001). Parser service is now stable enough to support this work.

## 3. Open Blockers / Known Issues
* none

## 4. Recent Architectural Decisions (ADRs)
* `PARSER_PORT` (not `PORT`) is the env var to override the parser service port. `PORT` is ambient in Node/Heroku environments and must never be used for this service.
* python-dotenv loads with `override=False` — shell exports always win over the `.env` file. This means `PARSER_SERVICE_TOKEN=x python main.py` still works without editing the file.
* RAG tuning is eval-gated: tunable changes must beat a recorded baseline on `parser-service/eval/` without lowering faithfulness/refusal rate (TASK-0001). Defaults stay env-configurable.
* Player rendering now keyed off a lesson-type registry in `src/player/` — new lesson types register there.

---
**Agent instruction:** on `/commit`, move done work into §1, prune §1 to ~5
items, set §2 to the next task. This is a rolling window, never an append log.
