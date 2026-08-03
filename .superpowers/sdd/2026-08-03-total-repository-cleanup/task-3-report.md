# Task 3 Report: Studio state and inspector consolidation

## Implementation

- Kept `CourseStudioWorkspace` as the route-facing coordinator and moved unsaved-course selection/back-navigation protection into `useStudioSelection` and persistent desktop resize behavior into `useStudioPanelLayout`.
- Made `RepeatableField` the sole owner of keyed append, replacement, reorder, and removal. Lesson-specific fields retain their labels, input controls, defaults, and validation.
- Moved all typed lesson row factories and client/persisted key generation into `lesson-draft.ts`. The visual hotspot canvas now updates/removes rows by client key through the shared collection actions.
- Consolidated lossless lesson conversion in `lesson-serializer.ts`: reusable hotspot and covered-feature serializers preserve unknown metadata, Portable Text (including marks and `layerLink`), nested asset metadata, and explicit removal through undefined payload keys.
- Removed narrative comments while retaining the data-loss prevention invariants around original asset payloads and Portable Text.

## Commands and observed results

| Command | Result |
| --- | --- |
| `rg -n 'crypto\\.randomUUID|setDraft|onRemove|onAdd|onMove|mergeKnownFields|jsonObject' apps/web/src/authoring` | Identified the duplicated collection operations before consolidation; remaining key generation for typed lesson rows is centralized in `lesson-draft.ts`. |
| `rg -n 'mergeKnownFields|serialize.*Lesson|createCourseStudioKey' apps/web/src/authoring` | Confirmed all lesson client-key factories are in `lesson-draft.ts` and `serializeLessonDraft` remains the sole lesson persistence entry point. |
| `npm run typecheck` | Exit 0; TypeScript passed for job-worker, web, contracts, database, jobs, and parser-client. |
| `npm run lint` | Exit 0; ESLint completed for `apps`, `packages`, and `scripts`. |
| `git diff --check` | Exit 0; no whitespace errors. |

No automated tests were added or run, per task constraints.

## Files changed

- `apps/web/src/authoring/CourseStudioWorkspace.tsx`
- `apps/web/src/authoring/useStudioSelection.ts`
- `apps/web/src/authoring/useStudioPanelLayout.ts`
- `apps/web/src/authoring/inspectors/CourseInspector.tsx`
- `apps/web/src/authoring/inspectors/lesson/{lesson-draft,lesson-serializer}.ts`
- `apps/web/src/authoring/inspectors/lesson/{RepeatableField,HotspotCanvas,HotspotsField,QuizQuestionsField,ScrollChaptersField,VariantsField,CoveredFeaturesField,DragDropField}.tsx`

## Concerns

- Verification is static only. No authenticated save/reload or learner-preview browser session was run in this task; those flows retain their existing contracts and need end-to-end evidence separately.

## Fix round 1

### Implementation

- Extracted course graph, saving/status, Trash, undo, and generic load/save lifecycle into `useStudioCoursePersistence`.
- Extracted chapter, lesson, reorder, duplicate, Trash, restore, permanent-delete, empty, and course/chapter/lesson save orchestration into `useStudioCourseCommands`.
- Kept the former command order unchanged: mutation state starts before the client call; successful graph replacement precedes selection reconciliation; structural mutations clear undo only after success; each original status and error message remains unchanged.
- `CourseStudioWorkspace` now coordinates persistence, selection, panel layout, preview focus, and inspector rendering without direct `studioClient` calls or CRUD command definitions.

### Commands and observed results

| Command | Result |
| --- | --- |
| `rg -n 'async function (run|addChapter|addLesson|moveScreenToTrash|restoreTrashItem|permanentlyDeleteTrashItem|emptyTrash|action|saveCourse)|studioClient\\.' apps/web/src/authoring/CourseStudioWorkspace.tsx apps/web/src/authoring/useStudioCourseCommands.ts` | All persistence lifecycle and `studioClient` calls are in `useStudioCourseCommands.ts`; none remain in the workspace. |
| `npm run typecheck` | Exit 0; TypeScript passed for job-worker, web, contracts, database, jobs, and parser-client. |
| `npm run lint` | Exit 0; ESLint completed for `apps`, `packages`, and `scripts`. |
| `git diff --check` | Exit 0; no whitespace errors. |

No automated tests were added or run, per task constraints.
