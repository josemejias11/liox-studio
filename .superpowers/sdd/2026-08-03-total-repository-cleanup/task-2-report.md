# Task 2 Report: Web feature-boundary move

## Implementation

- Moved Course Studio UI, inspectors, client state, and authoring source and generation commands to `apps/web/src/authoring`.
- Moved the learner runtime to `apps/web/src/learning/player`; `PlayerViewport` remains the single shared rendering entry point used directly by author preview and frozen review.
- Moved learning runtime helpers, progress persistence, quiz grading, and browser chat transport to learning ownership.
- Moved analytics data access to `analytics/server`, browser-safe contracts and generic presentation/transport helpers to `shared`, and Studio auth/R2 access to `server` infrastructure.
- Deleted the obsolete `AuthoringPreview` re-export, legacy `course-studio`, `player`, `services`, `lib`, and unused Sanity trees. Routes retain their existing URLs and now import their feature or infrastructure owner.

## Commands and observed results

| Command | Result |
| --- | --- |
| `rg -n "from ['\\\"]@/(course-studio|player|review|services|lib)/" apps/web/src` | Captured the pre-move caller checklist. |
| `rg -n "@/(course-studio|player|services|sanity|lib)/" apps/web/src \|\| true` | Exit 0 with no matches after the move. |
| `find apps/web/src -type d -empty \| sort` | Exit 0 with no output after removing obsolete empty directories. |
| `npm run typecheck` | Exit 0; TypeScript checks passed for job-worker, web, contracts, database, jobs, and parser-client. |
| `npm run lint` | Exit 0; ESLint completed for `apps`, `packages`, and `scripts`. |
| `git diff --check` and `git diff --cached --check` | Exit 0 with no whitespace errors. |

No automated tests were added or run, per task constraints.

## Files changed

- `apps/web/src/authoring/**`
- `apps/web/src/learning/**`
- `apps/web/src/review/ReviewPlayer.tsx`
- `apps/web/src/analytics/server/analytics.service.ts`
- `apps/web/src/shared/**`
- `apps/web/src/server/{auth,storage}/**`
- All affected imports under `apps/web/src/app/**`
- Deleted obsolete `apps/web/src/{course-studio,player,services,lib,sanity}/**` paths and the empty legacy app namespaces.

## Self-review

- Confirmed no imports remain to the removed feature roots and no browser component imports Prisma, R2, jobs, or parser clients.
- Confirmed authoring and review both consume `learning/PlayerViewport`, preserving preview and frozen-review rendering behavior without an alias module.
- Preserved existing route locations, route URLs, lesson and progress contracts, and source/revision command behavior; this task only changes module ownership and imports.

## Concerns

- This task has static evidence only. Authenticated Studio persistence, learner progress, and frozen-review browser behavior require the end-to-end verification planned for Task 9.
