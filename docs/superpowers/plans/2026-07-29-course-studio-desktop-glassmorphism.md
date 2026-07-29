# Course Studio desktop glassmorphism Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply a scoped desktop-first glassmorphism visual system to Course Studio while preserving the learner product preview and all existing authoring behavior.

**Architecture:** Add narrowly scoped Studio utility classes to the existing global stylesheet, then apply those classes only at Course Studio shell and panel boundaries. Keep `AuthoringPreview` and all nested learner components outside the glass styling boundary so the product output retains its existing visual language. Preserve the current viewport-locked editor grid, persistent panel dimensions, review selection, save form association, and navigation safeguards.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, existing CSS custom properties, existing Course Studio components, Chrome DevTools browser verification.

## Global Constraints

- Course Studio is a desktop-first authoring tool; the existing stacked fallback remains functional but is not the primary design target.
- Apply glass styling only to Course Studio authoring surfaces: `/studio`, `/studio/[courseId]`, and the Studio login shell where applicable.
- Keep `/course/[slug]`, learner lesson components, and the content inside `AuthoringPreview` visually unchanged.
- Keep Course Studio and application typography on Geist and learner product/preview content on MotoSans.
- Preserve existing icons, accessible labels, review flow, save behavior, persistent resizers, dirty-navigation guards, and API/data contracts.
- Do not create or run automated test files; use typecheck, lint, build, diff checks, and browser evidence.
- Do not add dependencies, database fields, server settings, or user preference persistence for the visual treatment.

---

### Task 1: Add scoped Studio glass utilities

**Files:**
- Modify: `apps/web/src/app/globals.css:176-200`

**Interfaces:**
- Consumes: existing Motorola color variables, Geist application tokens, and the current `bg-glass-gradient`/`glass-panel` utility area.
- Produces: scoped `studio-workspace`, `studio-glass`, `studio-glass-panel`, `studio-glass-control`, and `studio-glass-selected` classes plus a reduced-transparency fallback.

- [ ] **Step 1: Add the desktop workspace background utility**

Add a `studio-workspace` utility with a soft cool background and restrained radial light fields. Keep the base background opaque enough that the layout remains readable when transparency is disabled.

- [ ] **Step 2: Add shell, panel, control, and selected-state utilities**

Define utilities with these concrete properties:

```css
.studio-glass {
  background: color-mix(in srgb, var(--card) 72%, transparent);
  border: 1px solid color-mix(in srgb, var(--foreground) 10%, transparent);
  box-shadow: 0 18px 50px rgb(44 62 94 / 10%);
  backdrop-filter: blur(22px) saturate(135%);
}

.studio-glass-panel {
  background: color-mix(in srgb, var(--card) 82%, transparent);
  border-color: color-mix(in srgb, var(--foreground) 13%, transparent);
  box-shadow: 0 10px 30px rgb(44 62 94 / 8%);
  backdrop-filter: blur(18px) saturate(125%);
}

.studio-glass-control {
  background: color-mix(in srgb, var(--background) 78%, transparent);
  border-color: color-mix(in srgb, var(--foreground) 14%, transparent);
}

.studio-glass-selected {
  background: color-mix(in srgb, var(--accent) 14%, var(--card));
  border-color: color-mix(in srgb, var(--accent) 55%, transparent);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 24%, transparent), 0 12px 30px rgb(104 91 199 / 12%);
}
```

Use the repository’s existing utility layer and keep these classes namespaced with `studio-` so they cannot affect learner product components.

- [ ] **Step 3: Add reduced-transparency fallback**

Under `@media (prefers-reduced-transparency: reduce)`, remove backdrop filters and make the Studio surfaces use opaque `var(--card)`/`var(--background)` backgrounds while retaining borders, focus rings, selected states, and semantic colors.

- [ ] **Step 4: Run the stylesheet checks and commit**

Run:

```bash
git diff --check
rg -n "studio-workspace|studio-glass|prefers-reduced-transparency" apps/web/src/app/globals.css
```

Commit:

```bash
git add apps/web/src/app/globals.css
git commit -m "style: add scoped Studio glass surfaces"
```

