# Moto Interaction Families Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve the traditional Moto hotspot while giving Stage, Canvas, and reading-focused lessons distinct interaction presentations that share the same progress and Sanity data.

**Architecture:** Extend the existing `Hotspot` component with a backward-compatible presentation prop, then select presentations at each lesson renderer. Reuse the current hotspot activation and progress callbacks, introduce one focused inline-cue component for Portable Text, and keep the existing lesson registry, course route, and saved progress keys unchanged.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, Framer Motion, Sanity Portable Text, Lucide React.

## Global Constraints

- Preserve the traditional pulsing hotspot and its current discovery-panel behavior.
- Existing `Hotspot` call sites must remain source-compatible; `presentation` defaults to `classic`.
- Do not add a new course route, player, lesson type, top-level Sanity field, dependency, or progress key.
- Do not modify task-based interactions for `dragDrop`, `colorSwitcher`, `video`, or `quiz`.
- Product callouts collapse to the traditional hotspot below the `md` breakpoint.
- All targets retain a minimum 44-pixel touch area and keyboard activation.
- Respect `prefers-reduced-motion`.
- Do not create automated tests, test files, testing configuration, or test fixtures.
- Preserve all unrelated user changes in the dirty worktree and stage only the files owned by each task.
- The current target files already contain approved uncommitted work. Do not commit or stage whole files during execution unless the user separately authorizes the complete combined scope.

---

## File Structure

### Create

- `apps/web/src/player/lesson-types/InlineDiscoveryCue.tsx`
  - Owns the Connect-family inline button, visited state, and optional anchored summary.

### Modify

- `apps/web/src/components/Hotspot.tsx`
  - Adds `classic`, `callout`, and `reticle` presentations while preserving current variants and activation behavior.
- `apps/web/src/player/lesson-types/ProductStage.tsx`
  - Selects the callout presentation and connector direction for Stage.
- `apps/web/src/player/lesson-types/CanvasInspectionLesson.tsx`
  - Selects the reticle presentation, focuses the target, and uses the existing sidebar discovery surface.
- `apps/web/src/player/lesson-types/ContentLesson.tsx`
  - Keeps traditional hotspots for Interaction and uses the shared inline cue for linked editorial content.
- `apps/web/src/player/lesson-types/SplitScreenLesson.tsx`
  - Enables covered-feature inline cues in Portable Text.
- `apps/web/src/player/lesson-types/ScrollStoryLesson.tsx`
  - Enables covered-feature inline cues in chapter Portable Text.
- `apps/web/src/player/LessonRenderer.tsx`
  - Passes visited and activation callbacks into Split Screen and Scroll Story.
- `apps/web/src/sanity/schemaTypes/lesson/richText.ts`
  - Exports one reusable `layerLinkAnnotation` definition.
- `apps/web/src/sanity/schemaTypes/lesson/contentFields.ts`
  - Reuses `layerLinkAnnotation` for lesson body content.
- `apps/web/src/sanity/schemaTypes/lesson/interactionFields.ts`
  - Reuses `layerLinkAnnotation` for Scroll Story chapter bodies.

---

### Task 1: Add the backward-compatible hotspot presentation API

**Files:**

- Modify: `apps/web/src/components/Hotspot.tsx:3-186`

**Interfaces:**

- Consumes: Existing `HotspotVariant`, `HotspotProps`, visit/open callbacks, and roving-tabindex props.
- Produces:

```ts
export type HotspotPresentation = 'classic' | 'callout' | 'reticle';

export interface HotspotProps {
  // existing props remain unchanged
  presentation?: HotspotPresentation;
  calloutSide?: 'left' | 'right';
}
```

- [ ] **Step 1: Add the presentation types without changing the default**

Add the two props to `HotspotProps` and destructure them with these defaults:

```ts
presentation = 'classic',
calloutSide = 'right',
```

Do not rename or remove `variant`; it continues to control color and ring styling.

- [ ] **Step 2: Preserve the existing physical dot as the shared center**

Keep the current wave rings, burst, visited halo, dot, icon, and check rendering. Derive presentation flags immediately after `ringClass`:

```ts
const isCallout = presentation === 'callout';
const isReticle = presentation === 'reticle';
const compactTooltipClass = presentation === 'classic' ? '' : 'md:hidden';
```

