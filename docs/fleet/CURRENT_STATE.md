# Current Project State (Working Memory / "RAM")

> Rewritten by `/commit`, re-read by `/standup`. Keep it short — pointers, not
> copies. Reference task briefs by path; don't inline them.

## Active Phase
Content entry + RAG eval on real corpus (post-visual-polish)

## 1. What Was Just Completed (last ~5 — prune older)
Fleet Health: fleet: ✓ engine ok · 14 run(s) · last pass · $0.6022935

* TASK-0012 done: Added `sup` (superscript) decorator to all Portable Text block fields (`lesson.body`, `hotspot.body`, `scrollChapter.body` in `lesson.ts`; `layer.body` in `layer.ts`). Created shared `supMark` in `web/src/lib/portable-text-components.tsx`; wired into all 6 `PortableText` callsites. Schema deployed to Sanity.
* TASK-0011 done: Fixed upload failure — root cause was 401 (missing `analytics_token` cookie). Added `errorReason` to `SessionFileStatus` in `CourseFileUploadInput.tsx`; maps HTTP status codes to readable badge labels.
* docs: Added analytics login requirement to README.md (Studio uploads section); expanded `ARCHITECTURE_MEMORY.md` with dev startup, env vars, auth gate section, and `analytics_token` scope invariant.
* fix(player): `weakTopics` in `MotoViewer.tsx` — replaced synchronous `setWeakTopics()` inside `useEffect` with a derived `useMemo`. Eliminates `react-hooks/set-state-in-effect` lint error.
* TASK-0010 done: Restored premium visual effects with GPU layer promotion — `filter: blur(6px)` + `willChange: 'transform, opacity, filter'` on entrance wrapper.

## 2. Immediate Next Priority (the one active task)
* Author fresh Sanity content (Motorola Qira course) — Sanity is empty from TASK-0006 reset, hotspot positioning is fixed (TASK-0007), uploads now work (TASK-0011), superscript works in editor (TASK-0012). Then run `/route` to brief **RAG eval on real corpus** using `parser-service/eval/`.

## 3. Open Blockers / Known Issues
* ChromaDB is empty — parser-service will recreate `chroma_db/` on next upload.
* No content in Sanity — must author a course before RAG eval is meaningful.
* **Upload prereq:** must visit `http://localhost:3000/analytics/login` (password = `ANALYTICS_PASSWORD`) before Studio uploads work — analytics_token cookie gates the upload route.

## 4. Recent Architectural Decisions (ADRs)
* **Portable Text mark components:** shared mark renderers live in `web/src/lib/portable-text-components.tsx` (e.g., `supMark`). Import from there; do not inline mark components at callsites.
* **Portable Text decorators — always list defaults:** when adding `marks.decorators` to a `type: 'block'` field that previously omitted it, the full default set must be listed (strong, em, underline, strike-through, code) plus any additions — omitting `decorators` uses Sanity defaults; adding it overrides them entirely.
* **analytics_token scope:** gates both `/analytics` dashboard pages AND `POST /api/upload` + `DELETE /api/upload`. Do not remove the auth gate from the upload route.
* **`weakTopics` pattern:** never set state synchronously inside `useEffect`. Derive via `useMemo` instead; only call `setState` in async callbacks.
* **CSS perf routing rule:** route performance reviews to `systems-performance-engineer` (profiling) BEFORE `web-engineer` removes visual effects. Stripping effects without profiling data is wrong by default.
* `reset-all.sh` is the canonical one-command reset — loads `web/.env` + `web/.env.local`, runs tsx scripts, then `rm -rf parser-service/chroma_db`.
* RAG tuning is eval-gated: tunable changes must beat recorded baseline on `parser-service/eval/`.

---
**Agent instruction:** on `/commit`, move done work into §1, prune §1 to ~5
items, set §2 to the next task. This is a rolling window, never an append log.
