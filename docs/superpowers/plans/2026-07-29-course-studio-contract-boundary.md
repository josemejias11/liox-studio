# Course Studio contract boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Course Studio graph a JSON-safe shared contract instead of a browser-facing export from the Prisma database package.

**Architecture:** `@moto-ai/contracts/course-studio` will own the lesson-type catalog, authoring mutation inputs, and graph returned to Studio clients. `@moto-ai/database` will import and temporarily re-export these types while retaining every Prisma query and JSON-null conversion. The Next.js Studio UI and lesson route will consume the shared contract, so persistence implementation types do not leak across the client/server boundary.

**Tech Stack:** npm workspaces, TypeScript, Next.js 16, React 19, Prisma 5, Zod 4.

## Global Constraints

- Preserve all existing Course Studio routes, response payloads, status codes, authorization, and mutation behavior.
- Preserve every lesson type and its existing persisted string value, including `canvas`.
- Treat authored JSON as `unknown` at the contract boundary so unknown legacy metadata continues to round-trip through the existing editor serializers.
- Keep Prisma-specific types and `Prisma.JsonNull` conversion in `packages/database`.
- Do not create or run automated test files for this repository; use the existing static verification commands only.
- Do not modify the job worker, learner progress keys, or player rendering behavior.

---

### Task 1: Create the Course Studio graph contract

**Files:**
- Create: `packages/contracts/src/course-studio.ts`
- Modify: `packages/contracts/package.json`

**Interfaces:**
- Produces: `COURSE_LESSON_TYPES`, `CourseLessonType`, `ChapterInput`, `LessonInput`, `CourseGraphLesson`, `CourseGraphChapter`, and `CourseGraph` from `@moto-ai/contracts/course-studio`.

- [x] **Step 1: Define the JSON-safe public surface**

```ts
export const COURSE_LESSON_TYPES = [
  'content', 'interaction', 'stage', 'video', 'quiz',
  'canvas', 'colorSwitcher', 'splitScreen', 'dragDrop', 'scrollStory',
] as const;

export type CourseLessonType = (typeof COURSE_LESSON_TYPES)[number];

export interface LessonInput {
  headline?: string;
  body?: unknown | null;
  payload?: unknown;
}
```

Define `ChapterInput` plus the three graph interfaces with the exact fields currently returned by `getAuthoringCourse`. Type all persisted JSON fields (`body`, `payload`, course metadata, and quick-check payload) as `unknown` or `unknown | null`; do not convert or validate their content in this contract.

- [x] **Step 2: Publish the focused subpath**

```json
"exports": {
  "./course-assets": "./src/course-assets.ts",
  "./course-studio": "./src/course-studio.ts",
  "./jobs": "./src/jobs.ts",
  "./quiz": "./src/quiz.ts"
}
```

- [x] **Step 3: Typecheck the contracts package**

Run: `npm run typecheck --workspace=@moto-ai/contracts`

Expected: TypeScript exits successfully with the new contract as an independent workspace export.

### Task 2: Keep database ownership strictly persistence-only

**Files:**
- Modify: `packages/database/src/course-repository.ts`
- Modify: `packages/database/src/index.ts`

**Interfaces:**
- Consumes: the Task 1 shared graph and mutation types.
- Produces: unchanged `@moto-ai/database` repository functions and transitional type exports for server consumers.

- [x] **Step 1: Replace the duplicated public graph declarations**

```ts
import type {
  ChapterInput,
  CourseGraph,
  CourseGraphChapter,
  CourseGraphLesson,
  CourseLessonType,
  LessonInput,
} from '@moto-ai/contracts/course-studio';
import { COURSE_LESSON_TYPES } from '@moto-ai/contracts/course-studio';

export { COURSE_LESSON_TYPES };
export type {
  ChapterInput, CourseGraph, CourseGraphChapter,
  CourseGraphLesson, CourseLessonType, LessonInput,
};
```

Remove only the duplicated lesson-type and graph/input declarations. Retain `CourseDetailsInput`, `jsonValue`, all Prisma selects, and all query/mutation function signatures.

- [x] **Step 2: Preserve transitional database-package exports**

Update `packages/database/src/index.ts` to re-export the shared contract types and lesson-type constant through its existing public API. This prevents unrelated server consumers from breaking in this refactor while new browser-facing code moves to the contract package.

- [x] **Step 3: Typecheck the database package**