### Task 2: Apply the visual system to the Course Studio library

**Files:**
- Modify: `apps/web/src/app/studio/page.tsx:14-38`
- Modify: `apps/web/src/course-studio/CourseLibrary.tsx:35-133`

**Interfaces:**
- Consumes: Task 1’s scoped utilities and the existing library card/review behavior.
- Produces: a desktop dashboard-like Studio library with glass shell, course cards, creation form, selection state, and review panel; no changes to card actions or review data flow.

- [ ] **Step 1: Style the Studio library page shell**

Apply `studio-workspace` to the page root. Use `studio-glass` for the page header and course-creation section, while preserving the existing title, description, icon, server action, input, and button behavior. Keep the content width broad enough for desktop authoring instead of a narrow mobile card column.

- [ ] **Step 2: Style course cards and selected state**

Keep the existing thumbnail, title, description, `Open editor`, `Prepare for review`, and purposeful icon content. Add `studio-glass-panel` to each card, use `studio-glass-selected` for the selected card, and make the thumbnail/content boundary visually distinct without changing image sizing or priority.

- [ ] **Step 3: Style the inline review panel**

Apply `studio-glass-panel` to the selected-course review section and `studio-glass-control` to its clear-selection/action surfaces. Preserve `RevisionPanel` behavior, course reconciliation, accessible labels, and current review controls.

- [ ] **Step 4: Verify the library visually and commit**

Run typecheck, lint, and `git diff --check`. In the browser at 1440×810, verify the page reads as a wide authoring dashboard, the glass surfaces are layered, the selected card remains obvious, and the live review panel is readable.

Commit:

```bash
git add apps/web/src/app/studio/page.tsx apps/web/src/course-studio/CourseLibrary.tsx
git commit -m "style: apply glass treatment to Studio library"
```

### Task 3: Apply the visual system to the desktop editor shell

**Files:**
- Modify: `apps/web/src/course-studio/CourseStudioWorkspace.tsx:360-485`
- Modify: `apps/web/src/course-studio/StudioToolbar.tsx:24-65`
- Modify: `apps/web/src/course-studio/CourseOutline.tsx:63-151`
- Modify: `apps/web/src/course-studio/StudioInspector.tsx:86-120`
- Modify: `apps/web/src/course-studio/RevisionPanel.tsx:180-220`

**Interfaces:**
- Consumes: Task 1 utilities and the current editor grid/resizer/navigation/review contracts.
- Produces: glass editor chrome around the existing outline, canvas frame, bottom tools, inspector, toolbar, and review controls without changing `AuthoringPreview` descendants.

- [ ] **Step 1: Style the viewport-locked editor shell**

Apply `studio-workspace` to the editor’s desktop-capable root while preserving `xl:h-screen`, internal overflow, CSS grid variables, and the existing mobile fallback. Add the glass shell/panel classes only around authoring regions.

- [ ] **Step 2: Style toolbar and panel boundaries**

Use `studio-glass` for the toolbar and `studio-glass-panel` for the outline, inspector, bottom tools region, and review panel. Keep the left and bottom separators visible, keyboard-accessible, and independent from blur overflow.

- [ ] **Step 3: Style the learner-canvas frame without styling its product content**

Use a glass boundary around the center canvas area and preserve the existing `AuthoringPreview` component structure. Do not add a glass class to the wrapper that contains `MotoViewer`; the learner product remains visually unchanged inside its frame.

- [ ] **Step 4: Style selected and control states**

Apply `studio-glass-selected` to the active outline/course selection and selected-screen indicators where the existing classes already express selection. Apply `studio-glass-control` to save, undo, focus-preview, resize, and review controls where a translucent control background improves hierarchy. Preserve existing icons and text labels.

- [ ] **Step 5: Verify editor geometry and commit**

Run typecheck, lint, and `git diff --check`. In Chrome at 1440×810 and 1280×800, verify:

- no document-level editor scroll is introduced;
- outline and tools remain independently scrollable;
- both separators remain visible and operable;
- the preview content retains its existing product styling and MotoSans;
- toolbar, outline, inspector, and review controls remain readable over glass.

Commit:

