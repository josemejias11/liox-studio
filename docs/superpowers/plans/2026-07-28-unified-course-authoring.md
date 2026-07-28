# Unified Course Authoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove course-level `standard`/`canvas` modes while preserving Canvas lessons, and replace the lesson inspector's raw JSON fields with typed authoring controls for every supported lesson type.

**Architecture:** Keep `lessonType` as the single discriminator for lesson behavior. Remove `courseMode` end-to-end, then introduce a shared lesson draft/serializer boundary that preserves unknown payload metadata while type-specific inspector components edit known fields. The existing API, repository, R2 upload route, and Moto Player payload shapes remain the persistence/runtime boundaries.

**Tech Stack:** Next.js 16, React 19, TypeScript, Zod, Prisma/PostgreSQL, Tailwind CSS, existing Moto Player lesson contracts.

## Global Constraints

- No raw JSON editor is exposed as a normal or hidden lesson-authoring fallback.
- `canvas` remains a supported lesson type; only course-level modes are removed.
- Preserve lesson IDs, lesson ordering, existing player payload keys, asset references, and authored quiz semantics.
- Preserve unknown payload metadata when unrelated known fields are edited.
- No automated tests will be created or run; use typecheck, lint, diff checks, migration/build checks, and browser evidence.
- Do not overwrite unrelated dirty worktree changes.

---