Run: `npm run typecheck --workspace=@moto-ai/database`

Expected: Prisma query results remain assignable to the JSON-safe graph contract and all database repository exports remain present.

### Task 3: Move Course Studio consumers to the shared contract

**Files:**
- Modify: `apps/web/src/course-studio/CourseStudioWorkspace.tsx`
- Modify: `apps/web/src/course-studio/CourseOutline.tsx`
- Modify: `apps/web/src/course-studio/StudioInspector.tsx`
- Modify: `apps/web/src/course-studio/studio-client.ts`
- Modify: `apps/web/src/course-studio/studio-types.ts`
- Modify: `apps/web/src/course-studio/inspectors/CourseInspector.tsx`
- Modify: `apps/web/src/course-studio/inspectors/LessonInspector.tsx`
- Modify: `apps/web/src/course-studio/inspectors/lesson/lesson-serializer.ts`
- Modify: `apps/web/src/lib/contracts/lesson-studio.ts`
- Modify: `apps/web/src/lib/course-player-adapter.ts`

**Interfaces:**
- Consumes: Task 1 types from `@moto-ai/contracts/course-studio`.
- Produces: unchanged Course Studio props, fetch bodies, draft serialization, and player adaptation.

- [x] **Step 1: Change only type-only UI imports**

```ts
import type {
  CourseGraph,
  CourseLessonType,
  ChapterInput,
  LessonInput,
} from '@moto-ai/contracts/course-studio';
```

Replace imports that only describe the Course Studio graph or authoring input. Leave genuine database operations (`prisma`, repository functions, trash types) imported from `@moto-ai/database`.

- [x] **Step 2: Preserve serializer and player semantics**

Keep `createLessonDraft`, `serializeLessonDraft`, `toPlayerCourseContent`, and `toPlayerCourseSummary` signatures and behavior unchanged except for their type module. In particular, retain the current `unknown`-payload object narrowing and merge-preservation logic.

- [x] **Step 3: Scan for unintended client dependencies**

Run: `rg -n "from '@moto-ai/database'" apps/web/src/course-studio apps/web/src/lib/course-player-adapter.ts apps/web/src/lib/contracts/lesson-studio.ts`

Expected: remaining imports in this scope are runtime database functions only; no Course Studio graph or lesson mutation type is imported from the database package.

### Task 4: Use the shared lesson catalog in the HTTP boundary

**Files:**
- Modify: `apps/web/src/app/api/course-studio/courses/[courseId]/lessons/route.ts`

**Interfaces:**
- Consumes: `COURSE_LESSON_TYPES` and `LessonInput` from the shared contract; existing database mutation functions and `CourseTrashItem` from the database package.
- Produces: unchanged POST, PATCH, and DELETE route responses.

- [x] **Step 1: Separate contract values from persistence functions**

```ts
import { COURSE_LESSON_TYPES, type LessonInput } from '@moto-ai/contracts/course-studio';
import {
  createLesson, duplicateLesson, getAuthoringCourse,
  trashLesson, updateLesson, type CourseTrashItem,
} from '@moto-ai/database';
```

Keep `z.enum(COURSE_LESSON_TYPES)`, all schemas, authorization checks, error mapping, and `NextResponse` statuses exactly as they are.

- [x] **Step 2: Verify the full static boundary**

Run: `npm run typecheck && npm run lint && git diff --check && npm ls --workspaces --depth=0`

Expected: all commands exit successfully; no formatting errors, type leakage, or unmet workspace dependency exists.

### Task 5: Review the scoped result

**Files:**
- Verify: all files listed above

- [x] **Step 1: Inspect the final diff for behavior drift**

Run: `git diff -- packages/contracts/package.json packages/contracts/src/course-studio.ts packages/database/src/course-repository.ts packages/database/src/index.ts apps/web/src/course-studio apps/web/src/lib/contracts/lesson-studio.ts apps/web/src/lib/course-player-adapter.ts 'apps/web/src/app/api/course-studio/courses/[courseId]/lessons/route.ts'`

Expected: the diff only creates/re-exports graph contracts and updates imports; it does not alter persistence queries, UI markup, route validation rules, or player/progress logic.

- [x] **Step 2: Record any runtime limitation accurately**

Do not claim build or browser verification unless actually observed. `npm run build` runs Prisma migration first, so if PostgreSQL at `localhost:5432` is unavailable, report that as an environment limitation rather than changing code.
