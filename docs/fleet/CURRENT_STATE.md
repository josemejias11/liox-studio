# Current Project State (Working Memory / "RAM")

> Rewritten by `/commit`, re-read by `/standup`. Keep it short — pointers, not
> copies. Reference task briefs by path; don't inline them.

## Active Phase
RAG chat quality — eval harness landed; baseline saturates synthetic corpus

## 1. What Was Just Completed (last ~5 — prune older)
* TASK-0001 done & verified: RAG eval harness (`parser-service/eval/`) + env-configurable tunables (`RETRIEVAL_K_CHAT`/`CHUNK_SIZE`/`CHUNK_OVERLAP`); no config beat baseline so defaults kept; 44 tests pass; results in `docs/tasks/TASK-0001-results.md`. NOT yet committed.
* Extracted player into `src/player/` with a lesson-type registry (`1605cb3`)
* Fixed scroll-story sticky hero height `h-full → h-screen` (`919756b`)
* Removed nav lock and fixed scroll rendering in `LessonFrame` (`b50d50f`)
* Migrated analytics guard from deprecated middleware to proxy convention (`a7b5e26`)

## 2. Immediate Next Priority (the one active task)
* TBD — run `/route` to set it. Candidate (from TASK-0001 results): re-run the eval harness against a real production Sanity-sourced corpus, where chunk size is the likeliest knob to actually move quality.

## 3. Open Blockers / Known Issues
* none (the 2026-06-15 session-limit failure is resolved — re-forge succeeded)

## 4. Recent Architectural Decisions (ADRs)
* RAG tuning is now eval-gated: tunable changes must beat a recorded baseline on `parser-service/eval/` without lowering faithfulness/refusal rate (TASK-0001). Defaults stay env-configurable.
* Player rendering now keyed off a lesson-type registry in `src/player/` (see `1605cb3`) — new lesson types register there.

---
**Agent instruction:** on `/commit`, move done work into §1, prune §1 to ~5
items, set §2 to the next task. This is a rolling window, never an append log.