Append `compactTooltipClass` to the existing tooltip class string. The tooltip remains unchanged for `classic`; callout and reticle tooltips remain available below `md` as the compact fallback.

- [ ] **Step 3: Add the Stage callout decoration**

Inside the button, render a pointer-events-none desktop-only connector and persistent label when `isCallout`:

```tsx
{isCallout && (
  <span
    className={`pointer-events-none absolute top-1/2 hidden -translate-y-1/2 items-center md:flex ${
      calloutSide === 'left' ? 'right-1/2 flex-row-reverse' : 'left-1/2'
    }`}
  >
    <span
      className={`h-px w-14 ${
        calloutSide === 'left' ? 'bg-linear-to-l' : 'bg-linear-to-r'
      } from-[#bcb4ff] to-[#685bc7]/35`}
    />
    <span className="rounded-xl border border-white/15 bg-[#111225]/88 px-3 py-2 text-xs font-semibold whitespace-nowrap text-white shadow-xl backdrop-blur-xl">
      {label}
    </span>
  </span>
)}
```

- [ ] **Step 4: Add the Canvas reticle decoration**

Render a pointer-events-none crosshair around the shared dot when `isReticle`:

```tsx
{isReticle && (
  <span className="pointer-events-none absolute h-16 w-16 rounded-full border border-[#9eb0ff]/75 shadow-[0_0_0_10px_rgba(158,176,255,0.08)]">
    <span className="absolute top-1/2 left-[-14px] h-px w-[90px] -translate-y-1/2 bg-[#9eb0ff]/65" />
    <span className="absolute top-[-14px] left-1/2 h-[90px] w-px -translate-x-1/2 bg-[#9eb0ff]/65" />
  </span>
)}
```

Add `motion-reduce:transition-none` and `motion-reduce:animate-none` to continuous ring and presentation decorations. Keep the visible state change and check icon when motion is reduced.

- [ ] **Step 5: Format and run static checks**

Run:

```bash
npx prettier --write apps/web/src/components/Hotspot.tsx
npm run typecheck
npm run lint
git diff --check
```

Expected: every command exits `0`; no test command is run.

- [ ] **Step 6: Record the shared-primitive checkpoint**

```bash
git diff --check -- apps/web/src/components/Hotspot.tsx
git status --short -- apps/web/src/components/Hotspot.tsx
```

Expected: the file remains modified but unstaged in the current dirty checkout.

---

### Task 2: Apply the Explore presentation to Product Stage

**Files:**

- Modify: `apps/web/src/player/lesson-types/ProductStage.tsx:328-419`

**Interfaces:**

- Consumes: `Hotspot presentation="callout"` and `calloutSide`.
- Produces: Stage callouts on desktop with the existing traditional hotspot retained on mobile.

- [ ] **Step 1: Select connector direction from the authored coordinate**

In both Product Stage hotspot render branches, add:

```tsx
presentation="callout"
calloutSide={h.x >= 50 ? 'left' : 'right'}
```

Keep `variant="pulse"`, `onVisit`, `onOpen`, `tabIndex`, `ref`, and `onFocus` unchanged.

- [ ] **Step 2: Preserve Stage entrance and keyboard behavior**

Do not change the outer staggered entrance wrappers or `hotspotRefs`. Confirm the callout label remains inside the existing pointer-events-enabled wrapper and the connector itself cannot intercept pointer events.

- [ ] **Step 3: Review collision behavior**

At desktop width, verify left-half targets extend labels to the right and right-half targets extend labels to the left. At widths below `768px`, confirm the persistent connector and label are hidden and the original pulsing hotspot tooltip remains.

- [ ] **Step 4: Run static and live verification**

Run:

```bash
npx prettier --write apps/web/src/player/lesson-types/ProductStage.tsx
npm run typecheck
npm run lint
git diff --check
```

Then use Chrome DevTools on the Atlas Stage lesson at `1440x900` and `390x844`.

Expected:

- Desktop shows persistent labeled callouts.
- Mobile shows the traditional pulsing hotspot.
- Arrow-key focus, Enter/Space activation, visited checks, progress count, and the discovery panel still work.
- Browser console contains no errors, warnings, or issues introduced by the change.

- [ ] **Step 5: Record the Stage checkpoint**

```bash
git diff --check -- apps/web/src/player/lesson-types/ProductStage.tsx
git status --short -- apps/web/src/player/lesson-types/ProductStage.tsx
```

---

### Task 3: Apply the Inspect presentation to Canvas

**Files:**

- Modify: `apps/web/src/player/lesson-types/CanvasInspectionLesson.tsx:30-213`

**Interfaces:**

- Consumes: `Hotspot presentation="reticle"` and existing `clampCanvasZoom`.
- Produces: `openInspectionTarget(target: SanityHotspot): void`.

- [ ] **Step 1: Add target-focus behavior**

Add this function below `updateZoom`:

```ts
function openInspectionTarget(target: SanityHotspot) {
  const focusedZoom = clampCanvasZoom(Math.max(zoom, 1.25));
  const maxOffset = (focusedZoom - 1) * 35;
  const nextX = Math.max(-maxOffset, Math.min(maxOffset, (50 - target.x) * 0.18));
  const nextY = Math.max(-maxOffset, Math.min(maxOffset, (50 - target.y) * 0.18));

  setZoom(focusedZoom);
  setOffset({ x: nextX, y: nextY });
  setActiveTarget(toActiveTarget(target));
}
```

This uses the existing canvas state and does not add a second coordinate or progress model.

- [ ] **Step 2: Select the reticle presentation**

Change each Canvas target to:

```tsx
<Hotspot
  key={target._key}
  x={target.x}
  y={target.y}
  label={target.label}
  visited={visitedLabels.has(target.label)}
  variant="moto-indigo-black"
  presentation="reticle"
  onVisit={() => onVisit(target.label)}
  onOpen={() => openInspectionTarget(target)}
