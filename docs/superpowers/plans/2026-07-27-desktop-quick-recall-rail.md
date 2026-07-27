# Desktop Quick Recall Rail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Quick Recall in Content lessons into a substantial, premium desktop learning rail that supports reflection without competing with the instructional content.

**Architecture:** Keep `RefresherFeaturePanel` as the only runtime owner of recall state and existing visited-label progress. It selects a desktop rail only for `lessonType === 'content'`; all other lesson types retain their compact presentation, with no data-contract change.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, Lucide React.

## Global Constraints

- Moto AI is a learning application: design supports instructional focus, recall pacing, and feedback rather than generic UI decoration.
- Optimize the Content lesson for desktop first; smaller screens remain functional but do not drive layout decisions.
- Do not add Sanity fields, routes, dependencies, database migrations, or progress keys.
- Preserve `coveredFeatures`, visited-label persistence, and navigation-lock behavior.
- Preserve the compact Quick Recall surface for non-Content lesson types.
- Do not create automated tests, test files, testing configuration, or fixtures.
- Preserve unrelated uncommitted workspace changes and do not stage or commit the combined worktree.

---

## File Structure

- Modify `apps/web/src/player/RefresherFeaturePanel.tsx`: add the Content-lesson desktop rail while retaining the compact presentation and existing recall flow.

## Task 1: Build the Content lesson desktop learning rail

**Files:**
- Modify: `apps/web/src/player/RefresherFeaturePanel.tsx`

**Interfaces:**
- Consumes: `lesson.lessonType`, `lesson.deviceName`, `lesson.coveredFeatures`, `visitedLabels`, and `onVisit(label)`.
- Produces: an immediately visible, desktop-sized learning rail for Content lessons that preserves one-prompt reveal flow and completion behavior.

- [x] Derive `isContentLesson` from `lesson.lessonType === 'content'`. Content lessons now derive an always-open rail; other lesson types preserve collapsed state.
- [x] At `md` and above, move the Content rail to the right third of the player with top/right margins, desktop width, and no left positioning. Non-Content lessons retain compact top-left placement.
- [x] For the Content rail, use a deep indigo layered surface, generous padding, a circular progress indicator, `Pause and recall`, one large prompt, concise reflection guidance, and a prominent `Reveal answer` action.
- [x] Keep the final answer visible with completion acknowledgement. `onVisit`, progress keys, navigation locks, and `Next feature` behavior remain unchanged.
- [x] Run `npx prettier --write apps/web/src/player/RefresherFeaturePanel.tsx`, `npm run typecheck`, `npm run lint`, and `git diff --check`. Every command exited 0; no automated test command was run.

## Task 2: Verify the desktop learning flow

**Files:** None.

**Interfaces:**
- Consumes: the local web app and a Content lesson with at least two Quick Recall features.
- Produces: browser evidence that the rail is prominent at desktop dimensions and preserves the approved recall flow.

- [x] Use a clean browser context at a 1440 × 900 desktop viewport. The Atlas Content lesson shows Quick Recall as a right-side rail rather than a small upper-left utility panel.
- [x] Confirm explanatory lesson content remains readable in its own zone, the rail presents one large prompt, and Reveal answer is the clear primary action.
- [x] Reveal each answer, confirm the answer stays visible before advancing, confirm completion follows the final answer, and confirm Next unlocks only after every answer is revealed.
- [x] Confirm no browser console errors, run `git diff --check` and `git status --short`, and leave all work unstaged.
