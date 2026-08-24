make a plan to work on# TypeScript monorepo cleanup

Date: 2026-08-20
Status: Approved, ready for implementation plan

## Context

The TypeScript side of this repo (`apps/web`, `apps/job-worker`,
`packages/contracts`, `packages/database`, `packages/jobs`,
`packages/parser-client`) has grown through many incremental changes
without a dedicated tidy pass. This is general housekeeping, not a
response to a specific incident.

`services/parser-service` (Python/FastAPI) is explicitly **out of
scope** for this pass — different toolchain, different pass if wanted
later.

A read-only audit (lint/typecheck baseline both clean; `knip` run for
unused-export detection) produced concrete, file-level findings. This
spec turns those findings into a scoped plan.

## Goals

- Remove dead code and unused exports.
- Consolidate duplicated fetch/error-handling logic.
- Fix formatting drift (82 of ~165 files currently fail
  `prettier --check`).
- Improve directory placement for a couple of clearly misplaced files.
- Split the two most oversized/mixed-concern files using a pattern
  that already exists elsewhere in the codebase.
- Along the way, fix small obviously-wrong/inconsistent bits of logic
  encountered incidentally (per user direction) — this is not a
  license to go looking for bugs beyond what's touched by the above.

## Non-goals

- No behavior changes to features, APIs, or the database schema.
- No new test infrastructure (none exists on the TS side today; out of
  scope for this pass).
- No changes to `services/parser-service`.
- No changes to `scripts/seed-moto-g87-course.ts` — confirmed by user
  to be intentionally kept as-is (pending a demo), despite looking like
  dead code (unwired to any npm script, hardcoded personal path).
- No speculative refactors beyond what the audit actually found (e.g.
  `lesson-draft.ts` and `ProductStage.tsx` are large but have no clean
  split identified — left alone).

## Decisions

- **`cn()` helper** (`apps/web/src/shared/utils.ts`): delete it, along
  with its two now-unused backing dependencies `clsx` and
  `tailwind-merge` in `apps/web/package.json`. The ~97 existing
  hand-built conditional-classNames sites are left as-is — not
  migrated to a helper that no longer exists.
- **`scripts/seed-moto-g87-course.ts`**: untouched. Not part of this
  cleanup.

## Plan

Five phases, each its own commit directly on the current branch
(`stg`), in order. Each phase ends with `npm run lint &&
npm run typecheck` passing before committing (there is no TS-side test
suite to run).

### Phase 1 — Formatting

Run `npm run format` (prettier --write) across the repo. Purely
mechanical; no hand-editing. One commit.

### Phase 2 — Dead code removal

- Delete `apps/web/src/learning/server/revision-sources.ts` (verified
  fully unreferenced).