/>
```

- [ ] **Step 3: Use the existing sidebar as the inspection tray**

Change the Canvas `DiscoveryPanel` from `mode="popover"` to:

```tsx
mode="sidebar"
```

Keep the target coordinates in the panel props for announcements and compatibility, but do not position the inspection surface over the focused target.

- [ ] **Step 4: Verify canvas state preservation**

Run:

```bash
npx prettier --write apps/web/src/player/lesson-types/CanvasInspectionLesson.tsx
npm run typecheck
npm run lint
git diff --check
```

Use Chrome DevTools to verify:

- A target click focuses the target and opens the sidebar.
- Closing the sidebar preserves zoom and offset.
- Reset returns to `100%` and zero offset.
- Dragging works after closing the sidebar.
- Required-target counts and the Next gate still update.
- Reticles remain visible and tappable at `390x844`.

- [ ] **Step 5: Record the Canvas checkpoint**

```bash
git diff --check -- apps/web/src/player/lesson-types/CanvasInspectionLesson.tsx
git status --short -- apps/web/src/player/lesson-types/CanvasInspectionLesson.tsx
```

---

### Task 4: Add the Connect inline cue

**Files:**

- Create: `apps/web/src/player/lesson-types/InlineDiscoveryCue.tsx`
- Modify: `apps/web/src/player/lesson-types/ContentLesson.tsx:3-241`
- Modify: `apps/web/src/player/lesson-types/SplitScreenLesson.tsx:3-80`
- Modify: `apps/web/src/player/lesson-types/ScrollStoryLesson.tsx:1-179`
- Modify: `apps/web/src/player/LessonRenderer.tsx:109-135`
- Modify: `apps/web/src/sanity/schemaTypes/lesson/richText.ts:1-8`
- Modify: `apps/web/src/sanity/schemaTypes/lesson/contentFields.ts:1-43`
- Modify: `apps/web/src/sanity/schemaTypes/lesson/interactionFields.ts:1-232`

**Interfaces:**

- Consumes: Existing `layerLink.linkedLayer`, `SanityHotspot`, `coveredFeatures`, visited labels, and `onVisit`.
- Produces:

```ts
export interface InlineDiscoveryCueProps {
  label: string;
  summary?: string;
  visited: boolean;
  onActivate: () => void;
  children: React.ReactNode;
}

export function InlineDiscoveryCue(props: InlineDiscoveryCueProps): React.ReactNode;
```

- [ ] **Step 1: Extract one reusable Sanity annotation definition**

In `richText.ts`, import `defineField` and export:

```ts
import { defineField } from 'sanity';

