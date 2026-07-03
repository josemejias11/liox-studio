# Project Cleanup Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor all major cleanup candidates surfaced in the architecture review while preserving behavior through focused tests and verification gates.

**Architecture:** This is a phased refactor program, not one mega-edit. Stabilize the course/player model first, then deepen lesson/progress seams, then split larger independent modules. Each task must leave the app type-safe and testable before the next task starts.

**Tech Stack:** Next.js 16, React 19, TypeScript, Sanity, Prisma, Vitest, FastAPI, Pytest.

## Global Constraints

- Do not rewrite unrelated UI or business behavior while refactoring.
- Preserve existing route URLs, Sanity field names, Prisma schema semantics, and user-facing copy unless a task explicitly says otherwise.
- Prefer focused modules with small interfaces and high locality.
- Run `npm run typecheck` after every TypeScript task.
- Run `npm run test` after every player/course/progress/quiz task.
- Run `cd parser-service && pytest tests/ -v` after parser-service tasks.
- Do not start parser-service refactoring until player/course refactors are green.

---

## File Structure

- Create: `src/lib/course-flow.ts` for normalized course flow items, index lookup, nav-map derivation, and phase conversion helpers.
- Modify: `src/lib/course-structure.ts` to become a lower-level structure builder or be absorbed by `course-flow.ts` where safe.
- Modify: `src/player/hooks/useCourseNavigation.ts` to consume the course-flow interface rather than flat offsets.
- Modify: `src/player/NavMap.tsx` to render rows from course-flow nav items rather than rebuilding offsets.
- Create: `src/player/hooks/useCourseSession.ts` for consent/session identity.
- Create: `src/player/hooks/useWeakTopics.ts` for weak-topic derivation and analytics merge.
- Create: `src/player/CoursePhaseScreen.tsx` for phase rendering currently embedded in `MotoViewer.tsx`.
- Modify: `src/player/MotoViewer.tsx` to become a thin player shell.
- Modify: `src/player/lesson-types/registry.ts` to become the lesson-type seam for lazy render adapters and completion metadata.
- Modify: `src/player/LessonRenderer.tsx` to consume the lesson registry interface.
- Create: `src/lib/progress-store.ts` for progress persistence semantics.
- Modify: `src/app/api/progress/route.ts` to become a route adapter over `progress-store`.
- Create: `src/lib/quiz-session.ts` for shared quiz flow state.
- Modify: `src/components/course-ai/CourseQuiz.tsx` and `src/components/SanityQuizPlayer.tsx` to use `quiz-session` where practical.
- Create: `src/lib/course-content.ts` for Sanity query validation, chapter enrichment, and normalized runtime content.
- Create: `src/lib/chat-client.ts` and `src/components/course-ai/useChatConversation.ts` for shared chat transport and message lifecycle.
- Split: `parser-service/main.py` into focused modules only after the web app refactor phases are green.

---

### Task 1: Course Flow Module

**Files:**
- Create: `src/lib/course-flow.ts`
- Modify: `src/lib/course-structure.ts`
- Modify: `src/player/hooks/useCourseNavigation.ts`
- Modify: `src/player/hooks/useCourseNavigation.test.ts`
- Modify: `src/player/NavMap.tsx`

**Interfaces:**
- Consumes: existing `CourseSection[]`, `SanityCourse['chapters']`, and `deriveCourseStructure()` output.
- Produces: `deriveCourseFlow(sections, chapters): CourseFlow`, `getFlowItemByIndex(flow, index)`, `getNavItems(flow)`, and `getInitialPhase(flow)`.

- [ ] **Step 1: Add failing flow tests**

Add tests in `src/player/hooks/useCourseNavigation.test.ts` proving quiz and disclaimer targets are addressable via flow items, not synthetic offsets.

```ts
import { describe, expect, it } from 'vitest';
import { deriveCourseFlow, getNavItems } from '@/lib/course-flow';

it('includes quiz and disclaimer as addressable course flow items', () => {
  const flow = deriveCourseFlow(
    [
      { _key: 'lesson-1', _type: 'lesson', lessonType: 'content', headline: 'Intro' },
      { _key: 'spec-1', _type: 'specification', title: 'Spec' },
      { _key: 'disclaimer-1', _type: 'disclaimer', title: 'Safety' },
    ] as any,
    [],
  );

  expect(flow.items.map((item) => item.kind)).toEqual(['lesson', 'specification', 'quiz', 'disclaimer']);
  expect(getNavItems(flow).map((item) => item.kind)).toEqual([
    'lesson',
    'specification',
    'quiz',
    'disclaimer',
  ]);
});
```

