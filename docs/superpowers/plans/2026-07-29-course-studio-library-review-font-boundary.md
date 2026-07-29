# Course Studio library review and product font boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move review preparation into the Course Studio library, move the course-settings save/status footer into the editor outline, and scope MotoSans to the learner product and product previews while the application uses Geist.

**Architecture:** Keep the authenticated `/studio` server page responsible for loading course cards, then hand those cards to a new client `CourseLibrary` component that owns selection and renders the existing review workflow for the selected course. Keep revision and feedback persistence on the existing API routes. Extend the CourseInspector save-state contract so CourseOutline can render the submit control through the HTML form association, while the inspector remains the owner of form validation and mutation. Make Geist the global application font and override the scoped `--font-sans` token inside the player frame so learner content and embedded previews use MotoSans.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, existing `next/font/google` Geist variables, existing Course Studio client components, and existing Postgres-backed revision/feedback APIs.

## Global Constraints

- Course Studio remains Lionbridge's authoring product; the learner-facing `moto tutor` experience is the product surface.
- Preserve existing course IDs, lesson types, player routes, learner progress behavior, revision immutability, and review/feedback API contracts.
- Do not create or run automated tests or test files; use typecheck, lint, build, diff checks, and browser evidence.
- Use lowercase visible `moto tutor` naming and keep technical package names unchanged.
- Use Geist for the application shell, Course Studio, library, analytics, and review controls.
- Use MotoSans only for the learner-facing product player and embedded product preview content.
- Preserve unrelated working-tree changes and stage only files in the current task.

---

### Task 1: Establish the application/product font boundary

**Files:**
- Modify: `apps/web/src/app/globals.css:1-38,165-175`
- Modify: `apps/web/src/player/LessonFrame.tsx:57-67`

**Interfaces:**
- Consumes: `--font-geist-sans` and `--font-geist-mono` variables supplied by `apps/web/src/app/layout.tsx`.
- Produces: a global Geist `--font-sans` token and a scoped player class that overrides `--font-sans` with MotoSans for the player and preview.

- [ ] **Step 1: Change the global typography tokens**

In `globals.css`, keep both MotoSans `@font-face` declarations but change the theme tokens so the application default resolves to Geist:

```css
--font-sans: var(--font-geist-sans), sans-serif;
--font-mono: var(--font-geist-mono), monospace;
--font-heading: var(--font-sans);
```

Add a scoped utility in the same stylesheet that both sets the inherited family and overrides Tailwind's `font-sans` token for descendants that explicitly use it:

```css
.font-product {
  --font-sans: 'MotoSans', sans-serif;
  --font-heading: var(--font-sans);
  font-family: var(--font-sans);
}
```

Keep the root `html` `@apply font-sans` rule so internal application surfaces use Geist by default.

- [ ] **Step 2: Scope the product font to the player frame**

Add `font-product` to the outer `LessonFrame` wrapper class. `MotoViewer` uses `LessonFrame` for both the learner route and `AuthoringPreview`, so this scopes product typography to the actual product canvas while leaving the Studio/review/library shells on Geist. Do not add MotoSans to the root layout or body.

- [ ] **Step 3: Check the font diff**

Run:

```bash
git diff --check
rg -n -- "--font-sans|font-product|MotoSans" apps/web/src/app/globals.css apps/web/src/player/LessonFrame.tsx
```

Expected: the global token references Geist, the only product override is scoped, and MotoSans is not assigned to `html`, `body`, or the root layout.

- [ ] **Step 4: Commit the typography boundary**

```bash
git add apps/web/src/app/globals.css apps/web/src/player/LessonFrame.tsx
git commit -m "refactor: scope MotoSans to product surfaces"
```

### Task 2: Move the course-settings save footer into the left outline

**Files:**
- Modify: `apps/web/src/course-studio/inspectors/CourseInspector.tsx:39-54,176-186,241-326`
- Modify: `apps/web/src/course-studio/StudioInspector.tsx:5-31,64-69`
- Modify: `apps/web/src/course-studio/CourseOutline.tsx:8-35,49-126`
- Modify: `apps/web/src/course-studio/CourseStudioWorkspace.tsx:25-58,228-291`

**Interfaces:**
- Consumes: current `CourseInspector` validation, dirty tracking, upload locking, save error, and submit handler.
- Produces: `CourseInspectorSaveState`, a stable `course-settings-form` association, and a left-outline save footer that preserves current submit enablement and unsaved-change guards.

- [ ] **Step 1: Define the save-state contract**

Add an exported interface next to `CourseInspectorProps`:

```ts
export interface CourseInspectorSaveState {
  dirty: boolean;
  valid: boolean;
  locked: boolean;
  saving: boolean;
  uploading: boolean;
  saved: boolean;
  error: string | null;
}
```