### Task 1: Remove the course-level mode contract

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/20260728193000_remove_course_mode/migration.sql`
- Modify: `packages/database/src/course-repository.ts`
- Modify: `apps/web/src/lib/course-modes.ts`
- Modify: `apps/web/src/lib/contracts/player-course.ts`
- Modify: `apps/web/src/lib/contracts/course-studio.ts`
- Modify: `apps/web/src/course-studio/inspectors/CourseInspector.tsx`
- Modify: `apps/web/src/lib/course-player-adapter.ts`
- Modify: `apps/web/src/app/page.tsx`
- Modify: `apps/web/src/app/api/course-studio/courses/[courseId]/route.ts` only if its input type import requires adjustment

**Interfaces:**
- Produces a `CourseGraph` without `courseMode`, `CourseSettingsInput` without `courseMode`, and `CourseContent`/`CourseSummary` without `courseMode`.
- Preserves `CourseLessonType` and `ALL_LESSON_TYPES`, including `canvas`.

- [ ] **Step 1: Remove the Prisma field and add the narrow migration.**

  Delete `courseMode String @default("standard")` from the `Course` model. Add a migration containing exactly:

  ```sql
  ALTER TABLE "Course" DROP COLUMN "courseMode";
  ```

- [ ] **Step 2: Remove mode from repository inputs and selects.**

  Delete `courseMode` from `CourseDetailsInput`, `CourseGraph`, course creation data, update data, published summary selects, and authoring/published course selects. Do not alter lesson type arrays or the `lessonType: 'canvas'` path.

- [ ] **Step 3: Remove mode from application contracts and adapters.**

  Delete `CourseMode`, `courseModeSchema`, and mode properties from the player/course-studio Zod schemas. Remove `courseMode` from `rawCourse` and `toPlayerCourseSummary` input/output. Keep `ALL_LESSON_TYPES` as the lesson discriminator.

- [ ] **Step 4: Remove mode UI and labels.**

  Remove the Course Settings mode draft/select and replace the published course card's mode label with a neutral `Learning course` label or omit the label. Ensure no UI copy claims Canvas is a course mode.

- [ ] **Step 5: Generate and typecheck the contract cleanup.**

  Run `npm run db:generate` and `npm run typecheck`. Expected: both exit 0; any remaining `courseMode` references must be limited to the historical migration/spec text until the documentation task removes misleading current references.

- [ ] **Step 6: Commit only this task's files.**

  Use `git add` with the listed paths and commit message `refactor: unify course mode contract` when workspace permissions allow it. Do not stage unrelated existing changes.

### Task 2: Define typed lesson drafts and serializers

**Files:**
- Create: `apps/web/src/lib/contracts/lesson-studio.ts`
- Create: `apps/web/src/course-studio/inspectors/lesson/lesson-draft.ts`
- Create: `apps/web/src/course-studio/inspectors/lesson/lesson-serializer.ts`

**Interfaces:**
- `LessonDraft` is discriminated by `lessonType` and contains `headline`, `body`, `originalPayload`, plus typed payload fields.
- `createLessonDraft(lesson: CourseGraph['chapters'][number]['lessons'][number]): LessonDraft` converts persisted values without throwing on malformed optional data.
- `serializeLessonDraft(draft: LessonDraft): { headline: string; body: Prisma.InputJsonValue | null; payload: Prisma.InputJsonValue }` merges known fields over `originalPayload` and strips client-only row keys.

- [ ] **Step 1: Add shared editor primitives and validation schemas.**

  Define JSON-safe `ImageReference`, stable client row keys, rich-body draft (`string` plus untouched original value), numeric parsing helpers that reject blank/`NaN`, and repeatable row schemas for hotspots, features, quiz questions/answers, color variants, chips/drop zones, and scroll chapters.

- [ ] **Step 2: Implement type-specific draft construction.**

  Read known fields from `lesson.payload` into defaults matching `player-course.ts`: `media`, `textOverlay`, `coveredFeatures`, `hotspots`, `stageBackground`, completion settings, `videoFile`, `videoAspectRatio`, quiz fields, `colorVariants`, `splitReverseLayout`, `chips`, `dropZones`, and `scrollChapters`. Preserve the original payload object for merge-on-save.

- [ ] **Step 3: Implement payload merge serialization.**

  Use `mergeKnownFields`-style behavior: copy the original payload, write only the selected lesson's known keys, delete known keys when explicitly cleared, and never write `clientKey`. Emit `body: null` only when the author clears a body; untouched Portable Text must be returned unchanged.

- [ ] **Step 4: Add validation error mapping.**

  Return field paths such as `hotspots.0.label`, `quiz.questions.1.answers.0.text`, and `scrollChapters.0.heading` so repeatable controls can show errors next to the exact row. Save must be considered invalid if a required row is empty or a numeric value is not finite.

- [ ] **Step 5: Run typecheck for the standalone contract boundary.**

  Run `npm run typecheck`. Expected: exit 0 before the new boundary is integrated into `StudioInspector`.

### Task 3: Build reusable structured lesson controls

**Files:**
- Create: `apps/web/src/course-studio/inspectors/lesson/FieldError.tsx`
- Create: `apps/web/src/course-studio/inspectors/lesson/AssetField.tsx`
- Create: `apps/web/src/course-studio/inspectors/lesson/RepeatableField.tsx`
- Create: `apps/web/src/course-studio/inspectors/lesson/HotspotsField.tsx`
- Create: `apps/web/src/course-studio/inspectors/lesson/CoveredFeaturesField.tsx`
- Create: `apps/web/src/course-studio/inspectors/lesson/QuizQuestionsField.tsx`
- Create: `apps/web/src/course-studio/inspectors/lesson/VariantsField.tsx`
- Create: `apps/web/src/course-studio/inspectors/lesson/DragDropField.tsx`
- Create: `apps/web/src/course-studio/inspectors/lesson/ScrollChaptersField.tsx`

**Interfaces:**
- Every control is controlled, accepts `disabled`, receives row-scoped errors, and returns a typed draft update callback.
- `AssetField` calls the shared upload callback with a field identifier (`media`, `stageBackground`, `videoFile`, `hotspot.photos`, `scrollChapters.image`, or `colorVariants.image`).

- [ ] **Step 1: Build common field/error and repeatable-row controls.**

  Use existing Course Settings visual conventions: 44px action targets, inline error text, add/remove/reorder buttons, and explicit labels. Client keys remain local and are not persisted.

- [ ] **Step 2: Build the asset control.**

  Reuse `/api/course-studio/assets`, show the current filename/preview when available, disable the complete inspector while upload is active, and report failures without mutating the current reference.

- [ ] **Step 3: Build hotspots/features controls.**

  Expose label, topic, body, x/y percentages, required, optional photos, optional video, and covered-feature summaries. Add, remove, and reorder rows while preserving each hotspot `_key` when it already exists.

- [ ] **Step 4: Build quiz, variant, drag/drop, and scroll-story controls.**

  Quiz controls edit question text/type/answers and course-level quiz settings without exposing correctness keys. Variant controls edit labels/colors/images. Drag/drop controls enforce unique chip IDs and allow a drop zone to select one existing chip. Scroll chapters edit ordered heading/body/image/transform values.

- [ ] **Step 5: Run lint and typecheck for controls.**

  Run `npm run lint` and `npm run typecheck`. Expected: exit 0; no control should contain a JSON textarea or call `JSON.parse` on author input.

### Task 4: Implement the typed LessonInspector

**Files:**
- Create: `apps/web/src/course-studio/inspectors/LessonInspector.tsx`
- Modify: `apps/web/src/course-studio/StudioInspector.tsx`
- Modify: `apps/web/src/course-studio/CourseStudioWorkspace.tsx` only if the dirty/upload callback contract needs forwarding

**Interfaces:**
- `LessonInspector` accepts `course`, `lesson`, `disabled`, `onDirtyChange`, `onUploadStateChange`, and `onSaveLesson`.
- `StudioInspector` delegates lesson selections to `LessonInspector`; its chapter and course branches remain intact.

- [ ] **Step 1: Move lesson draft lifecycle out of `StudioInspector`.**

  Initialize from the selected lesson, reset when the lesson identity changes, track a fingerprint excluding client keys, and report dirty state to the workspace. Remove `JsonEditor`, `parseJson`, and raw `body`/`payload` form strings from `StudioInspector`.

- [ ] **Step 2: Render shared fields and type-specific controls.**

  Render headline/body plus the controls from Task 3 based on `lesson.lessonType`. `content` and `interaction` share the content editor; `stage`, `canvas`, `video`, `quiz`, `colorSwitcher`, `splitScreen`, `dragDrop`, and `scrollStory` each render only their defined fields.

- [ ] **Step 3: Wire uploads to typed draft fields.**

  Replace the old payload-wide upload mutation with a field-aware updater. Uploading a video writes `videoFile`; stage image writes `stageBackground`; other media writes `media`; repeatable-row uploads update only the selected row.

- [ ] **Step 4: Add validation, save, and locked states.**

  Show errors as soon as a dirty draft is invalid, disable Save while invalid/saving/uploading, preserve drafts after API errors, and call `onSaveLesson(lesson.id, serializeLessonDraft(draft))` only after validation succeeds.

- [ ] **Step 5: Verify all lesson branches statically.**

  Run `npm run typecheck`, `npm run lint`, and `git diff --check`. Confirm with `rg` that the lesson inspector no longer contains raw JSON labels, `JSON.parse`, or a block-configuration textarea.

### Task 5: Update documentation and remove misleading references

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-07-27-course-studio-authoring-app-design.md` only where current product wording still calls Canvas a course mode
- Modify: `docs/superpowers/plans/2026-07-28-course-studio-completion.md` to reflect the unified course contract and typed editors