- [ ] **Step 2: Run the failing test**

Run: `npm run test -- src/player/hooks/useCourseNavigation.test.ts`

Expected: FAIL because `src/lib/course-flow.ts` does not exist.

- [ ] **Step 3: Implement `course-flow.ts` minimally**

Create `src/lib/course-flow.ts` with a small interface that wraps the existing structure result and introduces ordered items.

```ts
import type { CourseSection, SanityCourse } from '@/lib/contracts/sanity';
import { deriveCourseStructure } from '@/lib/course-structure';

export type CourseFlowItem =
  | { kind: 'lesson'; key: string; index: number; title: string }
  | { kind: 'specification'; key: string; index: number; title: string }
  | { kind: 'quiz'; key: 'quiz'; index: number; title: string }
  | { kind: 'disclaimer'; key: string; index: number; title: string };

export interface CourseFlow {
  structure: ReturnType<typeof deriveCourseStructure>;
  items: CourseFlowItem[];
}

export function deriveCourseFlow(
  sections: CourseSection[],
  chapters: SanityCourse['chapters'] = [],
): CourseFlow {
  const structure = deriveCourseStructure(sections, chapters);
  const items: CourseFlowItem[] = [];

  for (const section of structure.lessonSections) {
    items.push({ kind: 'lesson', key: section._key, index: items.length, title: section.headline });
  }

  for (const section of structure.specSections) {
    items.push({ kind: 'specification', key: section._key, index: items.length, title: section.title });
  }

  items.push({ kind: 'quiz', key: 'quiz', index: items.length, title: 'Knowledge Check' });

  if (structure.disclaimerSection) {
    items.push({
      kind: 'disclaimer',
      key: structure.disclaimerSection._key,
      index: items.length,
      title: structure.disclaimerSection.title,
    });
  }

  return { structure, items };
}

export function getNavItems(flow: CourseFlow): CourseFlowItem[] {
  return flow.items;
}
```

- [ ] **Step 4: Run the test and typecheck**

Run: `npm run test -- src/player/hooks/useCourseNavigation.test.ts`
Expected: PASS for the new flow test.

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Migrate navigation and NavMap incrementally**

Change `MotoViewer`, `useCourseNavigation`, and `NavMap` to consume `CourseFlow` while preserving the current screen order. Keep compatibility shims local to this task only; remove offset calculations when tests pass.

- [ ] **Step 6: Full verification**

Run: `npm run test`
Expected: PASS.

Run: `npm run typecheck`
Expected: PASS.

---

### Task 2: Lesson Registry Seam

**Files:**
- Modify: `src/player/lesson-types/registry.ts`
- Modify: `src/player/LessonRenderer.tsx`
- Modify: `src/player/MotoViewer.tsx`
- Modify: `src/player/hooks/useCourseNavigation.ts`
- Create or modify tests around lesson completion behavior.

**Interfaces:**
- Consumes: `LessonSection`, current visited/completion state, and lesson runtime callbacks.
- Produces: a registry interface with `render`, `completionMode`, and `requiresManualCompletion` per lesson type.

- [ ] **Step 1: Add registry coverage tests**

Create a test that fails until the registry exposes completion metadata for every supported lesson type used by the app.

```ts
import { describe, expect, it } from 'vitest';
import { lessonTypeRegistry } from '@/player/lesson-types/registry';

it('defines completion behavior for every rendered lesson type', () => {
  expect(Object.keys(lessonTypeRegistry).sort()).toEqual([
    'colorSwitcher',
    'content',
    'dragDrop',
    'scrollStory',
    'splitScreen',
    'stage',
    'video',
  ]);

  expect(lessonTypeRegistry.dragDrop.completionMode).toBe('manual');
  expect(lessonTypeRegistry.video.completionMode).toBe('manual');
  expect(lessonTypeRegistry.scrollStory.completionMode).toBe('manual');
  expect(lessonTypeRegistry.content.completionMode).toBe('hotspots');
});
```

- [ ] **Step 2: Run the failing test**

Run: `npm run test -- src/player/lesson-types/registry.test.ts`
Expected: FAIL because `lessonTypeRegistry` is not exported.

- [ ] **Step 3: Promote `registry.ts` from lazy imports to lesson metadata seam**

