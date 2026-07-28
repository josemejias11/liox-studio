# Course Studio Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the first production-ready Course Studio loop: author a structured Motorola course in PostgreSQL, preview it through the Moto Player, freeze an immutable revision, and collect client review feedback.

**Architecture:** Keep PostgreSQL as the source of truth and R2 as the media store. The authenticated Studio edits a resolved `CourseGraph` through protected application routes; the same graph is projected into the Moto Player for preview. Client review reads an immutable `CourseRevision.snapshot` through a token-scoped public route and stores feedback against that revision.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma/PostgreSQL, Zod, Tailwind CSS, Cloudflare R2.

## Completion status

Implemented on `stg` on 2026-07-28. The final implementation keeps the plan's
boundaries with two deliberate consolidations: the entity inspectors share one
focused `StudioInspector` instead of three repetitive wrappers, and the
lesson-type controls combine guided media upload with validated structured fields
so every current and future Moto Player block retains its complete payload.

Observed verification:

- all ten supported block types were created through authenticated Studio APIs and rendered in the outline;
- a Canvas screen was selected, edited, persisted, and immediately rendered by the non-persistent Moto Player preview;
- an immutable revision and replacement-safe review link were created;
- lesson-specific client feedback was submitted and observed in PostgreSQL;
- preview and review rendered without the Course AI assistant, learner progress writes, analytics requests, browser errors, or framework overlays;
- both temporary verification courses and their cascaded revisions, links, and feedback were removed afterward.

## Global Constraints

- Course Studio remains at `/studio` and uses `COURSE_STUDIO_PASSWORD`.
- Desktop authoring targets 1440×900; mobile authoring is not a priority.
- Existing learner routes, progress identifiers, player behavior, and learning interactions remain compatible.
- Preview and review never write learner progress or call AI.
- Localization, geolocation, Articulate packaging, SCORM/xAPI, Insiders, and HaLight adapters remain deferred.
- Existing payload metadata and media references are preserved unless the author explicitly edits the corresponding structured field.
- Do not create or run automated tests. Verify with `npm run typecheck`, `npm run lint`, `git diff --check`, `npm run build`, and desktop Chrome.

---

### Task 1: Complete the authoring repository and protected mutation contract

**Files:**
- Modify: `packages/database/src/course-repository.ts`
- Modify: `packages/database/src/index.ts`
- Create: `apps/web/src/app/api/course-studio/courses/[courseId]/route.ts`
- Create: `apps/web/src/app/api/course-studio/courses/[courseId]/chapters/route.ts`
- Create: `apps/web/src/app/api/course-studio/courses/[courseId]/lessons/route.ts`
- Create: `apps/web/src/app/api/course-studio/courses/[courseId]/reorder/route.ts`

**Interfaces:**
- Produces `updateCourseDetails(courseId, input): Promise<CourseGraph>`.
- Produces `createChapter(courseId, input): Promise<CourseGraph>`.
- Produces `updateChapter(chapterId, input): Promise<CourseGraph>`.
- Produces `deleteChapter(chapterId): Promise<CourseGraph>`.
- Produces `createLesson(chapterId, lessonType): Promise<CourseGraph>`.
- Produces `updateLesson(lessonId, input): Promise<CourseGraph>`.
- Produces `duplicateLesson(lessonId): Promise<CourseGraph>`.
- Produces `deleteLesson(lessonId): Promise<CourseGraph>`.
- Produces `reorderCourseItems(courseId, input): Promise<CourseGraph>`.

- [ ] Add explicit input types for course metadata, chapters, lessons, and ordering.
- [x] Define deterministic safe payload defaults for all supported lesson types: `content`, `interaction`, `stage`, `video`, `quiz`, `canvas`, `colorSwitcher`, `splitScreen`, `dragDrop`, and `scrollStory`.
- [ ] Implement every mutation in a Prisma transaction and normalize affected positions to contiguous zero-based values.
- [ ] Reject removal of the final chapter or final lesson so every draft remains previewable.
- [ ] Add Zod request schemas and require `isCourseStudioAuthorized()` on every mutation route.
- [ ] Return `{ course }` on success and stable `{ error }` responses with 400, 401, 404, or 409 status codes.
- [ ] Run `npm run typecheck`, `npm run lint`, and `git diff --check`.
- [ ] Commit with `feat: add course authoring mutations`.

