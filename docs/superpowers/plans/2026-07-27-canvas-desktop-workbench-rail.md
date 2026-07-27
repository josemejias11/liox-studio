# Canvas Desktop Workbench Rail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep Canvas controls, hotspots, and the inspection panel aligned in a desktop product-learning workspace.

**Architecture:** Canvas owns the desktop workspace boundary: when a target is open, it reserves a fixed right rail and constrains the product image, header, controls, and hotspots to the remaining stage. `DiscoveryPanel` receives a Canvas-only workbench placement option, so its existing learning content and close behavior remain intact without covering the stage.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Next.js.

## Global Constraints

- Desktop is the design baseline; verify at 1440x900.
- Preserve authored Canvas targets, progress labels, completion rules, and shared discovery content.
- Do not create or run automated tests; use typecheck, lint, diff validation, and the live desktop Canvas flow.
- Do not start Ollama.

---

### Task 1: Reserve the Canvas inspection rail

**Files:**
- Modify: `apps/web/src/player/lesson-types/CanvasInspectionLesson.tsx`
- Modify: `apps/web/src/components/DiscoveryPanel.tsx`

**Interfaces:**
- Consumes: `activeTarget` from `CanvasInspectionLesson` and existing `DiscoveryPanel` sidebar content props.
- Produces: a Canvas-only workbench sidebar placement that does not cover the canvas stage, its controls, or the lesson navigation.

- [ ] **Step 1: Constrain the Canvas stage when a target is active**

Wrap the Canvas header and interactive image in a positioned stage whose right edge transitions to `min(27rem, 33vw)` only while `activeTarget` is non-null. Keep the stage full width while no target is open.

- [ ] **Step 2: Add a Canvas workbench placement to DiscoveryPanel**

Add a narrowly scoped sidebar placement option. Its open state sits at `top-6 right-6 bottom-24`, has a width of `min(27rem, 33vw)`, rounded corners, and receives pointer events without blocking the remaining Canvas stage.

- [ ] **Step 3: Apply the workbench placement from Canvas**

Pass the new placement option along with the existing no-dimmer setting. Keep the existing default sidebar behavior unchanged for all non-Canvas consumers.

- [ ] **Step 4: Verify the learner flow**

Run `npm run typecheck`, `npm run lint`, and `git diff --check`. At 1440x900, open a Canvas target and confirm the image workspace, zoom controls, reticles, inspection panel, and bottom navigation occupy distinct regions; confirm another reticle can still open while the rail is visible.
