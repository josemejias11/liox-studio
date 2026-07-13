# Refresher Lesson Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every existing lesson type a common device-and-feature refresher experience with required topic completion.

**Architecture:** Add optional lesson-level `deviceName` and `coveredFeatures` metadata. A shared overlay introduces the device, opens feature recap cards, records visits, and uses the existing navigation/progress path to lock Next until every feature is opened. Existing specialized renderers remain responsible for their own media and interactions.

**Tech Stack:** Next.js, React, Sanity Studio, Zod, Vitest, Tailwind CSS.

### Task 1: Add refresher lesson metadata and completion helpers

**Files:** `src/lib/refresher.ts`, `src/lib/refresher.test.ts`, `src/lib/contracts/sanity.ts`, `src/sanity/lib/queries.ts`, `src/sanity/schemaTypes/lesson.ts`

- [x] Write failing tests for `getCoveredFeatureLabels()` and `isRefresherComplete()`.
- [x] Add optional `deviceName` and `coveredFeatures[] { _key, label, summary }` to the contract, GROQ, and Studio schema.
- [x] Implement completion only when at least one covered feature exists, so legacy content remains usable.
- [x] Run focused tests to GREEN.

### Task 2: Add shared learner refresher overlay

**Files:** `src/player/RefresherFeaturePanel.tsx`, `src/player/LessonRenderer.tsx`

- [x] Render device and feature count at lesson entry.
- [x] Open feature recap cards, call the existing visit callback, and visually mark opened features.
- [x] Keep the overlay absent when a lesson has no refresher metadata.

### Task 3: Enforce refresher completion in navigation and progress

**Files:** `src/player/hooks/useCourseNavigation.ts`, `src/player/hooks/useCourseNavigation.test.ts`, `src/player/MotoViewer.tsx`

- [x] Make covered-feature completion override type-specific locking when metadata exists.
- [x] Persist completion using the existing lesson-progress callback.
- [x] Display `Review every feature (visited / total)` in the player frame.

### Task 4: Verify and document

- [x] Run `npm test`, targeted ESLint, and `npm run typecheck`.
- [x] Update README author guidance for the shared refresher fields.
