# Course Studio Authoring App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for this approved direct-on-`dev` implementation. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the embedded Sanity Studio into Course Studio, Lionbridge's canvas-first web authoring application for creating complete Motorola e-learning masters.

**Architecture:** Preserve the current Course → Chapter → Lesson → Quiz Sanity model and learner player. Add a custom Studio tool that resolves that graph into a desktop authoring shell, performs intentional Sanity transactions for structure changes, and uses the existing player components through a non-persistent preview adapter. Replace the premature localization release model with a full master-release snapshot; leave agency delivery format and downstream Insiders/HaLight integration out of scope.

**Tech Stack:** Next.js 16, React 19, TypeScript, Sanity Studio 5, `@sanity/ui`, GROQ, existing learner player components.

## Global Constraints

- Work directly on `dev`; do not create or use a worktree for this project transformation.
- Course Studio is Lionbridge-only inside `/studio`; create no external dashboard, login, Motorola account, or agency account.
- Target desktop 1440×900. Do not optimize authoring for mobile.
- Preserve learner routes, existing progress keys, all existing lesson runtime contracts, and the meaning of every current lesson type.
- Expose all ten current lesson types in the visual block library.
- Do not geolocate, translate, replace, package, or manage individual assets.
- Do not implement Insiders/HaLight adapters or decide the agency handoff file/package format.
- Do not create or run automated tests, start Ollama, or make AI API calls.
- Verify only with `npm run typecheck`, `npm run lint`, `git diff --check`, and desktop Chrome at 1440×900.

---

## File structure

| File | Responsibility |
| --- | --- |
| `apps/web/sanity.config.ts` | Registers the Course Studio custom Studio tool. |
| `apps/web/src/sanity/course-studio/CourseStudioTool.tsx` | Top-level Lionbridge authoring tool, course loading, selection, and mutations. |
| `apps/web/src/sanity/course-studio/authoring-types.ts` | Local resolved graph and selection contracts; never exported to learner code. |
| `apps/web/src/sanity/course-studio/authoring-query.ts` | Resolved authoring-only GROQ query including all Course graph fields. |
| `apps/web/src/sanity/course-studio/block-catalog.ts` | Exact catalog and safe defaults for all ten lesson types. |
| `apps/web/src/sanity/course-studio/authoring-mutations.ts` | Isolated document creation, append, reorder, duplicate, delete, and freeze transactions. |
| `apps/web/src/sanity/course-studio/components/*` | Canvas-first shell, outline, library, inspector, preview, and master-release UI. |
| `apps/web/src/sanity/schemaTypes/courseMasterRelease.ts` | Frozen complete master release document. |
| `apps/web/src/sanity/schemaTypes/course.ts` | Replaces locale-release fields with master-release links only. |
| `apps/web/src/sanity/schemaTypes/index.ts` | Registers the master release type. |
| `apps/web/src/sanity/structure.ts` | Removes the premature localization navigation; preserve authoring archives. |

### Task 1: Replace locale releases with full Course master releases

**Files:**
- Create: `apps/web/src/sanity/schemaTypes/courseMasterRelease.ts`
- Modify: `apps/web/src/sanity/schemaTypes/course.ts`
- Modify: `apps/web/src/sanity/schemaTypes/index.ts`
- Modify: `apps/web/src/sanity/structure.ts`
- Delete: `apps/web/src/sanity/schemaTypes/courseLocaleRelease.ts`
- Delete: `apps/web/src/sanity/components/CourseLocalizationInput.tsx`
- Delete: `apps/web/src/sanity/lib/localization-query.ts`
- Delete: `apps/web/src/sanity/lib/localization-inventory.ts`

**Interfaces:**
- Produces `CourseMasterReleaseStatus = 'draft' | 'ready' | 'delivered' | 'archived'`.
- Adds `course.masterReleases[]` references and removes `sourceLocale` / `localizationReleases`.

- [ ] Define `courseMasterRelease` with required `sourceCourse`, `sourceRevision`, `sourceFingerprint`, `sourceTitle`, `snapshot`, and `status`; keep `createdAt` automatic and expose optional `notes` and `deliveredAt`.
- [ ] Make `snapshot` a read-only `text` field containing serialized JSON. It stores the full resolved authored graph and unchanged Sanity asset references; it is not an export package.
- [ ] Register the type immediately after `courseType` and update Course Studio group copy to `Master releases` with Lionbridge-only delivery tracking.
- [ ] Remove all locale-release UI, navigation, and code so the product cannot imply asset or text localization work.
- [ ] Run `npm run typecheck`, `npm run lint`, and `git diff --check`.

### Task 2: Add the Course Studio tool and authoring graph contract

