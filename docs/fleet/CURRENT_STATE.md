# Current Project State (Working Memory / "RAM")

> Rewritten by `/commit`, re-read by `/standup`. Keep it short — pointers, not
> copies. Reference task briefs by path; don't inline them.

## Active Phase
Scroll-story lesson polish — background rendering fixed; player UI bugs being cleared

## 1. What Was Just Completed (last ~5 — prune older)
* Fleet verify gate wired: project `docs/fleet/verify.sh` now runs web `typecheck`+`test` and parser-service pytest (was the `exit 3` stub that disabled `/forge` self-verification). Confirmed via `bin/verify.sh` → exit 0 (web 5/5, parser 44 passed).
* TASK-0002 done & verified: scroll-story background images now render — hero moved off `-z-10` to `z-0` with `bg-background` relocated onto it (opaque track parent was occluding the negative-z layer). typecheck + test pass (5/5). Committed & pushed (`4c04595`).
* TASK-0001 done & verified: RAG eval harness (`parser-service/eval/`) + env-configurable tunables (`RETRIEVAL_K_CHAT`/`CHUNK_SIZE`/`CHUNK_OVERLAP`); no config beat baseline so defaults kept; 44 tests pass; results in `docs/tasks/TASK-0001-results.md` (`5ca5f0a`).
* Extracted player into `src/player/` with a lesson-type registry (`1605cb3`)
* Fixed scroll-story sticky hero height `h-full → h-screen` (`919756b`)
* Removed nav lock and fixed scroll rendering in `LessonFrame` (`b50d50f`)

## 2. Immediate Next Priority (the one active task)
* TBD — run `/route` to set it. Deferred candidate (from TASK-0001 results): re-run the eval harness against a real production Sanity-sourced corpus, where chunk size is the likeliest knob to move quality.

## 3. Open Blockers / Known Issues
* none

## 4. Recent Architectural Decisions (ADRs)
* RAG tuning is now eval-gated: tunable changes must beat a recorded baseline on `parser-service/eval/` without lowering faithfulness/refusal rate (TASK-0001). Defaults stay env-configurable.
* Player rendering now keyed off a lesson-type registry in `src/player/` (see `1605cb3`) — new lesson types register there.

---
**Agent instruction:** on `/commit`, move done work into §1, prune §1 to ~5
items, set §2 to the next task. This is a rolling window, never an append log.