- [ ] **Step 1: Document the unified course boundary.**

  State that all courses share one workflow and Canvas is an optional lesson block. Remove current standard-versus-Canvas course labels and any instructions that ask authors to select a course mode.

- [ ] **Step 2: Document structured lesson authoring.**

  List the typed fields available per lesson family and state that the player preview consumes the same saved lesson contract. Do not document JSON editing as an escape hatch.

- [ ] **Step 3: Run documentation diff checks.**

  Run `rg -n "standard course|canvas course|course mode|courseMode" README.md docs --glob '*.md'` and inspect every remaining hit. Historical migration filenames and this design/plan may mention the removal; current product instructions must not.

### Task 6: Integrated verification and release handoff

**Files:**
- No new source files; verify the files changed above.

- [ ] **Step 1: Generate Prisma client.**

  Run `npm run db:generate`. Expected: exit 0.

- [ ] **Step 2: Apply the local mode-removal migration when explicitly authorized.**

  Run `npm run db:migrate` against the local PostgreSQL service. Expected: the new migration applies and Prisma reports the database is up to date. If authorization or database reachability is unavailable, report the exact blocker and do not claim migration success.

- [ ] **Step 3: Run static checks.**

  Run `npm run typecheck`, `npm run lint`, and `git diff --check`. Expected: all exit 0.

- [ ] **Step 4: Perform browser evidence.**

  In Course Studio, select one lesson of each type, edit a typed field, observe inline validation, upload a representative asset, save, reload, and confirm the preview uses the saved value. Verify Canvas remains selectable and playable inside a unified course. Confirm no inspector view presents raw JSON.

- [ ] **Step 5: Review the final diff and report unverified paths.**

  Use `git status --short`, `git diff --stat`, and targeted `rg` checks. Report migration/build/browser limitations explicitly; do not create or run automated tests.