**Files:**
- Create: `apps/web/src/sanity/course-studio/authoring-types.ts`
- Create: `apps/web/src/sanity/course-studio/authoring-query.ts`
- Create: `apps/web/src/sanity/course-studio/CourseStudioTool.tsx`
- Modify: `apps/web/sanity.config.ts`

**Interfaces:**
- `AUTHORING_COURSES_QUERY` returns course id/title/thumbnail and sort metadata.
- `AUTHORING_COURSE_QUERY($courseId)` resolves Course, Chapters, Lessons, Quick Checks, Specifications, Disclaimer, and all current lesson fields needed by the existing player.
- `CourseStudioTool` accepts Sanity's tool component props and does not import learner route code.

- [ ] Define local `AuthoringCourse`, `AuthoringChapter`, `AuthoringLesson`, `AuthoringQuiz`, `AuthoringSelection`, and `AuthoringGraph` interfaces. Include only values the authoring shell needs and retain `_id`, `_rev`, `_key`, and asset references.
- [ ] Write the authoring GROQ queries separately from `COURSES_QUERY` and `COURSE_BY_SLUG_QUERY`; do not modify public learner queries.
- [ ] Register a top-level custom tool `{ name: 'course-studio', title: 'Course Studio', component: CourseStudioTool }` in `sanity.config.ts` while preserving Structure and Vision tools.
- [ ] Build the initial tool state: course list, selected Course, async graph loading, retryable error state, and empty state with `Create a course`.
- [ ] Run the permitted static checks.

### Task 3: Build the Canvas-first authoring shell and course template

**Files:**
- Create: `apps/web/src/sanity/course-studio/components/AuthoringShell.tsx`
- Create: `apps/web/src/sanity/course-studio/components/CourseOutline.tsx`
- Create: `apps/web/src/sanity/course-studio/components/BlockLibrary.tsx`
- Create: `apps/web/src/sanity/course-studio/components/SelectionInspector.tsx`
- Create: `apps/web/src/sanity/course-studio/authoring-mutations.ts`
- Create: `apps/web/src/sanity/course-studio/block-catalog.ts`
- Modify: `apps/web/src/sanity/course-studio/CourseStudioTool.tsx`

**Interfaces:**
- `BLOCK_CATALOG` contains exactly `content`, `interaction`, `stage`, `video`, `quiz`, `canvas`, `colorSwitcher`, `splitScreen`, `dragDrop`, and `scrollStory`.
- `createLionbridgeCourse(client, input)`, `createChapter(client, courseId)`, and `createLesson(client, chapterId, lessonType)` return created canonical document IDs.
- `moveLesson(client, chapterId, lessonKey, direction)` and `moveChapter(client, courseId, chapterKey, direction)` preserve all existing array keys and reference identities.

- [ ] Implement deterministic valid defaults per block. Every Lesson has a headline, stable document id, `lessonType`, and only the minimum additional required fields for that type. Never generate production copy or call AI.
- [ ] Implement the Lionbridge template transaction: create Course, first Chapter, first `content` Lesson, then patch references in order. Use one transaction so a failed template does not leave a half-linked course.
- [ ] Make the 1440×900 shell three columns: outline left, canvas center, inspector right. It must remain usable without horizontal overlap at the target desktop size.
- [ ] Add course creation, chapter creation, block library insertion, selection, duplicate, move up/down, and confirmed removal. Disallow deleting the final remaining Chapter or final remaining screen without a replacement path.
- [ ] Surface mutation errors in the shell and retain author selection on failure.
- [ ] Run permitted static checks.

### Task 4: Implement the guided inspector for every current learning block

**Files:**
- Create: `apps/web/src/sanity/course-studio/components/CourseInspector.tsx`
- Create: `apps/web/src/sanity/course-studio/components/ChapterInspector.tsx`
- Create: `apps/web/src/sanity/course-studio/components/LessonInspector.tsx`
- Create: `apps/web/src/sanity/course-studio/components/lesson-fields/SharedLessonFields.tsx`
- Create: `apps/web/src/sanity/course-studio/components/lesson-fields/InteractionFields.tsx`
- Create: `apps/web/src/sanity/course-studio/components/lesson-fields/MediaFields.tsx`
- Create: `apps/web/src/sanity/course-studio/components/lesson-fields/SpecializedFields.tsx`
- Modify: `apps/web/src/sanity/course-studio/components/SelectionInspector.tsx`
- Modify: `apps/web/src/sanity/course-studio/authoring-mutations.ts`

**Interfaces:**
- `patchDocument(client, documentId, patch)` is the only inspector persistence entry point.
- Inspector fields patch only selected document paths; no generic full-document overwrite is allowed.