Add optional `formId?: string` and `onSaveStateChange?: (state: CourseInspectorSaveState) => void` props. Keep `onDirtyChange` for the existing navigation guard.

- [ ] **Step 2: Report state and give the form a stable ID**

In `CourseInspector`, report the complete save state from an effect keyed by the derived state values. Use `course-settings-form` as the default form ID and set it on the `<form>`. Keep validation, upload locking, `submit`, and `onSave` unchanged.

Remove the current sticky footer from `CourseInspector`; the inspector should end after its fields so the bottom tools area contains only the settings form content.

- [ ] **Step 3: Thread the save state through StudioInspector and Workspace**

Extend `StudioInspector` with `onSaveStateChange` and `courseSettingsFormId` props. Pass them only to `CourseInspector`; report a neutral state for chapter/lesson selections if the outline needs the state reset when the selected kind changes.

In `CourseStudioWorkspace`, add state initialized to a neutral save state, pass the state callback to `StudioInspector`, and pass the state plus `course-settings-form` to `CourseOutline`. Keep `courseSettingsDirty` as the source used by `confirmDiscardCourseSettings`.

- [ ] **Step 4: Render the footer in CourseOutline**

Extend `CourseOutline` props with `courseSaveState?: CourseInspectorSaveState` and `courseSettingsFormId?: string`. When the current selection is the course, render a bottom footer after the trash panel with:

```tsx
<p aria-live="polite">{saveStateMessage}</p>
<button
  disabled={state.locked || !state.dirty || !state.valid}
  form={courseSettingsFormId}
  type="submit"
>
  {state.saving ? 'Saving…' : 'Save course settings'}
</button>
```

Use the same messages and destructive styling currently produced by `CourseInspector`: upload lock, saving, save error, saved, invalid dirty form, unsaved changes, and no unsaved changes. Preserve visible focus rings and the existing minimum touch target.

- [ ] **Step 5: Verify save behavior statically**

Run:

```bash
npm run typecheck
npm run lint
git diff --check
```

Expected: the form remains the only submit owner, the left button is associated with `course-settings-form`, and no duplicate save footer remains in the bottom tools area.

- [ ] **Step 6: Commit the save-footer repositioning**

```bash
git add apps/web/src/course-studio/inspectors/CourseInspector.tsx apps/web/src/course-studio/StudioInspector.tsx apps/web/src/course-studio/CourseOutline.tsx apps/web/src/course-studio/CourseStudioWorkspace.tsx
git commit -m "feat: move course settings save into outline"
```

### Task 3: Make the existing review panel selectable and loadable from the library

**Files:**
- Modify: `apps/web/src/course-studio/RevisionPanel.tsx:1-160`
- Modify: `apps/web/src/course-studio/CourseStudioWorkspace.tsx:1-20,278-291`
- Modify: `apps/web/src/app/studio/[courseId]/page.tsx:1-31`

**Interfaces:**
- Consumes: existing revision and feedback endpoint payloads and current Studio server-loaded initial data.
- Produces: `RevisionPanel` support for `autoLoad` on selection while preserving server-initialized editor behavior; the editor no longer owns the Client review panel.

- [ ] **Step 1: Add explicit auto-load behavior to RevisionPanel**

Add an optional `autoLoad?: boolean` prop, defaulting to `false`, plus local `loading` and `loadError` state. Convert `load` to a `useCallback` keyed by `courseId`, check both response statuses, and store a useful error when either revisions or feedback cannot be loaded.

When `autoLoad` is true, run the loader in an effect on mount and whenever `courseId` changes. Clear revisions, feedback, generated link, and message before loading the new course. Render a small loading message while the fetch is active and an inline retry action when loading fails. Keep freeze, share, copy, resolve, and busy behavior intact.

- [ ] **Step 2: Preserve the editor's course data boundaries**

Remove the `RevisionPanel` import and render from `CourseStudioWorkspace`. Remove `initialRevisions` and `initialFeedback` from its props. In `apps/web/src/app/studio/[courseId]/page.tsx`, stop loading revisions and feedback for the editor page and pass only `initialCourse` and `initialTrash` to the workspace. Leave the revision and feedback API routes and the external review page unchanged.

- [ ] **Step 3: Verify the panel contract**

Run:

```bash
npm run typecheck
npm run lint
git diff --check
```

Expected: the editor builds without review props, and `RevisionPanel` still supports initial server data when `autoLoad` is false and dynamic library data when it is true.

- [ ] **Step 4: Commit the review-panel extraction**

```bash
git add apps/web/src/course-studio/RevisionPanel.tsx apps/web/src/course-studio/CourseStudioWorkspace.tsx -- 'apps/web/src/app/studio/[courseId]/page.tsx'
git commit -m "refactor: move client review out of editor"
```

### Task 4: Add course selection and review preparation to the library