- Delete the dead `InlineDiscoveryCue` function/export from
  `apps/web/src/learning/player/lesson-types/InlineDiscoveryCue.tsx`
  (its siblings `InlineDiscoveryCueMark`,
  `InlineDiscoveryCueProvider`, `InlineDiscoveryCueResolver` stay —
  they're used elsewhere).
- Delete `cn()` from `apps/web/src/shared/utils.ts`; remove `clsx` and
  `tailwind-merge` from `apps/web/package.json` (and lockfile).
- Drop the dead re-export block in
  `packages/database/src/course-repository.ts:9-17` (re-exports of
  `@moto-ai/contracts/course-studio` symbols that nothing imports via
  `@moto-ai/database`).
- Work through the ~14 knip-flagged "unused export" candidates
  individually:
  - Where the export is used only within its own file (e.g. passed to
    a local `useReducer`, or composed into another exported schema in
    the same file), drop the superfluous `export` keyword — do not
    delete the code.
  - Where the export truly has zero usages anywhere, delete it.
  - This needs a human/agent judgment call per item, not a blind
    sweep — verify each with a grep before acting.

### Phase 3 — Directory structure

- Move `apps/web/src/components/` (`DiscoveryPanel.tsx`,
  `PhotoCardStack.tsx`, `discovery/DiscoveryLearnContent.tsx`) into
  `apps/web/src/learning/player/discovery/`, since every consumer is
  under `learning/player/lesson-types/` — this is Moto-Player-only UI,
  not cross-surface shared UI. Update all imports.
- Rename `apps/web/src/shared/contracts/course-studio.ts` →
  `apps/web/src/shared/contracts/course-settings.ts` to match its
  actual content (client-side authoring form schemas for
  cover/specs/disclaimer/settings) and stop colliding by name with
  `packages/contracts/src/course-studio.ts` (cross-workspace
  course-graph types). Update all imports.

### Phase 4 — Duplication cleanup

Extract one shared `fetchJson<T>(url, init, fallbackMessage)` helper,
modeled on the existing private `mutate()` in
`apps/web/src/authoring/studio-client.ts:27`, into an appropriate
shared location (e.g. alongside `apps/web/src/shared/server/http.ts`
or a new `apps/web/src/shared/http-client.ts` — exact placement
decided during implementation, keeping client-safe code out of any
`server/` directory).

Migrate the following call sites to use it, preserving each site's
existing fallback error message and response handling:

- `authoring/RevisionPanel.tsx` (3 call sites, ~lines 115, 139, 163)
- `authoring/AssistantQaPanel.tsx` (3 call sites, ~lines 14, 20, 25, 28)
- `authoring/CreateWithAiDialog.tsx`
- `authoring/SourcePanel.tsx`
- `authoring/GenerationStatusPanel.tsx`
- `authoring/inspectors/CourseMediaField.tsx`
- `authoring/inspectors/LessonInspector.tsx`
- `authoring/inspectors/lesson/AssetCollectionField.tsx`
- `review/ReviewFeedbackPanel.tsx` (~line 29)
- `learning/player/lesson-types/CourseQuizPlayer.tsx`
- `learning/player/hooks/useLessonProgress.ts`

### Phase 5 — Split oversized files

- `apps/web/src/authoring/inspectors/CourseInspector.tsx` (709 lines):
  extract the ~7 pure draft/validation helper functions
  (`objectiveDrafts`, `coverDraft`, `disclaimerDraft`, `formDraft`,
  `formFingerprint`, `formPayload`, `errorMap`; ~lines 84-199) into a
  sibling `course-inspector-draft.ts`, mirroring the existing
  `authoring/inspectors/lesson/lesson-draft.ts` pattern for the same
  problem.
- `apps/web/src/learning/player/lesson-types/CourseQuizPlayer.tsx`
  (580 lines): extract `CourseFinalAssessmentCard` (~line 494, 86
  lines) into its own file, matching the one-component-per-file
  convention already used by every other file in `lesson-types/`.

## Explicitly out of scope for this pass

- `apps/web/src/authoring/inspectors/lesson/lesson-draft.ts` (504
  lines) — large but cohesive; no clear split point identified.
- `apps/web/src/learning/player/lesson-types/ProductStage.tsx` (510
  lines) — large; needs closer reading before any structural change is
  proposed, not attempted here.
- The `server/` logic split across `authoring/server/`,
  `learning/server/`, `review/server/`, `shared/server/`, and the
  top-level `server/` — matches the pattern already documented in
  `CLAUDE.md`; not a smell, no action.
- `services/parser-service` (Python) — separate toolchain, separate
  pass if wanted.
- `scripts/seed-moto-g87-course.ts` — kept as-is per user direction.

## Verification

- After every phase: `npm run lint` and `npm run typecheck` must both
  pass clean before committing.
- Phase 4 and 5 touch runtime logic (import paths, extracted
  functions) — after these phases, manually sanity-check the affected
  surfaces run (`npm run dev`, exercise the Studio authoring flows and
  the affected quiz/discovery lesson types in the player) since there
  is no automated test suite to catch a broken extraction.
- No behavior change is expected in any phase; if a fix along the way
  (per the "fix small things too" direction) does change behavior,
  call it out explicitly in that phase's commit message.

## Risks

- Phase 4 (fetch helper extraction) is the highest-risk phase: each of
  the 11 call sites has its own fallback error message and slightly
  different response shape handling. The generic helper must not
  silently change what error message a user sees on failure.
- Phase 3 renames/moves require updating every importer; a missed
  import is a build-time TypeScript error, not a silent bug, so
  `npm run typecheck` is the safety net.
