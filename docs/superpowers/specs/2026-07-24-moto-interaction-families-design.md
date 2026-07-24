# Moto Interaction Families Design

**Date:** 2026-07-24
**Status:** Approved direction, pending implementation plan

## Decision

The player will use one recognizable Moto interaction system with four related presentation families. The current pulsing hotspot remains intact as the core **Discover** interaction. Specialized lesson types extend its visual language instead of replacing it.

The system must feel consistent through Moto indigo, spring motion, focus behavior, visited states, completion feedback, and accessible labels. It must avoid making every lesson repeat the same floating-dot-to-popover sequence.

## Goals

- Preserve the traditional pulsing hotspot and its current discovery-panel behavior.
- Signal the intended learning action before the learner interacts.
- Give Stage, Canvas, and reading-focused lessons interaction patterns that fit their purpose.
- Keep progress, completion, and Sanity hotspot content compatible.
- Support desktop, touch, keyboard, and reduced-motion experiences.

## Non-goals

- Do not create a separate course route, player, or Sanity content model.
- Do not make authors choose from a complicated list of marker styles.
- Do not add hotspots to task-based lessons that already have an appropriate native interaction.
- Do not create automated tests or testing files.

## Interaction Families

### 1. Discover — traditional Moto hotspot

**Default lesson type:** `interaction`
**Optional fallback:** Any image-based lesson that genuinely needs free discovery

This is the existing pulsing Moto hotspot. Its wave rings, tooltip, visited check, click animation, accessibility label, progress behavior, and discovery panel remain available.

Discover is appropriate when the learner should freely examine an image and reveal several independent concepts. It is not the default for every lesson merely because hotspot data exists.

### 2. Explore — product callout

**Default lesson type:** `stage`

Explore uses the same indigo center and activation states as Discover, but adds a connector line and a visible feature label. The learner can understand what will be explored before activation.

On desktop, the label and connector remain visible when layout space permits. On compact mobile layouts, Explore collapses to the traditional Moto hotspot to avoid overlapping the product.

Activation expands the label into a compact anchored feature card. Rich media can continue into the existing discovery experience when needed.

### 3. Inspect — technical reticle

**Default lesson type:** `canvas`

Inspect presents the indigo center inside a crosshair or reticle coordinated with the canvas grid, zoom, and pan controls. Activation visually focuses the selected target and opens an inspection tray without discarding the learner's current canvas position.

The reticle uses the same visited and completion semantics as the traditional hotspot. Its difference is visual precision and canvas-aware feedback.

### 4. Connect — inline learning cue

**Default lesson types:** `content`, `splitScreen`, and `scrollStory`

Connect uses highlighted words, anchored notes, or short editorial cues instead of placing floating dots over every image. Activation expands a compact note in the reading flow or beside the relevant content.

The traditional hotspot remains available when a specific content lesson requires image discovery. Connect is the default when comprehension and conceptual association are more important than searching.

## Task-based Lessons

`dragDrop`, `colorSwitcher`, `video`, and `quiz` keep their native controls and feedback. Their learning action is already clear, so adding hotspots would create unnecessary repetition.

They remain part of the broader Moto interaction language through the same color, motion, focus, correct, visited, and completion states.

## Architecture

The existing lesson registry and player remain the system boundary.

`Hotspot.tsx` remains the shared accessible primitive and preserves its current public behavior. Existing call sites must continue to work. The presentation layer will add related expressions:

- Traditional hotspot: current `Hotspot` rendering.
- Product callout: a Stage-specific composition using the shared activation contract.
- Inspection reticle: a Canvas-specific presentation using the shared activation contract.
- Inline cue: a Portable Text mark or editorial cue component using the same discovery content contract.

Each expression consumes the same core interaction values:

- label and topic
- coordinates when relevant
- visited state
- visit callback
- open callback
- body, photos, and video
- accessible name

The lesson type selects the default expression. No new Sanity authoring field is required in the first implementation.

## Data and Progress Flow

1. Sanity returns the existing lesson and hotspot content.
2. The lesson registry identifies the lesson type.
3. The lesson renderer selects the corresponding Moto interaction family.
4. The family component renders the appropriate marker or inline cue.
5. Activation records the same visited label through the existing progress callbacks.
6. The family presents the discovery content using its lesson-appropriate surface.
7. Existing completion calculations continue to use visited and required target counts.

Stored progress keys and completion behavior must not change.

## Responsive and Accessible Behavior

- All interactive targets retain a minimum 44-pixel touch area.
- Keyboard focus, Enter, Space, Escape, and accessible labels remain supported.
- Product callouts collapse to the traditional hotspot when labels would overlap on mobile.
- Inspection reticles remain usable with touch zoom and pan.
- Inline cues use real buttons and remain understandable without color alone.
- Reduced-motion mode removes continuous pulses and spring travel while preserving state changes.
- Visited, active, correct, and incomplete states use shape or icon changes in addition to color.

## Fallbacks and Error Handling

- Missing specialized presentation data falls back to the traditional Moto hotspot.
- Missing optional rich media still shows the text discovery content.
- Invalid or absent coordinates follow the existing contract normalization and must not crash the lesson.
- A lesson with no interaction targets keeps its existing completion mode rather than rendering empty markers.
- Mobile layout collisions automatically use the compact traditional hotspot.

## Verification

No automated tests or testing files will be created.

Implementation verification will use:

- TypeScript type checking.
- ESLint.
- Formatting and diff validation.
- Live browser review of Discover, Explore, Inspect, and Connect.
- Desktop and mobile layout review.
- Keyboard navigation and focus review.
- Reduced-motion review.
- Confirmation that visited counts, completion gates, and existing Sanity content still work.

## Acceptance Criteria

- The traditional pulsing hotspot remains visually and behaviorally available.
- Interaction lessons use the traditional hotspot by default.
- Stage lessons use labeled product callouts on desktop and compact traditional hotspots on mobile.
- Canvas lessons use inspection reticles tied to canvas feedback.
- Content, Split Screen, and Scroll Story prefer inline cues instead of image hotspots.
- Task-based lessons do not gain unnecessary hotspots.
- All families share Moto visual and completion states.
- Existing Sanity hotspot content and saved progress remain compatible.