Export a `lessonTypeRegistry` object beside the existing dynamic exports. Use this metadata to replace scattered arrays such as `['dragDrop', 'video']` and `['dragDrop', 'video', 'scrollStory']`.

```ts
export type LessonCompletionMode = 'hotspots' | 'manual' | 'viewed';

export const lessonTypeRegistry = {
  content: { completionMode: 'hotspots' },
  stage: { completionMode: 'hotspots' },
  video: { completionMode: 'manual' },
  colorSwitcher: { completionMode: 'viewed' },
  splitScreen: { completionMode: 'viewed' },
  dragDrop: { completionMode: 'manual' },
  scrollStory: { completionMode: 'manual' },
} as const satisfies Record<string, { completionMode: LessonCompletionMode }>;

export function getLessonCompletionMode(lessonType?: string): LessonCompletionMode {
  return lessonType && lessonType in lessonTypeRegistry
    ? lessonTypeRegistry[lessonType as keyof typeof lessonTypeRegistry].completionMode
    : 'hotspots';
}
```

- [ ] **Step 4: Replace special-case arrays**

Use `getLessonCompletionMode(currentLesson?.lessonType) === 'manual'` in `MotoViewer.tsx` and `useCourseNavigation.ts` instead of inline arrays.

- [ ] **Step 5: Verify**

Run: `npm run test`
Expected: PASS.

Run: `npm run typecheck`
Expected: PASS.

---

### Task 3: MotoViewer Decomposition

**Files:**
- Create: `src/player/hooks/useCourseSession.ts`
- Create: `src/player/hooks/useWeakTopics.ts`
- Create: `src/player/CoursePhaseScreen.tsx`
- Modify: `src/player/MotoViewer.tsx`

**Interfaces:**
- Produces: `useCourseSession(): { sessionId: string; persistSession: boolean }`.
- Produces: `useWeakTopics(args): string[]`.
- Produces: `CoursePhaseScreen` that renders a phase from explicit props.

- [ ] **Step 1: Extract `useCourseSession` with existing behavior**

Move the consent/session effect from `MotoViewer.tsx` into `useCourseSession.ts` without changing logic.

- [ ] **Step 2: Verify session extraction**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Extract weak-topic derivation**

Move `sessionWeakTopics`, `apiWeakTopics`, and the weak-topic fetch effect into `useWeakTopics.ts`. Keep the same inputs: course id, structure, visited map, and `isQuizPhase`.

- [ ] **Step 4: Verify weak-topic extraction**

Run: `npm run test`
Expected: PASS.

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Extract phase rendering**

Move `renderPhase()` into `CoursePhaseScreen.tsx` only after session and weak topics are extracted. Keep props explicit; do not introduce context.

- [ ] **Step 6: Verify player decomposition**

Run: `npm run test`
Expected: PASS.

Run: `npm run typecheck`
Expected: PASS.

---

### Task 4: Progress Store Module

**Files:**
- Create: `src/lib/progress-store.ts`
- Modify: `src/app/api/progress/route.ts`
- Modify or create: `src/lib/progress-store.test.ts`

**Interfaces:**
- Produces: `loadSessionProgress(sessionId: string)`.
- Produces: `recordLessonView(input)`.
- Produces: `recordHotspots(input)`.

- [ ] **Step 1: Add tests for view versus hotspot persistence**

Create tests proving hotspot saves do not increment lesson view count unless the input explicitly records a view.

- [ ] **Step 2: Extract route transaction logic**

Move Prisma calls from `src/app/api/progress/route.ts` into `src/lib/progress-store.ts`. Keep the route responsible only for request parsing and response formatting.

- [ ] **Step 3: Verify progress behavior**

Run: `npm run test -- src/lib/progress-store.test.ts`
Expected: PASS.

Run: `npm run test`
Expected: PASS.

Run: `npm run typecheck`
Expected: PASS.

---

### Task 5: Quiz Session Module

**Files:**
- Create: `src/lib/quiz-session.ts`
- Modify: `src/components/course-ai/CourseQuiz.tsx`
- Modify: `src/components/SanityQuizPlayer.tsx`
- Modify or create: `src/lib/quiz-session.test.ts`

**Interfaces:**
- Produces: a pure quiz session reducer for answer selection, result reveal, submit state, and summary.

- [ ] **Step 1: Add reducer tests**

