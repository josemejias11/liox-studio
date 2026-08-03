# Task 4 — Learner runtime consolidation

## Outcome

- Moved learner-only UI from `apps/web/src/components` into `apps/web/src/learning/player` and its lesson-type subdirectory. No compatibility re-export paths remain.
- Made `lessonTypeRegistry` the sole persisted lesson-type-to-renderer mapping. `LessonRenderer` now delegates to the registry; an unrecognized runtime type still renders the content lesson fallback.
- Kept the three learning roles separate:
  - Chapter quick checks continue to render persisted `AuthoredQuiz` data through `CourseQuizPlayer`.
  - Lesson and final practice checks continue to use optional revision-bound AI quiz generation through `CourseQuiz`; previews render its inert preview state and do not create or grade quiz work.
  - `CourseChat` remains revision-bound grounded chat. Its shared `useChatConversation` hook remains in `components/course-ai` because discovery UI also consumes it.
- Session identity, `mototutor_session` progress key, progress writes, and preview/review persistence suppression are unchanged. Navigation retains all transition and completion rules in `useCourseNavigation`.

## Files changed

- Relocated learner screens, overlays, quiz UI, chat panel, hotspot, cover/complete, specification, and disclaimer components under `apps/web/src/learning/player`.
- Updated learner-only imports in `CoursePhaseScreen`, `PlayerOverlays`, and lesson renderers.
- Updated `apps/web/src/learning/player/lesson-types/registry.ts` and simplified `LessonRenderer.tsx`.

## Verification

- `rg -n 'CourseQuiz|CourseQuizPlayer|CourseChat|useChatConversation|quiz.*grade|/api/chat' apps/web/src` — classified authored quick checks, AI practice quizzes, and grounded chat before consolidation.
- `rg -n 'switch \(.*lessonType|COURSE_LESSON_TYPES' apps/web/src/learning` — no duplicate learner lesson-type switch or constant mapping remains.
- `rg -n 'courseMode|sanity' apps/web/src || true` — no retired course-mode or Sanity path remains.
- `rg` for prior learner component imports — no stale `@/components` learner UI imports remain.
- `git diff HEAD --check` — passed.
- `npm run typecheck` — passed for all workspaces.
- `npm run lint` — passed.

## Residual risk

- This is static, behavior-preserving cleanup. No automated tests, database changes, or browser verification were run, per task constraints; browser proof is delegated to Task 9.
