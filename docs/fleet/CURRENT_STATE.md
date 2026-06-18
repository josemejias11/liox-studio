# Current Project State (Working Memory / "RAM")

> Rewritten by `/commit`, re-read by `/standup`. Keep it short — pointers, not
> copies. Reference task briefs by path; don't inline them.

## Active Phase
Content entry + RAG eval on real corpus (post-visual-polish)

## 1. What Was Just Completed (last ~5 — prune older)
Fleet Health: fleet: ✓ engine ok · 12 run(s) · last pass · $0.3163608

* fix(player): `weakTopics` in `MotoViewer.tsx` — replaced synchronous `setWeakTopics()` inside `useEffect` with a derived `useMemo` merging `sessionWeakTopics` + `apiWeakTopics`. Eliminates `react-hooks/set-state-in-effect` lint error. (`66d95f1`, `dev`)
* TASK-0010 done: Restored premium visual effects with GPU layer promotion — `filter: blur(6px)` + `willChange: 'transform, opacity, filter'` on entrance wrapper; `blur-sm` restored to visited hotspot halo.
* TASK-0009 done: Performance + motion polish — GPU-composited ambient glow, `font-display: optional`, loading skeletons, asymmetric panel timing, `revalidate: 300` on Sanity fetch.
* TASK-0007 done: Hotspot positioning accuracy — 16:9 CMS preview, ResizeObserver for image bounds in `ProductStage.tsx`, `sanityImageLoader` + `sizes` on product `<Image>`.
* TASK-0006 done: Clean-slate reset — Postgres wiped, 15 Sanity docs deleted, ChromaDB wiped. `reset-all.sh` handles all three layers idempotently.

## 2. Immediate Next Priority (the one active task)
* Author fresh Sanity content (Motorola Qira course) — Sanity is empty from TASK-0006, hotspot positioning is fixed from TASK-0007. Then run `/route` to brief **RAG eval on real corpus** using `parser-service/eval/`.

## 3. Open Blockers / Known Issues
* ChromaDB is empty — parser-service will recreate `chroma_db/` on next upload.
* No content in Sanity — must author a course before RAG eval is meaningful.

## 4. Recent Architectural Decisions (ADRs)
* **`weakTopics` pattern:** never set state synchronously inside `useEffect`. Derive via `useMemo` instead; only call `setState` in async callbacks. (`react-hooks/set-state-in-effect`)
* **CSS perf routing rule:** route performance reviews to `systems-performance-engineer` (profiling) BEFORE `web-engineer` removes visual effects. Stripping effects without profiling data is wrong by default.
* **`filter` + compositor layer = GPU-composited:** `filter` on an element with `transform` / `will-change: transform` runs on the GPU. Add `will-change: transform, opacity, filter` — never remove the filter.
* **`background-position` is never GPU-composited:** `dynamic-gradient` on `bg-glass-gradient` stays removed. Static gradient is correct.
* **ProductStage hotspot positioning:** ResizeObserver on image wrapper, bounds measured relative to `containerRef`. `imageRect === null` SSR fallback to full-container.
* `reset-all.sh` is the canonical one-command reset — loads `web/.env` + `web/.env.local`, runs tsx scripts, then `rm -rf parser-service/chroma_db`.
* RAG tuning is eval-gated: tunable changes must beat recorded baseline on `parser-service/eval/`.

---
**Agent instruction:** on `/commit`, move done work into §1, prune §1 to ~5
items, set §2 to the next task. This is a rolling window, never an append log.