- [ ] Add shared Course, Chapter, and Lesson fields: title, description, learning objectives, duration, headline, body copy, quick recall, and source media references.
- [ ] Add type-specific panels for all ten blocks. Hotspot/stage/canvas expose hotspot labels, required flag, coordinates, and body; video exposes source file and ratio; colour switcher exposes variants; split screen exposes secondary media/content; drag/drop exposes chips/zones; scroll story exposes steps and viewport targets; quiz exposes its existing question and feedback model.
- [ ] Preserve existing Portable Text and asset values when the author does not edit them. Plain-text authoring controls must never coerce a rich-text document to a string.
- [ ] Use explicit `Save` feedback after each mutation and retain a local error for validation/mutation failures.
- [ ] Run permitted static checks.

### Task 5: Reuse learner rendering for non-persistent canvas preview

**Files:**
- Create: `apps/web/src/sanity/course-studio/components/AuthoringPreview.tsx`
- Create: `apps/web/src/sanity/course-studio/components/PreviewFocusDialog.tsx`
- Modify: `apps/web/src/player/LessonRenderer.tsx` only if a narrow preview prop is required
- Modify: `apps/web/src/sanity/course-studio/components/AuthoringShell.tsx`

**Interfaces:**
- `AuthoringPreview` accepts an `AuthoringLesson`, uses local visited state, and passes `persistSession={false}` to any reused player rendering boundary.
- Preview callbacks mutate local preview state only. They never call learner progress APIs, write Sanity, call AI, or change Course structure.

- [ ] Adapt the resolved authoring lesson to the existing `LessonSection` rendering shape without adding Course Studio data to public learner contracts.
- [ ] Render the selected screen in the center panel using the same current presentation components. Provide safe no-op next/previous handlers and isolated preview visit tracking.
- [ ] Add `Focus preview` to expand the live desktop screen in a dialog; Escape closes it and focus returns to its trigger.
- [ ] Show a stable empty-preview state for Course/Chapter selection and a useful missing-media state for incomplete blocks.
- [ ] Run permitted static checks and desktop browser checks at exactly 1440×900.

### Task 6: Freeze a complete master and show release history

**Files:**
- Create: `apps/web/src/sanity/course-studio/components/MasterReleasePanel.tsx`
- Create: `apps/web/src/sanity/course-studio/master-snapshot.ts`
- Modify: `apps/web/src/sanity/course-studio/authoring-query.ts`
- Modify: `apps/web/src/sanity/course-studio/authoring-mutations.ts`
- Modify: `apps/web/src/sanity/course-studio/components/AuthoringShell.tsx`

**Interfaces:**
- `buildMasterSnapshot(graph): Promise<MasterSnapshot>` returns an immutable ordered graph plus a lowercase SHA-256 fingerprint.
- `createMasterRelease(client, graph)` creates one canonical `courseMasterRelease` linked to the Course and blocks a duplicate Course/revision record.

- [ ] Build a complete snapshot from the authoring graph with existing asset references preserved, source Course revision, title, chapters, lessons, quick checks, specifications, and disclaimer.
- [ ] Hash the ordered serialized snapshot with browser-safe `crypto.subtle.digest`; do not derive identity from display labels.
- [ ] Add the `Freeze master` action. It creates a `draft` master release and appends its reference to `course.masterReleases[]`; it does not modify live learner content.
- [ ] Show master history newest first with title, source revision, lifecycle status, creation time, and link to the release document. Do not add package download, partner handoff, translation, approval, or publish controls.
- [ ] Run permitted static checks.

### Task 7: Final desktop acceptance pass and documentation update

**Files:**
- Modify: `README.md` only if its Studio authoring instructions are inaccurate after the new tool exists.
- Modify: `docs/superpowers/specs/2026-07-27-course-studio-authoring-app-design.md` only to record actual verification limitations.

- [ ] At `/studio` in Chrome desktop exactly 1440×900, confirm Course Studio appears as a custom tool, course selection and the Lionbridge template work, all ten blocks appear in the library, and the three-column canvas-first shell has no overlaps.
- [ ] Select at least one existing screen from each interaction family where authored data exists; confirm preview opens without learner progress writes or console errors.
- [ ] Freeze one master only if a disposable authorized Course exists. Otherwise record that the action was source-reviewed/static-verified rather than changing real Course data.
- [ ] Confirm the public learner home and one existing Course route still render the English source unchanged.
- [ ] Run `npm run typecheck`, `npm run lint`, and `git diff --check`; do not run tests, Ollama, or AI calls.

## Plan self-review

- **Spec coverage:** Tasks 1–6 implement the authoring app, all current learning blocks, canvas-first desktop UI, live preview, and an internal master release. Task 7 verifies the protected learner boundary. Motorola delivery systems and agency package format remain explicitly absent.
- **Placeholder scan:** No requirements defer a required implementation inside this plan; only external delivery format is intentionally out of scope.
- **Type consistency:** `AuthoringGraph`, `BLOCK_CATALOG`, authoring mutation functions, `AuthoringPreview`, `MasterSnapshot`, and `createMasterRelease` are named before their consumers.
