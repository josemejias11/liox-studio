# Course Studio Bottom Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the Course Studio inspector and revision tools below the learner canvas while keeping them visible by default.

**Architecture:** Keep `CourseOutline`, `StudioInspector`, and `RevisionPanel` unchanged in responsibility. Change the workspace shell to a wide-screen two-column/two-row grid where the outline spans both rows, the canvas occupies the upper center, and a bounded bottom dock contains the inspector and revisions. Smaller screens keep a single vertical flow.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS.

## Global Constraints

- Do not change Studio selection, save, revision, trash, preview, or auth behavior.
- Do not create a collapsed-by-default tools control; the dock is visible by default as explicitly chosen.
- Keep the existing `CourseOutline`, `StudioInspector`, and `RevisionPanel` components; change only their layout container and responsive sizing.
- Do not create automated test files; verify with typecheck, lint, build, diff checks, and Chrome DevTools/Playwright browser evidence.

---

### Task 1: Make the course outline span the editor height

**Files:**
- Modify: `apps/web/src/course-studio/CourseOutline.tsx:15-63`

**Interfaces:**
- Consumes: Existing CourseOutline props and selection/action callbacks.
- Produces: An optional `className` prop for the root `aside`, allowing the workspace shell to apply `h-full` without changing outline behavior.

- [x] **Step 1: Add the optional layout class prop**

Add `className?: string` to `Props`, accept it in the component, and append it to the existing root classes:

```tsx
interface Props {
  className?: string;
  // existing props remain unchanged
}

export function CourseOutline({ className, ...props }: Props) {
  // existing destructuring and behavior remain unchanged
  return <aside className={`flex max-h-[32rem] min-h-0 flex-col border-b border-border bg-card xl:max-h-none xl:border-r xl:border-b-0 ${className ?? ''}`}>
```

Do not alter any child controls, callbacks, selection logic, or content.

- [x] **Step 2: Run the focused static check**

Run: `npm run typecheck`

Expected: exit 0 across all workspaces.

### Task 2: Recompose the Studio workspace grid

**Files:**
- Modify: `apps/web/src/course-studio/CourseStudioWorkspace.tsx:235-285`

**Interfaces:**
- Consumes: The unchanged outline, preview, inspector, revision, and save callbacks from the workspace component.
- Produces: Wide-screen layout classes with outline left, canvas center-top, and visible tools dock center-bottom.

- [x] **Step 1: Replace the desktop three-column shell**

Change the non-focus editor shell to a two-column/two-row grid:

```tsx
<div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[20rem_minmax(0,1fr)] xl:grid-rows-[minmax(0,1fr)_minmax(15rem,32vh)] xl:overflow-hidden">
```

Wrap `CourseOutline` in a `min-h-0 xl:row-span-2` container and pass `className="h-full"` so it spans the editor’s two desktop rows. Keep its props unchanged.

- [x] **Step 2: Place the learner canvas in the upper center cell**

Keep the canvas section content unchanged, adding explicit desktop placement and bounded scrolling:

```tsx
<section className="min-h-0 min-w-0 overflow-auto bg-muted/40 p-4 sm:p-6 xl:col-start-2 xl:row-start-1">
```

Do not change preview conversion, selected lesson state, or invalid-content messaging.

- [x] **Step 3: Move the inspector and revisions into the bottom dock**

Keep the existing `StudioInspector` and `RevisionPanel` props and callbacks, but place their container in the second center cell:

```tsx
<div className="flex min-h-0 flex-col border-t border-border xl:col-start-2 xl:row-start-2">
  <div className="min-h-0 flex-1 overflow-y-auto">
    <StudioInspector ... />
  </div>
  <RevisionPanel ... />
</div>
```

The dock must remain visible by default. Its inspector content scrolls internally when the bounded desktop row is shorter than the form. Preserve the existing revision panel’s own feedback/revision scrolling.

- [x] **Step 4: Run static checks**

Run: `npm run lint && git diff --check`

Expected: exit 0 with no lint or whitespace errors.

### Task 3: Verify desktop and responsive behavior

**Files:**
- Verify: `apps/web/src/course-studio/CourseOutline.tsx`
- Verify: `apps/web/src/course-studio/CourseStudioWorkspace.tsx`

- [x] **Step 1: Run the production build**

Run: `npm run build`

Expected: Prisma reports no pending migrations and Next.js compiles the Studio route successfully.

- [x] **Step 2: Inspect the authenticated Studio workspace at desktop width**

Use Chrome DevTools or Playwright MCP at a wide viewport. Open an existing course and confirm the outline remains on the left, the learner canvas spans the center width, and the inspector plus client-review tools are visible below the canvas.

- [x] **Step 3: Inspect the responsive flow**

Resize to a narrow viewport and confirm the order is outline, canvas, then visible tools. Confirm focus preview still displays only the full learner canvas.

- [x] **Step 4: Review final state**

Run: `git status --short --branch && git diff --check`

Expected: only the intended layout source, plan, and any pre-existing user-owned changes are present; no test files or generated artifacts are added.
