# TypeScript Monorepo Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean up the TypeScript side of the Moto AI monorepo (`apps/web`, `apps/job-worker`, `packages/*`) — dead code, duplicated fetch/error-handling logic, unformatted files, a couple of misplaced files, and two oversized components — without changing behavior.

**Architecture:** No architectural change. This is a housekeeping pass: delete verified-dead code, consolidate one real duplication pattern behind a shared helper, move two files/folders to where they're actually used, and split two components using a splitting pattern that already exists elsewhere in the codebase.

**Tech Stack:** TypeScript, Next.js (apps/web), Node (apps/job-worker), Prisma (packages/database), Zod (packages/contracts), ESLint + Prettier, `knip` (unused-export detector, run ad hoc via `npx knip`, not installed as a dependency).

**Spec:** `docs/superpowers/specs/2026-08-20-ts-monorepo-cleanup-design.md`

## Global Constraints

- No behavior changes, except small obviously-wrong/inconsistent fixes encountered incidentally — call these out explicitly in that task's commit message.
- `services/parser-service` (Python) is out of scope — do not touch.
- `scripts/seed-moto-g87-course.ts` is out of scope — do not touch, even though it looks unused (kept intentionally for a pending demo).
- Every task ends with `npm run lint && npm run typecheck` passing clean before committing. There is no TS-side test suite — that is the verification for non-runtime-affecting tasks.
- Tasks that touch runtime logic (Phase 4, Phase 5) additionally require a manual smoke check via `npm run dev` of the affected surface before committing, since there's no automated test to catch a broken extraction.
- Commit directly to the current branch (`stg`) — one commit per task, in task order.
- Every commit message ends with `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

## Deviations from the spec (discovered during planning research)

The spec was written from a sampled audit. Full research for this plan surfaced three corrections, noted here so the gap between spec and plan is visible:

1. **Unused-export count**: the spec said "~14" knip-flagged candidates; a full `npx knip` run found **60** (34 unused exports + 26 unused exported types). Same fix per item (drop `export` keyword vs. delete), just more of them — folded into Phase 2 as Tasks 2.5–2.10 below.
2. **Phase 4 scope**: the spec assumed all 11 files share one duplicated pattern. Full research found only **11 of ~19 fetch call sites** (across 8 of the 11 files) actually share the pattern the shared helper targets; the rest use different control flow (silent no-op on failure, status-only checks, Zod-validated responses) where forcing them into a shared helper would be a behavior change — which the spec's own non-goals rule out. Phase 4 below is scoped to the 11 true matches; the other ~8 call sites are explicitly left alone.
3. **`course-repository.ts` re-export block**: the spec said to drop the whole block (`COURSE_LESSON_TYPES` + 5 re-exported types). Verification found `CourseGraph` (one of the 5 types) is genuinely imported from that exact file by two siblings (`course-review-repository.ts`, `course-trash-repository.ts`). Task 2.3 below keeps that one re-export and drops the other five.

---

## Phase 1 — Formatting

### Task 1.1: Run Prettier across the repo

**Files:**

- Modify: every file `prettier --check` currently fails on (82 of ~165 files, spanning `apps/web`, `apps/job-worker`, `packages/*`) — Prettier decides exactly which, mechanically.

**Interfaces:** None — purely mechanical formatting, no code behavior changes.

- [ ] **Step 1: Confirm current failure count**

Run: `npx prettier --check . 2>&1 | tail -5`
Expected: a summary line reporting the failing-file count (should be around 82; exact number may drift slightly since the audit).

- [ ] **Step 2: Write**

Run: `npm run format`

This runs `prettier --write .` per `package.json`.

- [ ] **Step 3: Verify Prettier is now clean**

Run: `npx prettier --check .`
Expected: exits 0, no files listed.

- [ ] **Step 4: Verify lint and typecheck still pass**

Run: `npm run lint && npm run typecheck`
Expected: both exit 0 clean (formatting-only changes should never affect either).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
style: run prettier across the repo

Mechanical formatting only, no behavior change. First step of the
TS-monorepo cleanup pass (docs/superpowers/plans/2026-08-20-ts-monorepo-cleanup.md).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2 — Dead code removal

### Task 2.1: Delete the fully-unreferenced `revision-sources.ts`

**Files:**

- Delete: `apps/web/src/learning/server/revision-sources.ts`

**Interfaces:** None. `resolveRevisionSources` (the file's only export) has zero references anywhere in the repo — verified by grep during the audit.

- [ ] **Step 1: Re-verify zero references** (files move around between audit and execution — cheap to re-check)

Run: `grep -rn "revision-sources\|resolveRevisionSources" apps packages --include="*.ts" --include="*.tsx" | grep -v "learning/server/revision-sources.ts"`
Expected: no output.

- [ ] **Step 2: Delete the file**

```bash
rm apps/web/src/learning/server/revision-sources.ts
```

- [ ] **Step 3: Verify**

Run: `npm run lint && npm run typecheck`
Expected: both clean.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore: remove unreferenced revision-sources.ts

resolveRevisionSources had zero call sites anywhere in the repo.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

### Task 2.2: Clean up `InlineDiscoveryCue.tsx`

**Files:**

- Modify: `apps/web/src/learning/player/lesson-types/InlineDiscoveryCue.tsx`

**Interfaces:**

- Produces: `InlineDiscoveryCueMark`, `InlineDiscoveryCueProvider`, `InlineDiscoveryCueResolver` (type), `InlineDiscoveryCueValue` (no longer exported, but still used internally to build the exported `InlineDiscoveryCueResolver` type) — all unchanged, still consumed by 6 other lesson-type files.

Three edits in this one file:

1. Delete the dead `InlineDiscoveryCue` function (lines 54–92 as currently numbered — the component itself, not its siblings `InlineDiscoveryCueMark`/`Provider`/`Resolver` which stay).
2. Delete the now-dead `InlineDiscoveryCueProps` interface (lines 7–13) — its only use was as the deleted function's parameter type.
3. Remove the `export` keyword from `InlineDiscoveryCueValue` (line 15) — it has no external importers, but stays as the return-type building block of the still-exported `InlineDiscoveryCueResolver` type at line 22.

- [ ] **Step 1: Re-verify `InlineDiscoveryCue` (the function) has zero external references**

Run: `grep -rn "InlineDiscoveryCue\b" apps/web/src --include="*.tsx" --include="*.ts" | grep -v "InlineDiscoveryCueMark\|InlineDiscoveryCueProvider\|InlineDiscoveryCueResolver\|InlineDiscoveryCueValue\|InlineDiscoveryCueProps\|InlineDiscoveryCueContext"`
Expected: only hits inside `InlineDiscoveryCue.tsx` itself (the function definition and its use inside `InlineDiscoveryCueMark` at line 51 — that internal use moves with the deletion since the whole function body goes).

- [ ] **Step 2: Edit the file**

Remove the `InlineDiscoveryCueProps` interface:

```ts
export interface InlineDiscoveryCueProps {
  label: string;
  summary?: string;
  visited: boolean;
  onActivate: () => void;
  children: ReactNode;
}
```

Change:

```ts
export interface InlineDiscoveryCueValue {
```

to:

```ts
interface InlineDiscoveryCueValue {
```

Remove the `InlineDiscoveryCue` function (everything from `export function InlineDiscoveryCue({` through its closing `}` at end of file):

```ts
export function InlineDiscoveryCue({
  label,
  summary,
  visited,
  onActivate,
  children,
}: InlineDiscoveryCueProps) {
  const [expanded, setExpanded] = useState(false);

  function activate() {
    onActivate();
    if (summary) setExpanded((value) => !value);
  }

  return (
    <span className="relative mx-1 inline-block">
      <button
        type="button"
        aria-label={`Connect to ${label}`}
        aria-expanded={summary ? expanded : undefined}
        onClick={activate}
        className="pointer-events-auto group/cue inline-flex min-h-11 items-center gap-1 rounded-lg px-1.5 font-semibold text-[#443b86] underline decoration-[#685bc7]/45 decoration-2 underline-offset-4 transition-colors hover:bg-[#685bc7]/8 hover:decoration-[#685bc7] focus-visible:ring-2 focus-visible:ring-[#685bc7] focus-visible:outline-none"
      >
        {children}
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#685bc7] text-white">
          {visited ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
        </span>
      </button>
      {summary && expanded && (
        <span
          role="note"
          className="mt-2 block max-w-md rounded-xl border border-[#685bc7]/15 bg-[#f0eef8] px-4 py-3 text-sm leading-relaxed text-[#514b77] shadow-sm"
        >
          {summary}
        </span>
      )}
    </span>
  );
}
```

- [ ] **Step 3: Update `InlineDiscoveryCueMark`'s reference**

`InlineDiscoveryCueMark` (kept) currently renders `<InlineDiscoveryCue {...cue}>{children}</InlineDiscoveryCue>` — since the component itself is deleted, this becomes unused/broken. Re-inline the JSX that was inside the deleted `InlineDiscoveryCue` function directly into `InlineDiscoveryCueMark`, since `InlineDiscoveryCueMark` was the function's only caller:

```tsx
export const InlineDiscoveryCueMark: PortableTextMarkComponent<{
  _type: 'layerLink';
  linkedLayer?: string;
}> = ({ children, value }) => {
  const resolveLinkedLayer = useContext(InlineDiscoveryCueContext);
  const cue = resolveLinkedLayer?.(value?.linkedLayer);

  if (!cue) return <>{children}</>;

  const { label, summary, visited, onActivate } = cue;
  const [expanded, setExpanded] = useState(false);

  function activate() {
    onActivate();
    if (summary) setExpanded((v) => !v);
  }

  return (
    <span className="relative mx-1 inline-block">
      <button
        type="button"
        aria-label={`Connect to ${label}`}
        aria-expanded={summary ? expanded : undefined}
        onClick={activate}
        className="group/cue pointer-events-auto inline-flex min-h-11 items-center gap-1 rounded-lg px-1.5 font-semibold text-[#443b86] underline decoration-[#685bc7]/45 decoration-2 underline-offset-4 transition-colors hover:bg-[#685bc7]/8 hover:decoration-[#685bc7] focus-visible:ring-2 focus-visible:ring-[#685bc7] focus-visible:outline-none"
      >
        {children}
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#685bc7] text-white">
          {visited ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
        </span>
      </button>
      {summary && expanded && (
        <span
          role="note"
          className="mt-2 block max-w-md rounded-xl border border-[#685bc7]/15 bg-[#f0eef8] px-4 py-3 text-sm leading-relaxed text-[#514b77] shadow-sm"
        >
          {summary}
        </span>
      )}
    </span>
  );
};
```

Note: `useState` is already imported at the top of the file (used previously by the now-deleted function) — no new import needed. Hooks-in-a-component-defined-as-a-`const`-arrow-function is valid React; `InlineDiscoveryCueMark` was already a component (a `PortableTextMarkComponent`), so this is a legal hook call site.

- [ ] **Step 4: Verify**

Run: `npm run lint && npm run typecheck`
Expected: both clean. If ESLint flags the inlined hook usage, check that `InlineDiscoveryCueMark` is still recognized as a component (name starts with a capital letter — it does).

- [ ] **Step 5: Manual smoke check**

Run `npm run dev`, open Course Studio preview or review for a lesson using inline discovery cues (any lesson using `PortableTextComponents` with `layerLink` marks — check `shared/portable-text-components.tsx` for where `InlineDiscoveryCueMark` is wired in), confirm the cue button still renders and expands/collapses its summary.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore: remove dead InlineDiscoveryCue component

The component itself was unreferenced (its siblings InlineDiscoveryCueMark/
Provider/Resolver are what every lesson-type file actually imports). Inlined
its JSX directly into InlineDiscoveryCueMark, its only caller, and dropped
the now-dead InlineDiscoveryCueProps type and the unused export on
InlineDiscoveryCueValue.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

### Task 2.3: Delete `cn()` and its now-unused dependencies

**Files:**

- Modify: `apps/web/src/shared/utils.ts`
- Modify: `apps/web/package.json`

**Interfaces:** None. `cn()` has zero call sites anywhere; `clsx` and `tailwind-merge` are not used for anything else in `apps/web`.

- [ ] **Step 1: Re-verify zero call sites**

Run: `grep -rn "\bcn(" apps/web/src --include="*.tsx" --include="*.ts" | grep -v "shared/utils.ts"`
Expected: no output.

Run: `grep -rln "from 'clsx'\|from \"clsx\"\|from 'tailwind-merge'\|from \"tailwind-merge\"" apps/web/src`
Expected: only `apps/web/src/shared/utils.ts`.

- [ ] **Step 2: Edit `apps/web/src/shared/utils.ts`**

Remove:

```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

from the top of the file, leaving `getSemanticWidthClass`, `titleFromFilename`, `CSS_ASPECT_RATIOS`, and `cssAspectRatio` untouched.

- [ ] **Step 3: Remove the two dependencies**

Run: `npm uninstall clsx tailwind-merge -w @moto-ai/web`

(Confirm the workspace flag matches the package name in `apps/web/package.json` — check its `"name"` field first if `@moto-ai/web` doesn't match.)

- [ ] **Step 4: Verify**

Run: `npm run lint && npm run typecheck`
Expected: both clean.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore: remove unused cn() helper and its dependencies

cn() had zero call sites; clsx and tailwind-merge existed only to back it.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

### Task 2.4: Trim the dead re-export names in `course-repository.ts`

**Files:**

- Modify: `packages/database/src/course-repository.ts:9-18`

**Interfaces:**

- Produces: `CourseGraph` type re-export stays (consumed via `import { ..., type CourseGraph } from './course-repository'` by `packages/database/src/course-review-repository.ts` and `packages/database/src/course-trash-repository.ts`).
- Removed: `COURSE_LESSON_TYPES`, `ChapterInput`, `CourseGraphChapter`, `CourseGraphLesson`, `CourseLessonType`, `LessonInput` re-exports from this file — none of these six are imported from `./course-repository` by anything (verified: the package's public entry point `packages/database/src/index.ts` re-exports `ChapterInput`/`CourseLessonType`/`LessonInput`/`COURSE_LESSON_TYPES`/`CourseGraphChapter`/`CourseGraphLesson` independently, directly from `@moto-ai/contracts/course-studio` — not from this file — so this file's copies are unreachable dead re-exports).

- [ ] **Step 1: Re-verify** (package boundary is subtle — re-check before editing)

Run: `grep -rn "from '\./course-repository'\|from '\.\./course-repository'" packages/database/src/`
Expected: only these lines reference `./course-repository` directly: `course-trash-repository.ts` (imports `getAuthoringCourse`, `CourseGraph`), `course-review-repository.ts` (imports `courseGraphSelect`, `toCourseGraph`, `CourseGraph`), and `index.ts` (imports the repository functions plus `CourseDetailsInput`, `AuthoringCourseSummary` — not the six names being removed here).

- [ ] **Step 2: Edit**

Change:

```ts
export { COURSE_LESSON_TYPES } from '@moto-ai/contracts/course-studio';
export type {
  ChapterInput,
  CourseGraph,
  CourseGraphChapter,
  CourseGraphLesson,
  CourseLessonType,
  LessonInput,
} from '@moto-ai/contracts/course-studio';
```

to:

```ts
export type { CourseGraph } from '@moto-ai/contracts/course-studio';
```

- [ ] **Step 3: Verify**

Run: `npm run lint && npm run typecheck`
Expected: both clean (this touches a shared package — typecheck must pass for `apps/web` and `apps/job-worker` too, which `npm run typecheck` already covers via `--workspaces --if-present`).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore: drop dead re-exports from course-repository.ts

COURSE_LESSON_TYPES, ChapterInput, CourseGraphChapter, CourseGraphLesson,
CourseLessonType, and LessonInput were re-exported from this file but never
imported from it — the package's actual public API (index.ts) re-exports
those same names independently, straight from @moto-ai/contracts. Only
CourseGraph is genuinely consumed via this file (by two sibling repository
modules), so it stays.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

### Task 2.5: Drop-export sweep — analytics, authoring/server, storage, database (8 items, 5 files)

**Files:**

- Modify: `apps/web/src/analytics/server/analytics.service.ts:72,85,138`
- Modify: `apps/web/src/authoring/server/course-commands.ts:28`
- Modify: `apps/web/src/authoring/server/generation-commands.ts:8`
- Modify: `apps/web/src/server/storage/course-assets.ts:47,51`
- Modify: `packages/database/src/course-generation-repository.ts:5`

**Interfaces:** None change — every symbol below is used only within its own file (verified by grep during planning research); this task only removes the `export` keyword, the code itself is untouched.

For each item: locate the declaration at the given line, remove the leading `export ` (keep `default` exports, `const`/`function`/`type`/`interface` keyword, and the rest of the signature exactly as-is).

- [ ] **Step 1: `analytics/server/analytics.service.ts`**
  - Line 72: `export function getLessonEngagement(...)` → `function getLessonEngagement(...)` (used at line 180, `getWeakTopicsForCourse`)
  - Line 85: `export function getAllLessonEngagement(...)` → `function getAllLessonEngagement(...)` (used at line 108, `getAnalyticsData`)
  - Line 138: `export function computeWeakTopics(...)` → `function computeWeakTopics(...)` (used at line 181)

- [ ] **Step 2: `authoring/server/course-commands.ts`**
  - Line 28: `export function serializeCourseTrashItem(...)` → `function serializeCourseTrashItem(...)` (used 4× in-file: lines 83, 84, 119, 131, 138)

- [ ] **Step 3: `authoring/server/generation-commands.ts`**
  - Line 8: `export function toCourseGenerationSummary(...)` → `function toCourseGenerationSummary(...)` (used 3× in-file: lines 60, 70, 74)

- [ ] **Step 4: `server/storage/course-assets.ts`**
  - Line 47: `export function createCourseAssetKey(...)` → `function createCourseAssetKey(...)` (used at line 57)
  - Line 51: `export function courseAssetUrl(...)` → `function courseAssetUrl(...)` (used at line 70)

- [ ] **Step 5: `packages/database/src/course-generation-repository.ts`**
  - Line 5: `export type CourseGenerationStatus = ...` → `type CourseGenerationStatus = ...` (used 3× in-file: lines 29, 44, 45). Distinct from the same-named type Prisma re-exports via `packages/database/src/index.ts:7` — that one is untouched.

- [ ] **Step 6: Verify**

Run: `npm run lint && npm run typecheck`
Expected: both clean.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore: drop superfluous exports (analytics/server/storage/database)

These symbols are only used inside their own file; dropping `export` since
nothing imports them from elsewhere. No behavior change.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

### Task 2.6: Authoring UI drafts sweep (9 items, 5 files)

**Files:**

- Modify: `apps/web/src/authoring/inspectors/lesson/lesson-draft.ts:480,494`
- Modify: `apps/web/src/authoring/inspectors/SpecificationsField.tsx:17,25,66`
- Modify: `apps/web/src/authoring/inspectors/lesson/RepeatableField.tsx:5`
- Modify: `apps/web/src/authoring/RevisionPanel.tsx:6,15`
- Modify: `apps/web/src/authoring/studio-types.ts:3,11`

**Interfaces:** None change to consumers — `mergeImage` deletion removes dead code only (verified zero references repo-wide, including within its own file beyond the definition; its neighbors `imagePayload`/`LessonImageDraft` stay, still used elsewhere in the file). Everything else is drop-export only.

- [ ] **Step 1: `authoring/inspectors/lesson/lesson-draft.ts`**
  - Line 480: `export function layerLinkTargets(...)` → `function layerLinkTargets(...)` (used at line 417, `validateLessonDraft`) — drop-export.
  - Line 494: delete the entire `export function mergeImage(...) { ... }` block — zero references anywhere. Re-run `grep -n "mergeImage" apps/web/src/authoring/inspectors/lesson/lesson-draft.ts` after deleting to confirm no stray references remain in the file.

- [ ] **Step 2: `authoring/inspectors/SpecificationsField.tsx`**
  - Line 17: `export interface SpecificationRowDraft {` → `interface SpecificationRowDraft {` (used throughout file) — drop-export.
  - Line 25: `export interface SpecificationGroupDraft {` → `interface SpecificationGroupDraft {` (used throughout file) — drop-export.
  - Line 66: `export function createSpecification(...)` → `function createSpecification(...)` (used at line 191) — drop-export.

- [ ] **Step 3: `authoring/inspectors/lesson/RepeatableField.tsx`**
  - Line 5: `export interface RepeatableFieldActions {` → `interface RepeatableFieldActions {` (used 3× in-file: lines 19, 20, 33) — drop-export.

- [ ] **Step 4: `authoring/RevisionPanel.tsx`**
  - Line 6: `export interface StudioRevision {` → `interface StudioRevision {` (used 3× in-file: lines 28, 44, 81) — drop-export.
  - Line 15: `export interface StudioFeedback {` → `interface StudioFeedback {` (used 3× in-file: lines 29, 45, 82) — drop-export.

- [ ] **Step 5: `authoring/studio-types.ts`**
  - Line 3: change `export type { StudioTrashItem, StudioTrashMutation } from './studio-client';` to `export type { StudioTrashItem } from './studio-client';`. `StudioTrashItem` is actively re-exported and consumed this way by `CourseOutline.tsx`, `CourseStudioWorkspace.tsx`, `useStudioCourseCommands.ts`, `TrashPanel.tsx` — keep it. `StudioTrashMutation`'s own definition in `studio-client.ts:20` is not dead (used in-file there at lines 48, 54) — only this redundant re-export of it is removed.
  - Line 11: delete the entire `export interface StudioMutationResult { ... }` block — zero references anywhere.

- [ ] **Step 6: Verify**

Run: `npm run lint && npm run typecheck`
Expected: both clean.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore: dead code and superfluous-export sweep (authoring UI)

Deletes mergeImage() (lesson-draft.ts, zero references) and
StudioMutationResult (studio-types.ts, zero references), drops the
redundant StudioTrashMutation re-export, and drops `export` on five more
symbols only ever used inside their own file. No behavior change.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

### Task 2.7: `learning/*` sweep (11 items, 8 files)

**Files:**

- Modify: `apps/web/src/learning/canvas.ts:1`
- Modify: `apps/web/src/learning/course-player-adapter.ts:2,104`
- Modify: `apps/web/src/learning/player/hooks/useCourseNavigation.ts:45,121,333`
- Modify: `apps/web/src/learning/server/quiz-grading.ts:16`
- Modify: `apps/web/src/learning/course-structure.ts:9`
- Modify: `apps/web/src/learning/player/hooks/useLessonRuntime.ts:11`
- Modify: `apps/web/src/learning/player/lesson-types/Hotspot.tsx:7,8`
- Modify: `apps/web/src/learning/quiz-session.ts:3`

**Interfaces:**

- Removed: `toPlayerCourseSummary` from `course-player-adapter.ts` (the file's other export, `toPlayerCourseContent`, is untouched and uses a different import, `NormalizedCourseContent`, so nothing else in the file is affected).
- Everything else in this task is drop-export only, zero interface change.

- [ ] **Step 1: `learning/canvas.ts`**
  - Line 1: `export const CANVAS_LESSON_TYPE = ...` → `const CANVAS_LESSON_TYPE = ...` (used at line 11) — drop-export.

- [ ] **Step 2: `learning/course-player-adapter.ts`**
  - Delete the entire `export function toPlayerCourseSummary(...) { ... }` block at line 104 — zero references repo-wide.
  - After deleting, remove the now-orphaned import at line 2: `import { courseSummarySchema, type CourseSummary } from '@/shared/contracts/player-course';` — confirmed neither `courseSummarySchema` nor `CourseSummary` is used anywhere else in this file once the function is gone (the remaining function, `toPlayerCourseContent`, uses `NormalizedCourseContent` from a separate import).
  - Run `grep -n "courseSummarySchema\|CourseSummary\b" apps/web/src/learning/course-player-adapter.ts` after editing to confirm the import removal didn't leave a dangling reference.

- [ ] **Step 3: `learning/player/hooks/useCourseNavigation.ts`**
  - Line 45: `export function getSectionIndex(...)` → `function getSectionIndex(...)` (used at lines 288, 435) — drop-export.
  - Line 121: `export function isLessonLocked(...)` → `function isLessonLocked(...)` (used at lines 175, 290, 403) — drop-export.
  - Line 333: `export function courseNavigationReducer(...)` → `function courseNavigationReducer(...)` (used at line 387, passed to `useReducer`) — drop-export.

- [ ] **Step 4: `learning/server/quiz-grading.ts`**
  - Line 16: `export const DEFAULT_PASSING_SCORE = ...` → `const DEFAULT_PASSING_SCORE = ...` (used at lines 60, 82, 145) — drop-export.

- [ ] **Step 5: `learning/course-structure.ts`**
  - Line 9: `export interface ChapterGroup {` → `interface ChapterGroup {` (used at lines 24, 40, 41) — drop-export.

- [ ] **Step 6: `learning/player/hooks/useLessonRuntime.ts`**
  - Line 11: `export type BaseMarkVisited = ...` → `type BaseMarkVisited = ...` (used at lines 32, 38) — drop-export.

- [ ] **Step 7: `learning/player/lesson-types/Hotspot.tsx`**
  - Line 7: `export type HotspotVariant = ...` → `type HotspotVariant = ...` (used at lines 21, 64) — drop-export.
  - Line 8: `export type HotspotPresentation = ...` → `type HotspotPresentation = ...` (used at line 65) — drop-export.

- [ ] **Step 8: `learning/quiz-session.ts`**
  - Line 3: `export type QuizSessionPhase = ...` → `type QuizSessionPhase = ...` (used at line 6) — drop-export.

- [ ] **Step 9: Verify**

Run: `npm run lint && npm run typecheck`
Expected: both clean.

- [ ] **Step 10: Manual smoke check**

Run `npm run dev`, exercise course navigation in the player (chapter/lesson advance, a locked lesson if any test content has one) since `useCourseNavigation.ts` changed — confirm no regression. This is a drop-export-only change so no behavior should differ; the check is a safety net for the `course-player-adapter.ts` deletion + import removal specifically.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore: dead code and superfluous-export sweep (learning/player)

Deletes toPlayerCourseSummary() (zero references) and its now-orphaned
import, drops `export` on seven more symbols only used inside their own
file. No behavior change.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

### Task 2.8: `shared/contracts/api.ts` and `lesson-types.ts` cleanup (4 items, 2 files)

**Files:**

- Modify: `apps/web/src/shared/contracts/api.ts:32,34,39`
- Modify: `apps/web/src/shared/contracts/lesson-types.ts:14`

**Interfaces:**

- Removed: `WeakTopicsResponseSchema`, `WeakTopicsRequest`, `WeakTopicsResponse` from `api.ts`. Verified: `apps/web/src/app/api/analytics/weak-topics/route.ts` — the only consumer of this file's weak-topics exports — imports only `WeakTopicsRequestSchema` (a different, unflagged symbol that stays) and builds its response directly without validating against `WeakTopicsResponseSchema`.
- Removed: `LessonType` from `lesson-types.ts`. Verified: the only other repo-wide hit for the name `LessonType` is `learning/player/lesson-types/registry.ts:15`, which defines its **own**, unrelated local `type LessonType` — it does not import this one. The sibling `ALL_LESSON_TYPES` const (unflagged by knip) is untouched, still actively used elsewhere.

- [ ] **Step 1: `shared/contracts/api.ts`**
  - Delete the `WeakTopicsResponseSchema` const declaration at line 34 (its full Zod schema definition).
  - Delete the `WeakTopicsRequest` type declaration at line 32.
  - Delete the `WeakTopicsResponse` type declaration at line 39.
  - Leave `WeakTopicsRequestSchema` and everything else in the file untouched.
  - Run `grep -n "WeakTopics" apps/web/src/shared/contracts/api.ts` after editing — confirm only `WeakTopicsRequestSchema` (and whatever type is inferred from it, if present) remains.

- [ ] **Step 2: `shared/contracts/lesson-types.ts`**
  - Delete the `LessonType` type declaration at line 14.
  - Leave `ALL_LESSON_TYPES` and everything else in the file untouched.

- [ ] **Step 3: Verify**

Run: `npm run lint && npm run typecheck`
Expected: both clean.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore: remove dead exports from shared/contracts (api, lesson-types)

WeakTopicsResponseSchema/WeakTopicsRequest/WeakTopicsResponse and the
standalone LessonType type had zero consumers.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

### Task 2.9: `shared/contracts/course-studio.ts` cleanup (13 items, 1 file)

**Files:**

- Modify: `apps/web/src/shared/contracts/course-studio.ts:6,16,23,31,37,42,50,74,75,76,77,78,80`

Do this task **before** Task 3.2 (which renames this file) — the rename task's import-line updates assume this cleanup has already landed.

**Interfaces:** No consumer impact — every symbol below is either used only within this file (drop-export) or has zero references anywhere (delete), verified by grep during planning research including cross-checking against the similarly-named types in `player-course.ts` that consumers actually use instead.

- [ ] **Step 1: Drop-export sweep (7 schema consts, all used only within this file)**
  - Line 6: `export const coverButtonColorSchema = ...` → `const coverButtonColorSchema = ...` (used at line 28)
  - Line 16: `export const imageReferenceSchema = ...` → `const imageReferenceSchema = ...` (used 4× in-file)
  - Line 23: `export const courseCoverSchema = ...` → `const courseCoverSchema = ...` (used at line 65)
  - Line 31: `export const specificationRowSchema = ...` → `const specificationRowSchema = ...` (used at line 39)
  - Line 37: `export const specificationGroupSchema = ...` → `const specificationGroupSchema = ...` (used at line 46)
  - Line 42: `export const courseSpecificationSchema = ...` → `const courseSpecificationSchema = ...` (used at line 66)
  - Line 50: `export const courseDisclaimerSchema = ...` → `const courseDisclaimerSchema = ...` (used at line 67)

- [ ] **Step 2: Delete sweep (6 types, zero references anywhere)**
  - Line 74: delete `export type CourseCover = ...`. Note: the only repo-wide hits for the bare name "CourseCover" are an unrelated same-named React **component** at `learning/player/CourseCover.tsx` — a false-positive collision, not a real usage of this type. Confirm with `grep -rn "\bCourseCover\b" apps/web/src --include="*.ts" --include="*.tsx" | grep -v "shared/contracts/course-studio.ts\|learning/player/CourseCover.tsx"` → expect no output before deleting.
  - Line 75: delete `export type SpecificationRow = ...` — zero references anywhere.
  - Line 76: delete `export type SpecificationGroup = ...` — zero references anywhere.
  - Line 77: delete `export type CourseSpecification = ...`. Note: real consumers (`course-structure.ts`, `SpecificationPage.tsx`) import the like-named type from `shared/contracts/player-course.ts:148` instead — a different type with the same name. Don't confuse the two; only delete this file's copy.
  - Line 78: delete `export type CourseDisclaimer = ...`. Same situation — real consumers import from `player-course.ts:190`.
  - Line 80: delete `export type CourseSettingsPatchInput = ...` — zero references anywhere.

- [ ] **Step 3: Verify**

Run: `npm run lint && npm run typecheck`
Expected: both clean.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore: dead export sweep in shared/contracts/course-studio.ts

Six types (CourseCover, SpecificationRow, SpecificationGroup,
CourseSpecification, CourseDisclaimer, CourseSettingsPatchInput) had zero
consumers — several are same-named decoys for the real types actually used
from player-course.ts. Drops `export` on seven more schema consts only used
within this file.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

### Task 2.10: `shared/contracts/player-course.ts` drop-export sweep (7 items, 1 file)

**Files:**

- Modify: `apps/web/src/shared/contracts/player-course.ts:28,44,55,69,124,150,180`

**Interfaces:** None — every symbol below is used only within this file (verified by grep).

- [ ] **Step 1: Edit**
  - Line 28: `export const portableTextSchema = ...` → `const portableTextSchema = ...` (used at lines 32, 36)
  - Line 44: `export const photoSchema = ...` → `const photoSchema = ...` (used at line 63)
  - Line 55: `export const hotspotSchema = ...` → `const hotspotSchema = ...` (used at line 83)
  - Line 69: `export const lessonSchema = ...` → `const lessonSchema = ...` (used at line 196)
  - Line 124: `export const specificationSchema = ...` → `const specificationSchema = ...` (used at line 212)
  - Line 150: `export const quizDocSchema = ...` → `const quizDocSchema = ...` (used at lines 197, 211)
  - Line 180: `export const disclaimerSchema = ...` → `const disclaimerSchema = ...` (used at line 213)

- [ ] **Step 2: Verify**

Run: `npm run lint && npm run typecheck`
Expected: both clean.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore: drop superfluous exports in shared/contracts/player-course.ts

Seven schema consts only used inside this file to compose the schemas that
stay exported (lessonSchema, etc. remain internal building blocks; the
composed course/lesson schemas consumers actually import are untouched).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3 — Directory structure

### Task 3.1: Move `apps/web/src/components/` into `apps/web/src/learning/player/discovery/`

**Files:**

- Move: `apps/web/src/components/DiscoveryPanel.tsx` → `apps/web/src/learning/player/discovery/DiscoveryPanel.tsx`
- Move: `apps/web/src/components/PhotoCardStack.tsx` → `apps/web/src/learning/player/discovery/PhotoCardStack.tsx`
- Move: `apps/web/src/components/discovery/DiscoveryLearnContent.tsx` → `apps/web/src/learning/player/discovery/DiscoveryLearnContent.tsx`
- Modify: `apps/web/src/learning/player/lesson-types/ProductStage.tsx:8`
- Modify: `apps/web/src/learning/player/lesson-types/ContentLesson.tsx:9`
- Modify: `apps/web/src/learning/player/lesson-types/CanvasInspectionLesson.tsx:6`
- Modify: `apps/web/src/learning/player/lesson-types/FeatureLearningLoop.tsx:5`

**Interfaces:** No exported names change — `DiscoveryPanel`, `PhotoCardStack`, `DiscoveryLearnContent` keep their signatures, only their file location and import paths change.

- [ ] **Step 1: Move the files, flattening the nested `discovery/` subfolder**

```bash
mkdir -p apps/web/src/learning/player/discovery
git mv apps/web/src/components/DiscoveryPanel.tsx apps/web/src/learning/player/discovery/DiscoveryPanel.tsx
git mv apps/web/src/components/PhotoCardStack.tsx apps/web/src/learning/player/discovery/PhotoCardStack.tsx
git mv apps/web/src/components/discovery/DiscoveryLearnContent.tsx apps/web/src/learning/player/discovery/DiscoveryLearnContent.tsx
```

- [ ] **Step 2: Fix the moved files' own relative imports**

In `apps/web/src/learning/player/discovery/DiscoveryPanel.tsx`, change:

```ts
import { DiscoveryLearnContent } from './discovery/DiscoveryLearnContent';
```

to:

```ts
import { DiscoveryLearnContent } from './DiscoveryLearnContent';
```

(All of this file's other imports — `useFocusTrap` from `@/shared/useFocusTrap`, `RichText`/`CoursePhoto` from `@/shared/contracts/player-course`, `InlineDiscoveryCueResolver` from `@/learning/player/lesson-types/InlineDiscoveryCue` — use the absolute `@/` alias and are unaffected by the move.)

In `apps/web/src/learning/player/discovery/DiscoveryLearnContent.tsx`, change:

```ts
import { PhotoCardStack } from '../PhotoCardStack';
```

to:

```ts
import { PhotoCardStack } from './PhotoCardStack';
```

(This file's other imports — `supMark` from `@/shared/portable-text-components`, `cssAspectRatio` from `@/shared/utils`, the `InlineDiscoveryCue*` imports — are absolute and unaffected.)

`PhotoCardStack.tsx`'s own imports (`titleFromFilename` from `@/shared/utils`, `CoursePhoto` from `@/shared/contracts/player-course`) are absolute and need no change.

- [ ] **Step 3: Update the four external importers**

In `apps/web/src/learning/player/lesson-types/ProductStage.tsx:8`, change:

```ts
import { DiscoveryPanel } from '@/components/DiscoveryPanel';
```

to:

```ts
import { DiscoveryPanel } from '@/learning/player/discovery/DiscoveryPanel';
```

In `apps/web/src/learning/player/lesson-types/ContentLesson.tsx:9`, same rewrite (`DiscoveryPanel`).

In `apps/web/src/learning/player/lesson-types/CanvasInspectionLesson.tsx:6`, same rewrite (`DiscoveryPanel`).

In `apps/web/src/learning/player/lesson-types/FeatureLearningLoop.tsx:5`, change:

```ts
import { DiscoveryLearnContent } from '@/components/discovery/DiscoveryLearnContent';
```

to:

```ts
import { DiscoveryLearnContent } from '@/learning/player/discovery/DiscoveryLearnContent';
```

- [ ] **Step 4: Remove the now-empty directory**

```bash
rmdir apps/web/src/components/discovery apps/web/src/components 2>/dev/null || true
```

If either `rmdir` fails because the directory isn't empty, run `find apps/web/src/components -type f` first to check for anything left behind before this task's changes are considered done — there should be nothing.

- [ ] **Step 5: Verify**

Run: `npm run lint && npm run typecheck`
Expected: both clean — a missed import would be a TypeScript module-resolution error here.

- [ ] **Step 6: Manual smoke check**

Run `npm run dev`, open a lesson using a Product Stage, Content Lesson, Canvas Inspection Lesson, or Feature Learning Loop lesson type in the player preview and confirm the discovery panel / photo stack still renders.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor: move apps/web/src/components/ into learning/player/discovery/

This was Moto-Player-only UI (every consumer lives under
learning/player/lesson-types/), not cross-surface shared UI — moving it to
match where it's actually used.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

### Task 3.2: Rename `shared/contracts/course-studio.ts` to `course-settings.ts`

**Files:**

- Move: `apps/web/src/shared/contracts/course-studio.ts` → `apps/web/src/shared/contracts/course-settings.ts`
- Modify (import specifier only): `apps/web/src/app/api/course-studio/courses/[courseId]/route.ts:3`
- Modify: `apps/web/src/authoring/studio-client.ts:7`
- Modify: `apps/web/src/authoring/StudioInspector.tsx:5`
- Modify: `apps/web/src/authoring/useStudioCourseCommands.ts:10`
- Modify: `apps/web/src/authoring/inspectors/SpecificationsField.tsx:13`
- Modify: `apps/web/src/authoring/inspectors/CourseMediaField.tsx:4`
- Modify: `apps/web/src/authoring/inspectors/lesson/RichTextField.tsx:5`
- Modify: `apps/web/src/authoring/inspectors/CourseInspector.tsx:18`
- Modify: `apps/web/src/authoring/inspectors/lesson/lesson-draft.ts:11`

**Interfaces:** No exported names change, only the file path / import specifier. Do this after Task 2.9 (that task's line numbers assume the file is still named `course-studio.ts`).

- [ ] **Step 1: Rename the file**

```bash
git mv apps/web/src/shared/contracts/course-studio.ts apps/web/src/shared/contracts/course-settings.ts
```

- [ ] **Step 2: Update all 9 importers**

In each file below, change the import specifier `'@/shared/contracts/course-studio'` to `'@/shared/contracts/course-settings'`, keeping every named import unchanged:

1. `apps/web/src/app/api/course-studio/courses/[courseId]/route.ts:3` — `import { courseSettingsPatchSchema } from '@/shared/contracts/course-studio';` → `from '@/shared/contracts/course-settings';`
2. `apps/web/src/authoring/studio-client.ts:7` — `import type { CourseSettingsInput } from '@/shared/contracts/course-studio';` → `from '@/shared/contracts/course-settings';`
3. `apps/web/src/authoring/StudioInspector.tsx:5` — same specifier change.
4. `apps/web/src/authoring/useStudioCourseCommands.ts:10` — same specifier change.
5. `apps/web/src/authoring/inspectors/SpecificationsField.tsx:13` — this is the closing line of a multi-line named import; change only the trailing `from '...'` specifier.
6. `apps/web/src/authoring/inspectors/CourseMediaField.tsx:4` — `import type { ImageReference } from '@/shared/contracts/course-studio';` → `from '@/shared/contracts/course-settings';`
7. `apps/web/src/authoring/inspectors/lesson/RichTextField.tsx:5` — `import { isJsonObject } from '@/shared/contracts/course-studio';` → `from '@/shared/contracts/course-settings';`
8. `apps/web/src/authoring/inspectors/CourseInspector.tsx:18` — closing line of a multi-line named import; change only the specifier.
9. `apps/web/src/authoring/inspectors/lesson/lesson-draft.ts:11` — closing line of a multi-line named import; change only the specifier.

Confirmed during planning research: no file under `packages/*` or `apps/job-worker` imports this path — it's `apps/web`-only. Also confirmed this never collides with `packages/contracts/src/course-studio.ts` in actual import specifiers (that one is always imported as `@moto-ai/contracts/course-studio`, a different package name) — only by filename, which was the whole point of this rename.

- [ ] **Step 3: Verify no stale references remain**

Run: `grep -rn "shared/contracts/course-studio" apps/web/src`
Expected: no output.

- [ ] **Step 4: Verify**

Run: `npm run lint && npm run typecheck`
Expected: both clean.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor: rename shared/contracts/course-studio.ts to course-settings.ts

Its content is client-side authoring form schemas (cover/specs/disclaimer/
settings) — the old name collided by basename with the unrelated
packages/contracts/src/course-studio.ts (cross-workspace course-graph
types), inviting a wrong-file import by autocomplete.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 4 — Duplication cleanup

Scope correction from the spec (see "Deviations" above): only 11 of ~19 fetch call sites across the 11 audited files share the pattern this phase targets. The other ~8 (silent-failure polling, status-only checks feeding Zod validation, an SWR mutate callback that returns locally-computed data instead of the response body) are intentionally different control flow — migrating them would change behavior, which is out of scope. This phase touches only the 11 true matches, in 8 files.

### Task 4.1: Add the shared `fetchJson` helper

**Files:**

- Create: `apps/web/src/shared/fetch-json.ts`

**Interfaces:**

- Produces: `fetchJson<T>(url: string, init: RequestInit, fallbackMessage: string): Promise<T>` — every task in this phase consumes this exact signature.

- [ ] **Step 1: Create the file**

```ts
export async function fetchJson<T>(
  url: string,
  init: RequestInit,
  fallbackMessage: string,
): Promise<T> {
  const response = await fetch(url, init);
  const result = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(result.error || fallbackMessage);
  return result;
}
```

This replaces only the fetch → parse → ok-check → error-message boilerplate. Any call site that also checks an extra field (e.g. `!result.course`) keeps that check as its own line immediately after calling `fetchJson`, shown per site below.

- [ ] **Step 2: Verify**

Run: `npm run lint && npm run typecheck`
Expected: both clean (this file has no callers yet, so this step just confirms the new file itself is valid).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: add shared fetchJson helper

Extracted from the fetch/parse/error-check shape already duplicated across
authoring, review, and inspector components. Modeled on the private
mutate() helper in authoring/studio-client.ts.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

### Task 4.2: Migrate `RevisionPanel.tsx` (`freeze`, `createLink`)

**Files:**

- Modify: `apps/web/src/authoring/RevisionPanel.tsx`

**Interfaces:**

- Consumes: `fetchJson<T>(url, init, fallbackMessage)` from `@/shared/fetch-json` (Task 4.1).

Leave `load()` (dual-fetch with combined error message across two requests — not a clean single-`fetchJson` fit) and `resolveFeedback()` (never reads the response body) untouched — both are intentionally different control flow.

- [ ] **Step 1: Add the import**

```ts
import { fetchJson } from '@/shared/fetch-json';
```

- [ ] **Step 2: Migrate `freeze()` (currently ~lines 139-146)**

The current shape does a `fetch`, parses `{error?: string}`, and throws `result.error || 'Revision could not be created.'` on `!response.ok`, with the parsed result otherwise unused (the caller re-`load()`s afterward). Replace the fetch/parse/throw with:

```ts
await fetchJson<{ error?: string }>(
  /* existing url */,
  /* existing init */,
  'Revision could not be created.',
);
```

Keep the existing `url`/`init` arguments exactly as they are today — only the fetch/parse/throw boilerplate is being replaced, not the request itself.

- [ ] **Step 3: Migrate `createLink()` (currently ~lines 163-167)**

Current shape parses `{reviewUrl?: string; error?: string}` and throws if `!response.ok || !result.reviewUrl`, then uses `result.reviewUrl`. Replace with:

```ts
const result = await fetchJson<{ reviewUrl?: string; error?: string }>(
  /* existing url */,
  /* existing init */,
  /* existing fallback message */,
);
if (!result.reviewUrl) throw new Error(/* existing fallback message */);
return result.reviewUrl;
```

Keep the existing fallback message string exactly as it is today.

- [ ] **Step 4: Verify**

Run: `npm run lint && npm run typecheck`
Expected: both clean.

- [ ] **Step 5: Manual smoke check**

Run `npm run dev`, open Course Studio, freeze a revision and create a review link — confirm both still work and error messages on failure (e.g. by temporarily breaking the API route, or just reviewing the code path) still read the same as before.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor: migrate RevisionPanel freeze/createLink to fetchJson

load() and resolveFeedback() are left as-is — different control flow
(combined dual-fetch error handling, and a body-less ok-check respectively).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

### Task 4.3: Migrate `AssistantQaPanel.tsx` (`load`, `generate`, `save`)

**Files:**

- Modify: `apps/web/src/authoring/AssistantQaPanel.tsx`

**Interfaces:**

- Consumes: `fetchJson<T>` from `@/shared/fetch-json` (Task 4.1).

Leave `remove()` untouched (never reads the response body — throws a hardcoded string on `!response.ok` only).

- [ ] **Step 1: Add the import**

```ts
import { fetchJson } from '@/shared/fetch-json';
```

- [ ] **Step 2: Migrate `load` (currently ~line 14-15)**

Current shape parses `{items?: ...; error?: string}`, no extra-field check beyond `!response.ok`, uses `result.items ?? []`. Replace with:

```ts
const result = await fetchJson<{ items?: /* existing item type */[]; error?: string }>(
  /* existing url */,
  /* existing init */,
  /* existing fallback message */,
);
return result.items ?? [];
```

- [ ] **Step 3: Migrate `generate` (currently ~line 20)**

Current shape parses `{error?: string}` only, result otherwise unused. Replace with:

```ts
await fetchJson<{ error?: string }>(
  /* existing url */,
  /* existing init */,
  /* existing fallback message */,
);
```

- [ ] **Step 4: Migrate `save` (currently ~line 25)**

Current shape parses `{item?: ...; error?: string}`, throws if `!response.ok || !result.item`, uses `result.item`. Replace with:

```ts
const result = await fetchJson<{ item?: /* existing item type */; error?: string }>(
  /* existing url */,
  /* existing init */,
  /* existing fallback message */,
);
if (!result.item) throw new Error(/* existing fallback message */);
return result.item;
```

- [ ] **Step 5: Verify**

Run: `npm run lint && npm run typecheck`
Expected: both clean. Pay attention to the exact item type used in `load`/`save` today — copy it verbatim from the current code rather than guessing, since it must match `replaceCourseAssistantQaDrafts`'s consumers elsewhere.

- [ ] **Step 6: Manual smoke check**

Run `npm run dev`, open the Assistant Q&A panel in Course Studio, load existing drafts, generate a new one, and save an edit — confirm all three still work.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor: migrate AssistantQaPanel load/generate/save to fetchJson

remove() is left as-is — it never reads a response body.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

### Task 4.4: Migrate `CreateWithAiDialog.tsx` (`submit`)

**Files:**

- Modify: `apps/web/src/authoring/CreateWithAiDialog.tsx`

**Interfaces:**

- Consumes: `fetchJson<T>` from `@/shared/fetch-json` (Task 4.1).

- [ ] **Step 1: Add the import**

```ts
import { fetchJson } from '@/shared/fetch-json';
```

- [ ] **Step 2: Migrate `submit()` (currently ~lines 43-54)**

Current shape parses `{generation?: ...; error?: string}`, throws if `!response.ok || !result.generation`, uses `result.generation`. Replace with:

```ts
const result = await fetchJson<{ generation?: /* existing generation type */; error?: string }>(
  /* existing url */,
  /* existing init */,
  /* existing fallback message */,
);
if (!result.generation) throw new Error(/* existing fallback message */);
return result.generation;
```

- [ ] **Step 3: Verify**

Run: `npm run lint && npm run typecheck`
Expected: both clean.

- [ ] **Step 4: Manual smoke check**

Run `npm run dev`, open the "Create with AI" dialog and start a generation — confirm it still submits and the generation status panel picks it up.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor: migrate CreateWithAiDialog submit to fetchJson

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

### Task 4.5: Migrate `SourcePanel.tsx` (all 4 call sites, drop local `responseJson`)

**Files:**

- Modify: `apps/web/src/authoring/SourcePanel.tsx`

**Interfaces:**

- Consumes: `fetchJson<T>` from `@/shared/fetch-json` (Task 4.1).
- Removes: the file's local `responseJson()` mini-helper (~lines 32-36) — becomes dead once all 4 call sites route through `fetchJson` instead.

All 4 call sites share the same response shape: `{error?: string; sources?: CourseSourceFile[]}`.

- [ ] **Step 1: Add the import, remove the old helper**

```ts
import { fetchJson } from '@/shared/fetch-json';
```

Delete the local `responseJson()` function (~lines 32-36) — its only job was a typed `response.json()` cast with no ok-check, which `fetchJson` now does plus the error-throw.

- [ ] **Step 2: Migrate `refresh()` (currently ~lines 46-52)**

Has an extra-field check (`!result.sources`). Replace with:

```ts
const result = await fetchJson<{ error?: string; sources?: CourseSourceFile[] }>(
  /* existing url */,
  /* existing init */,
  /* existing fallback message */,
);
if (!result.sources) throw new Error(/* existing fallback message */);
return result.sources;
```

- [ ] **Step 3: Migrate `upload()` (currently ~lines 73-75)**

POSTs `FormData` — keep the existing `init` exactly as-is (no `content-type` header; the browser sets the multipart boundary itself). No extra-field check today. Replace with:

```ts
await fetchJson<{ error?: string; sources?: CourseSourceFile[] }>(
  /* existing url */,
  /* existing init — FormData body, no content-type header */,
  /* existing fallback message */,
);
```

- [ ] **Step 4: Migrate `retryIndex()` (currently ~lines 90-94)**

No extra-field check today. Replace with:

```ts
await fetchJson<{ error?: string; sources?: CourseSourceFile[] }>(
  /* existing url */,
  /* existing init */,
  /* existing fallback message */,
);
```

- [ ] **Step 5: Migrate `remove()` (currently ~lines 118-122)**

No extra-field check today. The existing `.catch(() => refresh().catch(() => undefined))` recovery call on the surrounding try/catch stays outside `fetchJson` — only the fetch/parse/throw boilerplate inside the try is replaced:

```ts
await fetchJson<{ error?: string; sources?: CourseSourceFile[] }>(
  /* existing url */,
  /* existing init */,
  /* existing fallback message */,
);
```

- [ ] **Step 6: Verify**

Run: `npm run lint && npm run typecheck`
Expected: both clean. Confirm `responseJson` has no remaining references: `grep -n "responseJson" apps/web/src/authoring/SourcePanel.tsx` → expect no output.

- [ ] **Step 7: Manual smoke check**

Run `npm run dev`, open the Source panel in Course Studio: upload a file, wait for indexing, retry an index if one fails, and remove a source — confirm all four still work.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor: migrate SourcePanel to fetchJson, drop local responseJson helper

All 4 call sites (refresh, upload, retryIndex, remove) shared the same
{error, sources} response shape.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

### Task 4.6: Migrate the 3-way duplicated asset-upload pattern (`CourseMediaField.tsx`, `LessonInspector.tsx`, `AssetCollectionField.tsx`)

**Files:**

- Modify: `apps/web/src/authoring/inspectors/CourseMediaField.tsx`
- Modify: `apps/web/src/authoring/inspectors/LessonInspector.tsx`
- Modify: `apps/web/src/authoring/inspectors/lesson/AssetCollectionField.tsx`

**Interfaces:**

- Consumes: `fetchJson<T>` from `@/shared/fetch-json` (Task 4.1).

These three files independently duplicate the exact same upload shape: POST `FormData` to `/api/course-studio/assets`, parse `{asset?: {deliveryUrl?: string; filename?: string}; error?: string}`, throw if `!response.ok || !result.asset?.deliveryUrl`. Migrate all three to `fetchJson` with matching generic types (each keeps its own existing fallback message).

- [ ] **Step 1: `CourseMediaField.tsx` — `upload()` (currently ~lines 51-58)**

```ts
import { fetchJson } from '@/shared/fetch-json';
```

```ts
const result = await fetchJson<{
  asset?: { deliveryUrl?: string; filename?: string };
  error?: string;
}>(
  /* existing url */,
  /* existing init — FormData body */,
  'Image upload failed.',
);
if (!result.asset?.deliveryUrl) throw new Error('Image upload failed.');
/* existing code using result.asset.deliveryUrl / result.asset.filename, unchanged */
```

- [ ] **Step 2: `LessonInspector.tsx` — `uploadAsset()` (currently ~lines 61-64)**

Same shape, existing fallback message `'Asset upload failed.'`:

```ts
import { fetchJson } from '@/shared/fetch-json';
```

```ts
const result = await fetchJson<{
  asset?: { deliveryUrl?: string; filename?: string };
  error?: string;
}>(
  /* existing url */,
  /* existing init — FormData body */,
  'Asset upload failed.',
);
if (!result.asset?.deliveryUrl) throw new Error('Asset upload failed.');
/* existing code using result.asset.deliveryUrl / result.asset.filename, unchanged */
```

- [ ] **Step 3: `AssetCollectionField.tsx` — the upload inside `Promise.all(selected.map(...))` (currently ~lines 47-50)**

Same shape and fallback message `'Asset upload failed.'`, inside the existing `.map()` callback — keep the surrounding `Promise.all` structure unchanged, only replace the fetch/parse/throw boilerplate per the same pattern as Step 2.

```ts
import { fetchJson } from '@/shared/fetch-json';
```

- [ ] **Step 4: Verify**

Run: `npm run lint && npm run typecheck`
Expected: both clean.

- [ ] **Step 5: Manual smoke check**

Run `npm run dev`, upload an image via a course-cover/media field, upload an asset via a lesson inspector field, and upload multiple assets via an asset-collection field (e.g. a photo gallery lesson) — confirm all three still work and show the same error message on a forced failure (e.g. an oversized file, if there's a size limit).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor: migrate the 3x-duplicated asset-upload pattern to fetchJson

CourseMediaField, LessonInspector, and AssetCollectionField each
independently duplicated the same POST-FormData-parse-asset.deliveryUrl
shape; now all three route through the shared fetchJson helper, keeping
their own distinct fallback messages.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

### Task 4.7: Migrate `ReviewFeedbackPanel.tsx` (`submit`)

**Files:**

- Modify: `apps/web/src/review/ReviewFeedbackPanel.tsx`

**Interfaces:**

- Consumes: `fetchJson<T>` from `@/shared/fetch-json` (Task 4.1).

- [ ] **Step 1: Add the import**

```ts
import { fetchJson } from '@/shared/fetch-json';
```

- [ ] **Step 2: Migrate `submit()` (currently ~lines 29-35)**

Current shape parses `{error?: string}` only, fallback message `'Feedback could not be submitted.'`. Replace with:

```ts
await fetchJson<{ error?: string }>(
  /* existing url */,
  /* existing init */,
  'Feedback could not be submitted.',
);
```

- [ ] **Step 3: Verify**

Run: `npm run lint && npm run typecheck`
Expected: both clean.

- [ ] **Step 4: Manual smoke check**

Run `npm run dev`, open a frozen revision's review link and submit feedback — confirm it still works.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor: migrate ReviewFeedbackPanel submit to fetchJson

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 5 — Split oversized files

### Task 5.1: Extract `CourseInspector.tsx`'s draft/validation helpers into `course-inspector-draft.ts`

**Files:**

- Create: `apps/web/src/authoring/inspectors/course-inspector-draft.ts`
- Modify: `apps/web/src/authoring/inspectors/CourseInspector.tsx`

**Interfaces:**

- Produces (from the new file): `objectiveDrafts` (internal only — called by `formDraft`, not re-exported), `coverDraft` (internal only), `disclaimerDraft` (internal only), `formDraft(course: CourseGraph): CourseFormDraft`, `formFingerprint(draft: CourseFormDraft): string`, `formPayload(draft: CourseFormDraft): /* existing payload type */`, `errorMap(/* existing params */): /* existing return type */`, plus the types `CourseFormDraft`, `CoverDraft`, `DisclaimerDraft`.
- Consumes (in `CourseInspector.tsx`, from the new file): `formDraft`, `formFingerprint`, `formPayload`, `errorMap`, and the types `CourseFormDraft`, `CoverDraft`, `DisclaimerDraft`.

This mirrors the existing `authoring/inspectors/lesson/lesson-draft.ts` pattern — pure draft-shaping functions with no React, living beside the component that uses them.

- [ ] **Step 1: Read the current file to copy exact code**

Before editing, `Read apps/web/src/authoring/inspectors/CourseInspector.tsx` in full — line numbers below (confirmed during planning research) are: `CoverDraft` type (28-36), `DisclaimerDraft` type (38-47), `CourseFormDraft` type (49-57), `objectiveDrafts` (84-91), `coverDraft` (93-106), `disclaimerDraft` (108-127), `formDraft` (129-139), `formFingerprint` (141-143), `formPayload` (145-194), `errorMap` (196-198). Since the file may have shifted slightly since the audit (earlier phases in this plan don't touch it, but re-confirm line numbers by reading before cutting).

- [ ] **Step 2: Create `course-inspector-draft.ts`**

Move the three types (`CoverDraft`, `DisclaimerDraft`, `CourseFormDraft`) and seven functions (`objectiveDrafts`, `coverDraft`, `disclaimerDraft`, `formDraft`, `formFingerprint`, `formPayload`, `errorMap`) verbatim from `CourseInspector.tsx` into the new file, with these import lines at the top (confirmed as exactly what those 7 functions call):

```ts
import type { CourseGraph } from '@moto-ai/contracts/course-studio';
import {
  booleanField,
  createStableCourseStudioKey,
  disclaimerCategorySchema,
  imageReference,
  jsonObject,
  mergeKnownFields,
  stringField,
  type ImageReference,
  type JsonObject,
} from '@/shared/contracts/course-settings';
import {
  specificationDrafts,
  specificationsPayload,
  type SpecificationDraft,
} from './SpecificationsField';
import type { StringListItem } from './StringListField';
```

Export the three types (`CoverDraft`, `DisclaimerDraft`, `CourseFormDraft`) and only the four functions the component calls directly (`formDraft`, `formFingerprint`, `formPayload`, `errorMap`) — leave `objectiveDrafts`, `coverDraft`, `disclaimerDraft` un-exported, since they're only called by `formDraft` within this same new file (verified: no other call sites in `CourseInspector.tsx`'s component body).

- [ ] **Step 3: Update `CourseInspector.tsx`**

Remove the moved types/functions from this file, and add:

```ts
import {
  formDraft,
  formFingerprint,
  formPayload,
  errorMap,
  type CourseFormDraft,
  type CoverDraft,
  type DisclaimerDraft,
} from './course-inspector-draft';
```

Trim this file's existing `@/shared/contracts/course-settings` import — remove `booleanField`, `createStableCourseStudioKey`, `disclaimerCategorySchema`, `imageReference`, `jsonObject`, `mergeKnownFields`, `stringField`, `type ImageReference`, `type JsonObject` (each verified used only inside the 7 moved functions, not elsewhere in the component body at lines 200-709). Keep `courseSettingsInputSchema` (used at line 230), `createCourseStudioKey` (used at line 559), and `type CourseSettingsInput` (used in `CourseInspectorProps`) — these are still used directly by the component.

Similarly trim this file's existing `./SpecificationsField` import — remove `specificationDrafts` and `specificationsPayload` (only used by the moved `formDraft`/`formPayload`). Keep the `SpecificationsField` component import (used in JSX). Double-check with a grep whether `type SpecificationDraft` is still referenced directly in the component body outside of `CourseFormDraft`'s definition — if not, drop it from this file's import too (it's re-exported via `CourseFormDraft`'s shape from the new file, which is enough if nothing in the component names `SpecificationDraft` directly).

Run: `grep -n "SpecificationDraft\b" apps/web/src/authoring/inspectors/CourseInspector.tsx` after the edit to confirm.

- [ ] **Step 4: Verify**

Run: `npm run lint && npm run typecheck`
Expected: both clean — a leftover unused import or a missed usage will surface here.

- [ ] **Step 5: Manual smoke check**

Run `npm run dev`, open the Course Inspector panel in Course Studio, edit the title/cover/specifications/disclaimer fields and save — confirm the form still validates and saves correctly (this is where `formDraft`/`formPayload`/`errorMap` do real work).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor: extract CourseInspector's draft/validation helpers

Moves objectiveDrafts/coverDraft/disclaimerDraft/formDraft/formFingerprint/
formPayload/errorMap and their CoverDraft/DisclaimerDraft/CourseFormDraft
types into a sibling course-inspector-draft.ts, mirroring the existing
lesson-draft.ts split for LessonInspector. CourseInspector.tsx drops from
709 lines to a component-only file.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

### Task 5.2: Extract `CourseFinalAssessmentCard` from `CourseQuizPlayer.tsx`

**Files:**

- Create: `apps/web/src/learning/player/lesson-types/CourseFinalAssessmentCard.tsx`
- Modify: `apps/web/src/learning/player/lesson-types/CourseQuizPlayer.tsx`

**Interfaces:**

- Produces (from the new file): `CourseFinalAssessmentCard` component, same props as today (an inline/unnamed props type — copy it verbatim).
- Consumes (in `CourseQuizPlayer.tsx`, from the new file): `CourseFinalAssessmentCard`, used at its two existing call sites (lines 211 and 229, per planning research — re-confirm by reading before editing since Phase 4 doesn't touch this file's line numbers but re-check regardless).

- [ ] **Step 1: Read the current file to copy exact code**

`Read apps/web/src/learning/player/lesson-types/CourseQuizPlayer.tsx` in full. Confirmed during planning research: `CourseFinalAssessmentCard` spans lines 494-580 — purely presentational, no hooks, no data fetching, no framer-motion. It uses only two icons from `lucide-react`: `RefreshCw` (line 554) and `Brain` (lines 526, 566) — not `CheckCircle2`, `XCircle`, `Loader2`, `ChevronRight`, `Trophy`, which the main `CourseQuizPlayer` component still needs and which stay in this file.

- [ ] **Step 2: Create `CourseFinalAssessmentCard.tsx`**

Move the component (lines 494-580, including its props type) verbatim into the new file, with:

```ts
import { RefreshCw, Brain } from 'lucide-react';
```

No other imports are required — confirmed the component references no contracts types, no `@/learning/quiz-session` imports, and nothing from `next/image` or `framer-motion`.

- [ ] **Step 3: Update `CourseQuizPlayer.tsx`**

Remove the extracted component from this file. Remove `RefreshCw` and `Brain` from this file's `lucide-react` import if they're not used elsewhere in the remaining ~450-line component (confirm with a grep before removing). Add:

```ts
import { CourseFinalAssessmentCard } from './CourseFinalAssessmentCard';
```

The two existing call sites (`<CourseFinalAssessmentCard ... />` at lines 211 and 229) need no change beyond this import — they already reference the component by its unchanged name.

- [ ] **Step 4: Verify**

Run: `npm run lint && npm run typecheck`
Expected: both clean.

- [ ] **Step 5: Manual smoke check**

Run `npm run dev`, complete a course final quiz in the player (pass and, if feasible, fail/retry) and confirm the final assessment card still renders and its retry button still works.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor: extract CourseFinalAssessmentCard from CourseQuizPlayer.tsx

Matches the one-component-per-file convention already used by every other
file in lesson-types/. CourseQuizPlayer.tsx drops from 580 to ~450 lines.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Final check

- [ ] **Run the full verification suite one more time after all phases**

```bash
npm run lint && npm run typecheck && npx prettier --check .
```

Expected: all three clean.

- [ ] **Confirm no accidental scope creep**

```bash
git log --oneline stg -20
git diff --stat main...stg -- services/parser-service scripts/seed-moto-g87-course.ts
```

Expected: the second command shows no output — confirming neither out-of-scope area was touched anywhere in this pass.