**Files:**
- Create: `apps/web/src/course-studio/CourseLibrary.tsx`
- Modify: `apps/web/src/app/studio/page.tsx:1-60`

**Interfaces:**
- Consumes: authenticated server-loaded course card records, existing thumbnail fallback logic, `RevisionPanel` with `autoLoad`, and `/studio/[courseId]` editor links.
- Produces: an accessible library card grid with independent `Open editor` and `Prepare for review` actions and a selected-course review panel.

- [ ] **Step 1: Move card composition into a client component**

Create `CourseLibrary.tsx` with a serializable course item type containing `id`, `title`, `description`, and `cover`. Accept `courses` and keep `selectedCourseId` in local state. Move the thumbnail URL extraction and first-image priority calculation into this component.

Render each course as an article instead of wrapping the entire card in a link so nested actions remain valid. Include:

```tsx
<Link href={`/studio/${course.id}`}>Open editor</Link>
<button
  aria-pressed={selectedCourseId === course.id}
  onClick={() => setSelectedCourseId(course.id)}
  type="button"
>
  Prepare for review
</button>
```

Highlight the selected course and expose a `Clear selection` button in the review area. Keep the thumbnail, title, description, fallback placeholder, and image `sizes` behavior from the current library.

- [ ] **Step 2: Render the selected-course review panel**

When a course is selected, render a bordered review area below the cards on small screens and in a full-width responsive area on larger screens. Identify the selected course by title and thumbnail, then render:

```tsx
<RevisionPanel
  autoLoad
  courseId={selectedCourse.id}
  disabled={false}
  initialFeedback={[]}
  initialRevisions={[]}
/>
```

Do not call freeze during selection. Let the existing `Freeze` action create the immutable revision, and let existing revision rows create or replace review links. When selection changes, the keyed panel or `courseId` effect must clear the previous course's message, link, revisions, and feedback before loading the new course.

- [ ] **Step 3: Integrate the client library into the server page**

Keep authentication, `listAuthoringCourses()`, the create-course form, page heading, and empty state in `apps/web/src/app/studio/page.tsx`. Replace the current card map with `<CourseLibrary courses={courses} />`. Pass only data needed by the card UI and preserve the current server image priority behavior through the new component.

- [ ] **Step 4: Verify library interaction statically**

Run:

```bash
npm run typecheck
npm run lint
git diff --check
```

Expected: card actions are keyboard-accessible, no nested interactive elements remain, and the review panel receives only the selected course ID and existing API-backed state.

- [ ] **Step 5: Commit the library review workflow**

```bash
git add apps/web/src/course-studio/CourseLibrary.tsx apps/web/src/app/studio/page.tsx
git commit -m "feat: add library course review selection"
```

### Task 5: Run integrated verification and browser evidence

**Files:**
- Verify only the files changed in Tasks 1-4; do not create automated test files.

**Interfaces:**
- Consumes: the completed font boundary, left-panel save action, library selection workflow, and existing authenticated Studio/review routes.
- Produces: observed static and browser evidence with any environment blockers clearly recorded.

- [ ] **Step 1: Run project-native checks**

Run:

```bash
npm run typecheck
npm run lint
git diff --check
npm run build
```

If the build reaches Prisma and PostgreSQL is unavailable, record the observed `P1001` or migration error and verify the remaining static checks separately. Do not claim the build passed without its observed output.

- [ ] **Step 2: Start the app and inspect application typography**

Use the repository's normal dev command and Chrome DevTools or Playwright to inspect `/studio`, `/analytics`, and `/review/[token]` where authenticated/test data is available. Confirm their computed body/application font is Geist and that the internal controls do not inherit MotoSans.

- [ ] **Step 3: Verify library review selection**

On `/studio`, confirm:

1. each card exposes `Open editor` and `Prepare for review` independently;
2. selecting a course highlights that card and shows the course-specific review panel;
3. review data loads or displays an explicit error/retry state;
4. selecting another course clears the previous course's link/message and loads the new course;
5. Freeze, Share/Replace link, Copy review link, and Resolve use the existing API flow;
6. the layout remains usable at desktop and mobile widths.

- [ ] **Step 4: Verify editor save placement and product typography**

Open `/studio/[courseId]` and confirm:

1. the save/status footer is in the left outline when the course is selected;
2. course fields remain in the bottom tools area;
3. the footer disables for clean, invalid, locked, or saving state;
4. clicking the footer submits the course form and preserves dirty-change confirmation;
5. the Course Studio shell uses Geist;
6. the live learner canvas uses MotoSans through the scoped product frame;
7. focus preview still hides authoring tools and retains product typography.

- [ ] **Step 5: Record final evidence**

Capture the observed commands, browser routes, viewport sizes, console/server errors, and any blocked database/authentication flows in the final handoff. Do not report persistence, freeze, or review-link success without observing the corresponding network response and UI state.
