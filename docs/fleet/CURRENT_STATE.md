# Current Project State (Working Memory / "RAM")

> Rewritten by `/commit`, re-read by `/standup`. Keep it short — pointers, not
> copies. Reference task briefs by path; don't inline them.

## Active Phase
Fleet health hardening + RAG eval on real corpus

## 1. What Was Just Completed (last ~5 — prune older)
* Fleet verify gate wired: `docs/fleet/verify.sh` now runs web `typecheck`+`test` and parser-service pytest (was the `exit 3` stub — `/forge` was skipping self-verification). `bin/verify.sh` → exit 0 confirmed. Committed & pushed (`e9a4f1f`).
* TASK-0002 done & verified: scroll-story background images now render — hero moved off `-z-10` to `z-0`; opaque track parent was occluding the negative-z layer. (`4c04595`)
* TASK-0001 done & verified: RAG eval harness + env-configurable tunables; no config beat baseline so defaults kept; 44 tests pass; results in `docs/tasks/TASK-0001-results.md`. (`5ca5f0a`)
* Extracted player into `src/player/` with a lesson-type registry (`1605cb3`)
* Fixed scroll-story sticky hero height `h-full → h-screen` (`919756b`)

## 2. Immediate Next Priority (the one active task)
* Run `/route` to choose between two candidates:
  1. **RAG eval on real corpus** — re-run `parser-service/eval/` against production Sanity content; chunk size is the likeliest quality knob (deferred from TASK-0001).
  2. **Fleet workflow hardening** — wire fleet health signal into `/standup`, enforce concrete §2 at `/commit` time, and commit `/route` briefs as `TASK-NNNN.md` before work starts (surfaced this session).

## 3. Open Blockers / Known Issues
* none

## 4. Recent Architectural Decisions (ADRs)
* RAG tuning is now eval-gated: tunable changes must beat a recorded baseline on `parser-service/eval/` without lowering faithfulness/refusal rate (TASK-0001). Defaults stay env-configurable.
* Player rendering now keyed off a lesson-type registry in `src/player/` (see `1605cb3`) — new lesson types register there.
* Fleet verify gate is now active: `docs/fleet/verify.sh` is the authoritative gate; exit 3 = unconfigured, exit 0 = pass. Project-specific — not a fleet-engine change.

---
**Agent instruction:** on `/commit`, move done work into §1, prune §1 to ~5
items, set §2 to the next task. This is a rolling window, never an append log.
