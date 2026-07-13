# Canvas Product Inspection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the course-level `interactive` permission model with `standard` / `canvas` and ship a Canvas product-inspection lesson.

**Architecture:** Canvas is a new lesson type within the existing player. It reuses Sanity images, hotspot targets, the discovery panel, and lesson progress. Course mode describes the experience and does not gate legacy lesson types.

**Tech Stack:** Next.js 16, React 19, TypeScript, Sanity Studio 5, Zod, Vitest, Tailwind CSS.

## Global Constraints

- `standard` and `canvas` are the only course-mode values.
- Canvas v1 has one primary product image, pan/zoom, feature targets, required-target progress, and educational panels.
- Preserve existing renderers, route, player, and consent-aware progress persistence.
- No new player, route, database table, or dependency.

---

### Task 1: Migrate contracts and remove advanced-type gating

**Files:**
- Create: `src/lib/canvas.ts`, `src/lib/canvas.test.ts`
- Modify: `src/lib/course-modes.ts`, `src/lib/contracts/sanity.ts`, `src/lib/course-content.ts`, `src/lib/course-content.test.ts`, `src/lib/contracts/sanity.test.ts`, `src/sanity/lib/queries.ts`

**Interfaces:**
- `type CourseMode = 'standard' | 'canvas'`
- `const CANVAS_LESSON_TYPE = 'canvas'`
- `getRequiredCanvasTargetCount(lesson)` and `isCanvasComplete(lesson, visited)`

- [ ] Write failing tests:

```ts
expect(courseSchema.parse({_id: 'c1'}).courseMode).toBe('standard')
expect(courseSchema.parse({_id: 'c1', courseMode: 'canvas'}).courseMode).toBe('canvas')
expect(normalizeCourseContent(standardCourseWithDragDrop)).not.toBeNull()
expect(getRequiredCanvasTargetCount(canvasLesson)).toBe(2)
```

- [ ] Run `npm test -- --run src/lib/canvas.test.ts src/lib/contracts/sanity.test.ts src/lib/course-content.test.ts`; verify RED.
- [ ] Add `canvas` to the lesson enum, add optional boolean `hotspots[].required`, accept only `standard` / `canvas` course modes with Standard fallback, and project both fields in GROQ.
- [ ] Remove the Standard-versus-advanced rejection from `normalizeCourseContent`; keep structural contract validation.
- [ ] Implement:

```ts
export function isCanvasComplete(lesson: Pick<SanityLesson, 'lessonType' | 'hotspots'>, visited: Set<string>) {
  const required = (lesson.hotspots ?? []).filter((target) => target.required).map((target) => target.label)
  return required.length > 0 && required.every((label) => visited.has(label))
}
```

- [ ] Re-run the focused tests; verify GREEN.
- [ ] Commit: `feat: add canvas course and lesson contracts`.

### Task 2: Add Canvas authoring controls

**Files:**
- Modify: `src/sanity/schemaTypes/course.ts`, `src/sanity/schemaTypes/lesson.ts`, `src/sanity/components/HotspotMapInput.tsx`
- Create: `src/sanity/schemaTypes/lesson.test.ts`

**Interfaces:** Canvas course option, Canvas Product Inspection lesson option, and a hotspot `required` checkbox.

- [ ] Write failing schema test asserting the lesson type list contains `{ title: 'Canvas Product Inspection', value: 'canvas' }`.
- [ ] Run `npm test -- --run src/sanity/schemaTypes/lesson.test.ts`; verify RED.
- [ ] Replace the `Interactive` course-mode option with `Canvas`. Add `Canvas Product Inspection` to lesson types. Show primary image and `HotspotMapInput` for Canvas. Add `Required for completion` to the hotspot object. Update map helper copy for Canvas targets.
- [ ] Re-run the schema test; verify GREEN.
- [ ] Commit: `feat: add canvas lesson authoring`.

### Task 3: Build the Canvas inspection renderer

**Files:**
- Create: `src/player/lesson-types/CanvasInspectionLesson.tsx`, `src/player/lesson-types/CanvasInspectionLesson.test.tsx`
- Modify: `src/player/lesson-types/registry.ts`, `src/player/lesson-types/registry.test.ts`, `src/player/LessonRenderer.tsx`

**Interfaces:**

```ts
type CanvasInspectionLessonProps = {
  lesson: LessonSection
  visitedLabels: Set<string>
  onVisit: (label: string) => void
  courseId?: string
}
```

- [ ] Write failing tests that opening a target calls `onVisit(label)` and reveals educational content; test Zoom In changes `data-testid="canvas-image"` from scale `1` to `1.25`.
- [ ] Run `npm test -- --run src/player/lesson-types/CanvasInspectionLesson.test.tsx`; verify RED.
- [ ] Render one primary image in an overflow-hidden viewport. Provide accessible zoom-in, zoom-out, and reset controls. Clamp scale from 1 to 3 and support pointer drag only while zoomed. Use the existing `Hotspot` and `DiscoveryPanel`; target open records a visit.
- [ ] Register dynamic Canvas renderer with hotspot completion and dispatch it from `LessonRenderer`.
- [ ] Re-run Canvas and registry tests; verify GREEN.
- [ ] Commit: `feat: render canvas product inspection lessons`.

### Task 4: Apply required-target completion to navigation

**Files:**
- Modify: `src/player/MotoViewer.tsx`, `README.md`
- Test: `src/lib/canvas.test.ts`

- [ ] Write failing tests:

```ts
expect(isCanvasComplete(canvasLesson, new Set(['Optional']))).toBe(false)
expect(isCanvasComplete(canvasLesson, new Set(['Camera', 'Display']))).toBe(true)
```

- [ ] Run `npm test -- --run src/lib/canvas.test.ts`; verify RED.
- [ ] In `MotoViewer`, use the number of required Canvas targets when calling `baseMarkVisited`. Keep existing hotspot counting for other lessons. Show `Explore all required features (visited / required)` when a Canvas lesson is locked.
- [ ] Update README from `interactive` to `canvas` and explain Canvas authoring; remove the legacy advanced-type cleanup requirement.
- [ ] Re-run focused tests; verify GREEN.
- [ ] Commit: `feat: track canvas target completion`.

### Task 5: Regression verification

- [ ] Run `npm test`; expect all tests to pass.
- [ ] Run targeted ESLint on every changed Canvas, contract, schema, renderer, and player file; expect no changed-file errors.
- [ ] Run `npm run typecheck`; record existing unrelated errors separately if present.
- [ ] Run `git diff --check && git status --short`; expect no whitespace errors and no unintended files.