### Task 2: Build the canvas-first Studio workspace

**Files:**
- Modify: `apps/web/src/app/studio/[courseId]/page.tsx`
- Create: `apps/web/src/course-studio/CourseStudioWorkspace.tsx`
- Create: `apps/web/src/course-studio/CourseOutline.tsx`
- Create: `apps/web/src/course-studio/StudioToolbar.tsx`
- Create: `apps/web/src/course-studio/studio-client.ts`
- Create: `apps/web/src/course-studio/studio-types.ts`

**Interfaces:**
- `CourseStudioWorkspace` consumes the server-loaded `CourseGraph`.
- `studio-client.ts` exposes typed mutation calls returning the updated graph.
- Selection uses `{ kind: 'course' | 'chapter' | 'lesson'; id: string }`.

- [ ] Replace the static route markup with a server-authenticated workspace entry point.
- [ ] Render a persistent three-column shell: outline, learner canvas, and inspector.
- [ ] Make course, chapter, and lesson rows selectable with visible active state and keyboard-operable buttons.
- [ ] Add chapter creation and a block picker containing every supported lesson type.
- [ ] Add duplicate, move up, move down, and delete controls for selected lessons.
- [ ] Add move and delete controls for chapters, with confirmation for destructive actions.
- [ ] Keep the selected item stable after successful mutations and retain the previous graph after failed mutations.
- [ ] Show saving, success, and recoverable error states without hiding the workspace.
- [ ] Run `npm run typecheck`, `npm run lint`, and `git diff --check`.
- [ ] Commit with `feat: build course studio workspace`.

### Task 3: Add course, chapter, and lesson inspectors

**Files:**
- Create: `apps/web/src/course-studio/StudioInspector.tsx`
- Create: `apps/web/src/course-studio/inspectors/CourseInspector.tsx`
- Create: `apps/web/src/course-studio/inspectors/ChapterInspector.tsx`
- Create: `apps/web/src/course-studio/inspectors/LessonInspector.tsx`
- Create: `apps/web/src/course-studio/inspectors/LessonInspector.tsx`
- Modify: `apps/web/src/course-studio/CourseStudioWorkspace.tsx`

**Interfaces:**
- Inspectors receive the selected entity and an async `onSave` callback.
- `LessonInspector` edits `headline`, `body`, and `payload` without changing `id`, `chapterId`, `position`, or `lessonType`.
- `LessonInspector` validates typed fields before submitting and preserves the last valid persisted value on failure.

- [ ] Add editable course title, slug, description, learning objectives, cover, specifications, and disclaimer controls.
- [ ] Add editable chapter title and estimated duration controls.
- [ ] Add common lesson headline and body controls.
- [ ] Add lesson-type guidance and validated payload editing for every existing block type.
- [x] Add explicit save controls and dirty-state messaging; do not autosave incomplete structured drafts.
- [x] Preserve unsupported or future payload keys by merging explicit edits into the persisted payload.
- [ ] Surface server validation errors beside the relevant inspector without discarding form input.
- [ ] Run `npm run typecheck`, `npm run lint`, and `git diff --check`.
- [ ] Commit with `feat: add course studio inspectors`.

### Task 4: Make preview selection-aware and non-persistent

**Files:**
- Modify: `apps/web/src/course-studio/AuthoringPreview.tsx`
- Modify: `apps/web/src/course-studio/CourseStudioWorkspace.tsx`
- Modify: `apps/web/src/player/MotoViewer.tsx`
- Modify: `apps/web/src/player/hooks/useLessonRuntime.ts`

**Interfaces:**
- `AuthoringPreview` receives the current graph projection and optional selected lesson ID.
- Preview mode accepts an initial lesson target and suppresses all progress, quiz-grading, upload, and AI writes.

- [ ] Project every successful graph mutation through `toPlayerCourseContent()` before rendering preview.
- [ ] Navigate the preview to the selected lesson without changing the learner route contract.
- [ ] Keep native lesson controls and interaction behavior available in preview.
- [ ] Add a focus-preview toggle that expands the player over the editor and restores the prior selection on exit.
- [ ] Show a precise invalid-content message when the current draft cannot be projected.
- [ ] Verify that preview interactions create no `/api/progress`, `/api/quiz/grade`, `/api/chat`, or `/api/upload` requests.
- [ ] Run `npm run typecheck`, `npm run lint`, and `git diff --check`.
- [ ] Commit with `feat: add selection aware course preview`.