export const layerLinkAnnotation = defineField({
  name: 'layerLink',
  type: 'object',
  title: 'Learning Cue',
  fields: [
    defineField({
      name: 'linkedLayer',
      type: 'string',
      title: 'Linked Feature Label',
      description: 'Must match a hotspot or covered feature label in this lesson.',
      validation: (rule) => rule.required(),
    }),
  ],
});
```

Keep `richTextDecorators` unchanged. Replace the duplicated annotation object in `contentFields.ts` with `layerLinkAnnotation`. Add the same annotation to Scroll Story chapter-body marks in `interactionFields.ts`:

```ts
marks: {
  decorators: richTextDecorators,
  annotations: [layerLinkAnnotation],
},
```

This reuses the existing annotation and fields; it does not add a new top-level Sanity field.

- [ ] **Step 2: Create the inline cue component**

Create `InlineDiscoveryCue.tsx` with local expanded state:

```tsx
'use client';

import { useState, type ReactNode } from 'react';
import { Check, Plus } from 'lucide-react';

export interface InlineDiscoveryCueProps {
  label: string;
  summary?: string;
  visited: boolean;
  onActivate: () => void;
  children: ReactNode;
}

export function InlineDiscoveryCue({
  label,
  summary,
  visited,
  onActivate,
  children,
}: InlineDiscoveryCueProps) {
  const [expanded, setExpanded] = useState(false);

  function activate() {
    onActivate();
    if (summary) setExpanded((value) => !value);
  }

  return (
    <span className="relative mx-1 inline-block">
      <button
        type="button"
        aria-label={`Connect to ${label}`}
        aria-expanded={summary ? expanded : undefined}
        onClick={activate}
        className="group/cue inline-flex min-h-11 items-center gap-1 rounded-lg px-1.5 font-semibold text-[#443b86] underline decoration-[#685bc7]/45 decoration-2 underline-offset-4 transition-colors hover:bg-[#685bc7]/8 hover:decoration-[#685bc7] focus-visible:ring-2 focus-visible:ring-[#685bc7] focus-visible:outline-none"
      >
        {children}
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#685bc7] text-white">
          {visited ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
        </span>
      </button>
      {summary && expanded && (
        <span role="note" className="mt-2 block max-w-md rounded-xl border border-[#685bc7]/15 bg-[#f0eef8] px-4 py-3 text-sm leading-relaxed text-[#514b77] shadow-sm">
          {summary}
        </span>
      )}
    </span>
  );
}
```

The component owns only its visual expansion. The parent remains responsible for progress and rich hotspot panels.

- [ ] **Step 3: Replace Content's local link button**

In `ContentLesson.tsx`, resolve `linkedLayer` against both data sources:

```ts
const hotspot = hotspots.find((item) => item.label === value?.linkedLayer);
const coveredFeature = lesson.coveredFeatures?.find(
  (item) => item.label === value?.linkedLayer,
);
const label = hotspot?.label ?? coveredFeature?.label ?? value?.linkedLayer ?? 'feature';
```

If neither source resolves, render `children` without a button:

```tsx
if (!hotspot && !coveredFeature) return <>{children}</>;
```

Render `InlineDiscoveryCue` with:

```tsx
<InlineDiscoveryCue
  label={label}
  summary={coveredFeature?.summary}
  visited={visitedLabels.has(label)}
  onActivate={() => {
    onVisit(label);
    if (hotspot) setActivePanel(toActivePanel(hotspot));
  }}
>
  {children}
</InlineDiscoveryCue>
```

Extract the existing hotspot-to-panel mapping into:

```ts
function toActivePanel(hotspot: SanityHotspot): ActivePanel {
  return {
    topic: hotspot.topic,
    title: hotspot.label,
    body: hotspot.body,
    x: hotspot.x,
    y: hotspot.y,
    photos: hotspot.photos,
    videoFile: hotspot.videoFile,
    videoAspectRatio: hotspot.videoAspectRatio,
  };
}
```

Use that helper for both inline links and floating traditional hotspots. Keep `presentation="classic"` implicit on Interaction hotspots so the current component remains unchanged.

- [ ] **Step 4: Enable cues in Split Screen**

Extend `SplitScreenLessonProps`:

```ts
interface SplitScreenLessonProps {
  lesson: SanityLesson;
  visitedLabels: Set<string>;
  onVisit: (label: string) => void;
}
```

Import `PortableTextMarkComponent` and `InlineDiscoveryCue`, then add this mark component:

```tsx
const LayerLinkMark: PortableTextMarkComponent<{
  _type: 'layerLink';
  linkedLayer?: string;
}> = ({ children, value }) => {
  const feature = lesson.coveredFeatures?.find(
    (item) => item.label === value?.linkedLayer,
  );
  if (!feature) return <>{children}</>;

  return (
    <InlineDiscoveryCue
      label={feature.label}
      summary={feature.summary}
      visited={visitedLabels.has(feature.label)}
      onActivate={() => onVisit(feature.label)}
    >
      {children}
    </InlineDiscoveryCue>
  );
};
```

Add it to the existing Portable Text mark map:

```tsx
components={{ marks: { layerLink: LayerLinkMark, ...supMark } }}
```

Update `LessonRenderer.tsx`:

```tsx
<SplitScreenLessonDynamic
  lesson={lesson}
  visitedLabels={visited}
  onVisit={markVisited}
/>
```

- [ ] **Step 5: Enable cues in Scroll Story**

Extend `ScrollStoryLessonProps`:

```ts
interface ScrollStoryLessonProps {
  lesson: SanityLesson;
  isCompleted: boolean;
  onComplete: () => void;
  visitedLabels: Set<string>;
  onVisit: (label: string) => void;
}
```

Add this mark component inside `ScrollStoryLesson`:

```tsx
const LayerLinkMark: PortableTextMarkComponent<{
  _type: 'layerLink';
  linkedLayer?: string;
}> = ({ children, value }) => {
  const feature = lesson.coveredFeatures?.find(
    (item) => item.label === value?.linkedLayer,
  );
  if (!feature) return <>{children}</>;

  return (
    <InlineDiscoveryCue
      label={feature.label}
      summary={feature.summary}
      visited={visitedLabels.has(feature.label)}
      onActivate={() => onVisit(feature.label)}
    >
      {children}
    </InlineDiscoveryCue>
  );
};
```

Import `PortableTextMarkComponent` and `InlineDiscoveryCue`, then add this mark map to each chapter `PortableText`:

```tsx
components={{ marks: { layerLink: LayerLinkMark, ...supMark } }}
```

Update `LessonRenderer.tsx`:

```tsx
<ScrollStoryLessonDynamic
  lesson={lesson}
  isCompleted={isSpecialComplete}
  onComplete={handleManualCompletion ?? (() => baseMarkVisited(lessonKey, 'completed', 1))}
  visitedLabels={visited}
  onVisit={markVisited}
/>
```

Inline cue visits must not replace Scroll Story's existing scroll-completion rule.

- [ ] **Step 6: Format and run static checks**

Run:

```bash
npx prettier --write \
  apps/web/src/player/lesson-types/InlineDiscoveryCue.tsx \
  apps/web/src/player/lesson-types/ContentLesson.tsx \
  apps/web/src/player/lesson-types/SplitScreenLesson.tsx \
  apps/web/src/player/lesson-types/ScrollStoryLesson.tsx \
  apps/web/src/player/LessonRenderer.tsx \
  apps/web/src/sanity/schemaTypes/lesson/richText.ts \
  apps/web/src/sanity/schemaTypes/lesson/contentFields.ts \
  apps/web/src/sanity/schemaTypes/lesson/interactionFields.ts
npm run typecheck
npm run lint
git diff --check
```

Expected: all commands exit `0`; no test command is run.

- [ ] **Step 7: Verify Connect behavior in the browser**

Use an existing `layerLink` annotation if the Atlas course already contains one. If it does not, verify authoring support in Sanity Studio without publishing placeholder content.

Confirm:

- A cue is a real button with a 44-pixel target.
- Activating a covered-feature cue expands its summary and marks the feature visited.
- Activating a hotspot cue opens the existing rich discovery panel and marks it visited.
- Split Screen and Scroll Story render normally when no cue exists.
- Scroll Story completion still depends on scroll progress.
- Reduced-motion mode preserves state changes without continuous animation.

- [ ] **Step 8: Record the Connect checkpoint**

```bash
git diff --check -- \
  apps/web/src/player/lesson-types/InlineDiscoveryCue.tsx \
  apps/web/src/player/lesson-types/ContentLesson.tsx \
  apps/web/src/player/lesson-types/SplitScreenLesson.tsx \
  apps/web/src/player/lesson-types/ScrollStoryLesson.tsx \
  apps/web/src/player/LessonRenderer.tsx \
  apps/web/src/sanity/schemaTypes/lesson/richText.ts \
  apps/web/src/sanity/schemaTypes/lesson/contentFields.ts \
  apps/web/src/sanity/schemaTypes/lesson/interactionFields.ts
git status --short -- \
  apps/web/src/player/lesson-types/InlineDiscoveryCue.tsx \
  apps/web/src/player/lesson-types/ContentLesson.tsx \
  apps/web/src/player/lesson-types/SplitScreenLesson.tsx \
  apps/web/src/player/lesson-types/ScrollStoryLesson.tsx \
  apps/web/src/player/LessonRenderer.tsx \
  apps/web/src/sanity/schemaTypes/lesson/richText.ts \
  apps/web/src/sanity/schemaTypes/lesson/contentFields.ts \
  apps/web/src/sanity/schemaTypes/lesson/interactionFields.ts
```

---

### Task 5: Complete the integrated player review

**Files:**

- Modify only if review reveals an issue in files owned by Tasks 1-4.

**Interfaces:**

- Consumes: `HotspotPresentation`, Product Stage callouts, Canvas reticles, and `InlineDiscoveryCue`.
- Produces: Browser evidence that all four families behave as one Moto system.

- [ ] **Step 1: Run the final static verification**

Run:

```bash
npm run typecheck
npm run lint
git diff --check
```

Expected: all commands exit `0`; no automated tests or test files are created.

- [ ] **Step 2: Review all interaction families at desktop size**

Use Chrome DevTools at `1440x900` and confirm:

- Discover: Interaction retains the original pulse, tooltip, visited check, and discovery panel.
- Explore: Stage shows labeled product callouts.
- Inspect: Canvas shows reticles, focuses a target, and opens the sidebar.
- Connect: Inline cues expand or open the correct content.
- Drag Drop, Color Switcher, Video, and Quiz retain their existing controls.

- [ ] **Step 3: Review all responsive fallbacks**

Use Chrome DevTools at `390x844` with touch emulation and confirm:

- Stage callouts collapse to traditional hotspots.
- Traditional hotspots remain at least 44 pixels.
- Canvas reticles do not block pan or zoom.
- Inline cues wrap without overflowing text cards.
- No lesson content is hidden behind player navigation.

- [ ] **Step 4: Review accessibility and reduced motion**

Confirm:

- Tab and arrow navigation reach the expected targets.
- Enter and Space activate the focused target.
- Escape closes discovery surfaces.
- Visible focus styling appears for every family.
- Accessible names describe the action and feature.
- Reduced motion removes continuous pulse or travel without hiding state changes.

- [ ] **Step 5: Inspect runtime output**

Reload the course from a clean document and inspect browser console and network activity.

Expected:

- No new console errors, warnings, or browser issues.
- Existing visited labels persist after reload.
- Existing course completion and disclaimer flow remain reachable.

- [ ] **Step 6: Record any narrow review correction**

If no correction is needed, leave the workspace unchanged. If a correction is required:

```bash
git diff --check -- \
  apps/web/src/components/Hotspot.tsx \
  apps/web/src/player/lesson-types/InlineDiscoveryCue.tsx \
  apps/web/src/player/lesson-types/ProductStage.tsx \
  apps/web/src/player/lesson-types/CanvasInspectionLesson.tsx \
  apps/web/src/player/lesson-types/ContentLesson.tsx \
  apps/web/src/player/lesson-types/SplitScreenLesson.tsx \
  apps/web/src/player/lesson-types/ScrollStoryLesson.tsx \
  apps/web/src/player/LessonRenderer.tsx \
  apps/web/src/sanity/schemaTypes/lesson/richText.ts \
  apps/web/src/sanity/schemaTypes/lesson/contentFields.ts \
  apps/web/src/sanity/schemaTypes/lesson/interactionFields.ts
```

Do not stage or commit the combined dirty worktree without separate user authorization.