```bash
git add apps/web/src/course-studio/CourseStudioWorkspace.tsx apps/web/src/course-studio/StudioToolbar.tsx apps/web/src/course-studio/CourseOutline.tsx apps/web/src/course-studio/StudioInspector.tsx apps/web/src/course-studio/RevisionPanel.tsx
git commit -m "style: apply glass treatment to Studio editor"
```

### Task 4: Tune authoring controls and fallback behavior

**Files:**
- Modify: `apps/web/src/course-studio/inspectors/CourseInspector.tsx:285-335`
- Modify: `apps/web/src/course-studio/inspectors/LessonInspector.tsx:92-130`
- Modify: `apps/web/src/course-studio/inspectors/SpecificationsField.tsx:142-260`
- Modify: `apps/web/src/course-studio/inspectors/StringListField.tsx:85-126`
- Modify: `apps/web/src/course-studio/inspectors/lesson/RepeatableField.tsx:16-32`

**Interfaces:**
- Consumes: Task 1 control and fallback utilities plus current form validation, accessible labels, and save associations.
- Produces: readable dense authoring controls over glass without changing form payloads, validation, or interaction handlers.

- [ ] **Step 1: Apply dense control surfaces to forms**

Add `studio-glass-panel` to top-level inspector forms/aside surfaces and `studio-glass-control` to existing inputs, selects, textareas, fieldsets, action groups, and validation containers only where the current `bg-background`/`bg-card` treatment would visually overpower the glass hierarchy. Do not change labels, IDs, event handlers, or form associations.

- [ ] **Step 2: Preserve semantic state styling**

Keep destructive, warning, busy, disabled, invalid, and selected styles visually distinct. Ensure opacity is not the only disabled-state signal and that focus-visible rings remain visible on all controls.

- [ ] **Step 3: Verify reduced-transparency behavior**

Use browser emulation or computed-style inspection to confirm the Studio surfaces have no required blur dependency when reduced transparency is active. Confirm the learner preview remains unaffected by the fallback.

- [ ] **Step 4: Commit the control tuning**

Run typecheck, lint, and `git diff --check`, then commit:

```bash
git add apps/web/src/course-studio/inspectors/CourseInspector.tsx apps/web/src/course-studio/inspectors/LessonInspector.tsx apps/web/src/course-studio/inspectors/SpecificationsField.tsx apps/web/src/course-studio/inspectors/StringListField.tsx apps/web/src/course-studio/inspectors/lesson/RepeatableField.tsx
git commit -m "style: tune glass Studio controls"
```

### Task 5: Integrated desktop verification and handoff

**Files:**
- Modify: `docs/superpowers/sdd/2026-07-29-course-studio-desktop-glassmorphism/progress.md`

**Interfaces:**
- Consumes: all scoped Studio visual changes from Tasks 1–4.
- Produces: evidence that the tool changed visually while the learner product remained unchanged.

- [ ] **Step 1: Run repository checks**

Run:

```bash
npm run typecheck
npm run lint
npm run build
git diff --check
```

Do not create or run automated test files. If build prerequisites fail, record the exact failure and continue with safe static/browser verification.

- [ ] **Step 2: Verify the desktop library**

At 1440×810, inspect `/studio` and confirm the page has a wide glass authoring dashboard, readable cards, clear action hierarchy, and intact review selection behavior. Check console errors and failed requests.

- [ ] **Step 3: Verify the desktop editor**

At 1440×810 and 1280×800, inspect `/studio/[courseId]` and confirm the toolbar, outline, canvas frame, bottom tools, inspector, separators, and review controls use the glass hierarchy. Verify stored panel dimensions still restore and no document-level scroll is introduced.

- [ ] **Step 4: Verify the product boundary**

Inspect the live learner canvas in the editor and verify its product surface remains unchanged, uses MotoSans, and does not inherit Studio glass classes. Confirm Studio chrome computes to Geist.

- [ ] **Step 5: Record evidence and commit the ledger**

Record observed browser dimensions, console/network results, reduced-transparency behavior, and any blocked authenticated flow in the SDD ledger. Review the final diff for scope and leave the branch clean.