### Task 5: Freeze immutable revisions and create review links

**Files:**
- Modify: `packages/database/src/course-repository.ts`
- Create: `packages/database/src/course-review-repository.ts`
- Modify: `packages/database/src/index.ts`
- Create: `apps/web/src/app/api/course-studio/courses/[courseId]/revisions/route.ts`
- Create: `apps/web/src/app/api/course-studio/revisions/[revisionId]/review/route.ts`
- Create: `apps/web/src/course-studio/RevisionPanel.tsx`
- Modify: `apps/web/src/course-studio/CourseStudioWorkspace.tsx`

**Interfaces:**
- Produces `createCourseRevision(courseId, notes): Promise<CourseRevisionSummary>`.
- Produces `listCourseRevisions(courseId): Promise<CourseRevisionSummary[]>`.
- Produces `createCourseReview(revisionId): Promise<{ reviewId: string; token: string }>`; only the token hash is persisted.
- Revision snapshots store the complete resolved `CourseGraph`.

- [ ] Serialize the resolved graph deterministically and calculate a SHA-256 source hash.
- [ ] Create the next integer revision version in a transaction.
- [ ] Return the existing revision instead of duplicating an identical source hash.
- [ ] List revision version, status, notes, created time, and review state in the Studio.
- [ ] Generate a cryptographically random review token, persist only its SHA-256 hash, and present the complete review URL once.
- [ ] Add “Freeze revision” and “Create review link” actions with clear immutable-copy language.
- [ ] Run `npm run typecheck`, `npm run lint`, and `git diff --check`.
- [ ] Commit with `feat: add immutable course revisions`.

### Task 6: Deliver the token-scoped client review and feedback loop

**Files:**
- Create: `apps/web/src/app/review/[token]/page.tsx`
- Create: `apps/web/src/app/api/reviews/[token]/feedback/route.ts`
- Create: `apps/web/src/review/ReviewPlayer.tsx`
- Create: `apps/web/src/review/ReviewFeedbackPanel.tsx`
- Modify: `packages/database/src/course-review-repository.ts`

**Interfaces:**
- Produces `getReviewByToken(token): Promise<ReviewSnapshot | null>`.
- Produces `createReviewFeedback(token, input): Promise<ReviewFeedback>`.
- Feedback input contains `authorName`, `message`, optional `lessonId`, and optional structured `anchor`.

- [ ] Resolve review access by hashing the supplied token and checking optional expiry.
- [ ] Render only the immutable revision snapshot through the same Moto Player projection.
- [ ] Display revision title and version so the client knows exactly what is being reviewed.
- [ ] Allow general feedback and feedback attached to the currently selected lesson.
- [ ] Persist feedback without granting Course Studio access or exposing the stored token hash.
- [ ] Render a useful unavailable-link page for invalid or expired tokens.
- [ ] Ensure review mode writes no learner progress and cannot mutate authored course records.
- [ ] Run `npm run typecheck`, `npm run lint`, and `git diff --check`.
- [ ] Commit with `feat: add client course review`.

### Task 7: Complete release verification and operational documentation

**Files:**
- Modify: `README.md`
- Modify: `DEPLOYMENT.md`
- Modify: `docs/superpowers/plans/2026-07-28-course-studio-completion.md`

**Interfaces:**
- Documents the implemented authoring and review routes, environment boundaries, and deferred export adapter.

- [ ] Mark completed plan steps and document the final Studio-to-review workflow.
- [ ] Document review-link security, immutable revision behavior, PostgreSQL ownership, and R2 media ownership.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run lint`.
- [ ] Run `git diff --check`.
- [ ] Run `npm run build` and confirm migrations complete and every Studio/review route is generated.
- [ ] Start `npm run dev` and verify at 1440×900: create course, add chapter, add each block type, reorder, edit, preview, freeze, create review link, submit lesson feedback, and reopen Studio to see persisted state.
- [ ] Inspect browser console and failed network requests; confirm no preview/review progress or AI writes.
- [ ] Remove regenerated caches and confirm `git status --short` contains only intentional source changes.
- [ ] Commit with `docs: complete course studio workflow`.
