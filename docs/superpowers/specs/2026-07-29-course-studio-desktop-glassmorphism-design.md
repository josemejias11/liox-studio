# Course Studio desktop glassmorphism workspace

## Status

Approved visual direction; written specification submitted for user review before implementation.

## Context

Course Studio is a desktop authoring tool for building and reviewing complete learning masters. Its current layout and behavior are approved: the library owns review preparation, the editor has a resizable persistent outline and tools panel, the desktop shell isolates scrolling, and the learner preview uses the product typography and visual language.

The next visual pass changes the authoring tool itself to a glassmorphism workspace inspired by the supplied reference image. The learner-facing product and the live learner preview remain unchanged so authors can clearly distinguish the authoring environment from the output they are creating.

## Goals

1. Give Course Studio a premium desktop-first glassmorphism visual system.
2. Apply the visual treatment consistently to the Studio library, editor shell, outline, inspector/tools area, and library review panel.
3. Preserve the existing desktop workspace geometry, resizable panel behavior, local persistence, review workflow, save behavior, font boundary, and navigation safeguards.
4. Keep authoring controls readable and operational over translucent surfaces, including form fields, validation messages, selected states, separators, and busy states.
5. Make the visual boundary between authoring chrome and the learner product explicit: Studio chrome changes; product preview content does not.

## Non-goals

- No change to learner-facing routes, lesson rendering, product copy, progress, or product interaction behavior.
- No change to course, lesson, revision, feedback, or asset data contracts.
- No change to review-link, freeze, feedback, or save APIs.
- No new responsive/mobile redesign in this pass. Small-screen fallback remains functional, but desktop is the acceptance target.
- No change to the existing MotoSans product scope or Geist application typography boundary.
- No removal or blanket prohibition of icons. Existing purposeful icons may remain in the tool; the visual system should avoid decorative clutter without changing control semantics.
- No new server or database settings for visual preferences.

## Scope boundary

The visual treatment applies to Course Studio authoring surfaces:

- `/studio` library and course-creation surface;
- `/studio/[courseId]` editor toolbar, outline, canvas frame, separators, bottom tools, inspector, and review-related controls rendered in Studio;
- the Studio login shell only where it shares the authoring visual frame.

The visual treatment does not apply to:

- `/course/[slug]` learner product pages;
- learner lesson components rendered inside the live preview;
- the content and interaction styling inside `AuthoringPreview`.

The preview frame may use a glass boundary to separate it from the authoring shell, but its rendered product content must retain its existing product styles.

## Visual system

### Workspace foundation

Use a soft, light desktop canvas rather than a mobile-card composition. The base should carry a very subtle cool blue/indigo ambient gradient or blurred light fields behind the workspace. The effect must remain quiet enough that labels, forms, and course content are the visual priority.

Use layered surfaces with:

- translucent white or near-white backgrounds;
- `backdrop-filter: blur(...)` where supported;
- thin low-opacity borders that remain visible in light and dark themes;
- diffuse shadows rather than hard card outlines;
- rounded corners at the workspace, panel, and card levels with restrained radii;
- a non-glass fallback background and border for browsers without backdrop-filter support.

### Surface hierarchy

Use three clear levels so the editor does not become visually flat:

1. Workspace shell: the broadest translucent surface over the ambient background.
2. Tool panels: outline, inspector, toolbar, library review panel, and bottom tools use a slightly denser glass surface with stronger border contrast.
3. Controls and content cards: form fields, selected course cards, revision rows, alerts, and action groups use more opaque surfaces for legibility and interaction feedback.

The live learner canvas remains visually distinct from these surfaces. Its product content should not inherit glass utility classes through a broad ancestor selector.

### Color and state treatment

Keep the existing Motorola palette and use indigo as the primary authoring accent. Use translucent indigo only for selection, focus, active separators, and progress states. Destructive, warning, loading, and validation states must retain their semantic contrast and must not be represented by blur or opacity alone.

Focus rings remain visible over glass. Disabled controls may reduce opacity, but their text and state must remain understandable. The layout must remain readable when transparency is reduced or forced off.

### Typography and icons

Course Studio chrome, controls, forms, library cards, and review controls continue to use Geist. The learner product and its preview continue to use MotoSans through the existing scoped product boundary.

Icons remain available where they communicate an action or status. The implementation should use the existing icon vocabulary and preserve accessible labels; this pass changes their surrounding surface treatment, not their meaning or availability.

## Layout behavior

### Desktop editor

At the existing desktop breakpoint, preserve the current viewport-locked grid:

- left outline with a persistent resizable width;
- center learner canvas with its own content boundary;
- bottom tools/inspector panel with a persistent resizable height;
- keyboard- and pointer-accessible separators;
- internal scrolling in outline and tools regions, with no document-level editor scroll.

Glass backgrounds must not introduce new overflow, stacking, or clipping bugs. Blur and shadows must remain within the workspace rather than creating large painted regions that obscure separators or focus states.

### Desktop library

The library should feel like a wide authoring dashboard rather than a mobile card stack. Keep the current course grid and explicit `Open editor` and `Prepare for review` actions, but apply the glass hierarchy to the page shell, cards, selected state, and inline review panel. The selected-course review panel remains full-width below or beside the course grid according to the existing desktop composition; its data flow and controls do not change.

### Narrow fallback

Do not optimize this pass around mobile. Preserve the current stacked fallback so the app remains usable below the desktop breakpoint, but avoid introducing new mobile-only navigation, condensed controls, or alternate interaction models.

## Component and styling design

Add narrowly scoped Studio visual utilities or component classes in the existing stylesheet rather than changing global product styles. Suggested responsibilities:

- one Studio workspace background treatment;
- one glass shell/panel treatment;
- one denser control surface treatment;
- one selected/focus treatment;
- one reduced-transparency fallback.

Apply these classes at Course Studio boundaries such as `CourseStudioWorkspace`, `CourseLibrary`, `StudioToolbar`, `CourseOutline`, `StudioInspector`, `RevisionPanel`, and the Studio page shell. Do not apply them to `AuthoringPreview` descendants or learner player components.

Avoid changing component behavior solely to achieve the visual treatment. Existing callbacks, form associations, data loading, busy states, panel dimensions, navigation guards, and review selection state remain the source of truth.

## Accessibility and resilience

- Verify text and control contrast over translucent surfaces in both light and dark themes.
- Preserve visible keyboard focus on buttons, links, inputs, selects, separators, and review actions.
- Keep separator ARIA semantics and keyboard resizing unchanged.
- Ensure glass effects have a solid fallback when `backdrop-filter` is unsupported or reduced-transparency preferences are active.
- Keep all existing accessible labels and live regions.
- Do not use blur, transparency, or iconography as the only signal for selection, status, or error.

## Verification

Use the repository-native checks without creating or running automated test files:

- `npm run typecheck`;
- `npm run lint`;
- `npm run build` when the local database prerequisite is available;
- `git diff --check`;
- browser verification at desktop sizes such as 1440×810 and 1280×800 for library, editor, resizers, internal scrolling, review panel, and dirty-navigation guards;
- browser verification that the preview retains its existing product appearance and MotoSans while Studio chrome remains Geist;
- browser verification with reduced transparency or a fallback style where available;
- console and network inspection for new errors or failed Studio assets.

The final report must distinguish visual browser evidence from static-only checks and note any authenticated or persistence flow that could not be exercised.