Test answer selection, correct/incorrect reveal, completion summary, and retry/error state as pure state transitions.

- [ ] **Step 2: Extract shared flow**

Move duplicated quiz state transitions from both quiz modules into `quiz-session.ts`. Leave UI rendering in each module.

- [ ] **Step 3: Verify quiz behavior**

Run: `npm run test -- src/lib/quiz-session.test.ts src/lib/quiz-grading.test.ts`
Expected: PASS.

Run: `npm run typecheck`
Expected: PASS.

---

### Task 6: Course Content Module

**Files:**
- Create: `src/lib/course-content.ts`
- Modify: `src/app/course/[slug]/page.tsx`
- Modify: `src/sanity/lib/queries.ts`
- Modify or create tests around Sanity course parsing.

**Interfaces:**
- Produces: `normalizeCourseContent(raw): NormalizedCourseContent`.

- [ ] **Step 1: Add fixture test for normalization**

Use a small raw course fixture with lessons, chapter metadata, specs, and disclaimer. Assert the normalized result has enriched lesson chapter metadata and validated sections.

- [ ] **Step 2: Move page-level enrichment into `course-content.ts`**

Keep `page.tsx` responsible for fetching and rendering only.

- [ ] **Step 3: Verify content normalization**

Run: `npm run test`
Expected: PASS.

Run: `npm run typecheck`
Expected: PASS.

---

### Task 7: Chat Client and Conversation Hook

**Files:**
- Create: `src/lib/chat-client.ts`
- Create: `src/components/course-ai/useChatConversation.ts`
- Modify: `src/components/course-ai/CourseChat.tsx`
- Modify: `src/components/DiscoveryPanel.tsx`

**Interfaces:**
- Produces: `askCourseChat(input, signal?)` for transport and response validation.
- Produces: `useChatConversation()` for message lifecycle.

- [ ] **Step 1: Extract transport first**

Create `chat-client.ts` and replace direct `/api/chat` fetch calls in one UI module.

- [ ] **Step 2: Verify transport extraction**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Extract conversation lifecycle**

Move duplicated message/error/loading state into `useChatConversation.ts` only after transport extraction is green.

- [ ] **Step 4: Verify chat extraction**

Run: `npm run test`
Expected: PASS.

Run: `npm run typecheck`
Expected: PASS.

---

### Task 8: Parser-Service RAG Split

**Files:**
- Create: `parser-service/settings.py`
- Create: `parser-service/runtime.py`
- Create: `parser-service/vectorstore.py`
- Create: `parser-service/documents.py`
- Create: `parser-service/rag_chat.py`
- Create: `parser-service/quiz_generation.py`
- Modify: `parser-service/main.py`
- Modify: `parser-service/tests/test_main.py`

**Interfaces:**
- Produces: a small `RagEngine` interface used by route adapters and unit tests.

- [ ] **Step 1: Extract settings without behavior changes**

Move constants and environment parsing from `main.py` to `settings.py`.

- [ ] **Step 2: Verify settings extraction**

Run: `cd parser-service && pytest tests/ -v`
Expected: PASS.

- [ ] **Step 3: Extract runtime and vectorstore cache**

Move runtime/client creation and vectorstore cache behavior into focused modules.

- [ ] **Step 4: Verify runtime extraction**

Run: `cd parser-service && pytest tests/ -v`
Expected: PASS.

- [ ] **Step 5: Extract document parsing, RAG chat, and quiz generation**

Move route implementation logic behind `documents.py`, `rag_chat.py`, and `quiz_generation.py`. Keep FastAPI route handlers in `main.py` as HTTP adapters.

- [ ] **Step 6: Verify parser split**

Run: `cd parser-service && pytest tests/ -v`
Expected: PASS.

---

## Execution Order

1. Task 1: Course Flow Module
2. Task 2: Lesson Registry Seam
3. Task 3: MotoViewer Decomposition
4. Task 4: Progress Store Module
5. Task 5: Quiz Session Module
6. Task 6: Course Content Module
7. Task 7: Chat Client and Conversation Hook
8. Task 8: Parser-Service RAG Split

## Self-Review

- Spec coverage: all eight architecture-review candidates are represented as tasks.
- Placeholder scan: no task is intentionally left as future work; each task has concrete files, interfaces, and verification commands.
- Type consistency: TypeScript phases use `npm run typecheck`; parser-service phase uses Pytest. The plan does not require changing public route URLs or data contracts.
