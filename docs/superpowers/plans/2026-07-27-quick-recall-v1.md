# Quick Recall v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the low-value refresher directory with a short, reveal-based Quick Recall activity while keeping the existing authoring and progress model.

**Architecture:** Reuse each lesson's existing `coveredFeatures` label and summary as the recall prompt and answer. The player continues to persist its current visited labels and lock navigation until each configured answer has been revealed; no schema, route, database, or progress-key change is introduced.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, Lucide React, Sanity.

## Global Constraints

- Limit the change to the existing refresher surface, completion copy, and related authoring/docs copy.
- Do not add a lesson type, top-level schema field, route, dependency, database migration, or progress key.
- Do not create automated tests, test files, testing configuration, or fixtures.
- A feature completes only when its answer is revealed.
- Preserve the current shared visited-label behavior: an associated hotspot or inline Learning Cue can still satisfy the same feature label.
- Keep ordinary lessons unchanged when `coveredFeatures` is empty.
- Preserve unrelated uncommitted workspace changes and do not commit or stage the combined worktree.

---

## File Structure

- Modify `apps/web/src/player/RefresherFeaturePanel.tsx`: replace the feature directory with the collapsed, one-card-at-a-time Quick Recall interface.
- Modify `apps/web/src/player/hooks/useLessonRuntime.ts`: change the locked-navigation hint from review language to Quick Recall language.
- Modify `apps/web/src/sanity/schemaTypes/lesson/contentFields.ts`: update Studio field labels and help text without changing field names or data shape.
- Modify `README.md`: describe the authoring experience as Quick Recall instead of a device refresher.

## Task 1: Deliver the Quick Recall player interaction

**Files:**

- Modify: `apps/web/src/player/RefresherFeaturePanel.tsx`
- Modify: `apps/web/src/player/hooks/useLessonRuntime.ts`

**Interfaces:**

- Consumes: `lesson.coveredFeatures`, `visitedLabels`, and `onVisit(label)`.
- Produces: a collapsed `Quick Recall` panel that reveals each existing feature summary and marks it visited exactly when its answer is revealed.

- [x] Rename learner-facing `Refresher` labels and `Device refresher` fallback text to Quick Recall language; retain the component filename and public props.
- [x] Keep the panel collapsed initially. When opened, render the first unanswered feature label with an instruction to think before revealing the answer; do not render its summary yet.
- [x] Render a `Reveal answer` action for an unanswered feature. It calls `onVisit(feature.label)`. After that label is visited, show its summary and select the next unanswered feature. Reopening a completed feature shows its answer directly.
- [x] Do not add an `I remembered` state or new persistence. Existing visited labels remain the completion source.
- [x] Change the locked-navigation hint to `Complete Quick Recall (${visitedRefresherFeatures} / ${refresherFeatureLabels.length})`.
- [x] Run `npx prettier --write apps/web/src/player/RefresherFeaturePanel.tsx apps/web/src/player/hooks/useLessonRuntime.ts`, `npm run typecheck`, `npm run lint`, and `git diff --check`. Each exited 0; no automated test command was run.

## Task 2: Align authoring and project documentation

**Files:**

- Modify: `apps/web/src/sanity/schemaTypes/lesson/contentFields.ts`
- Modify: `README.md`

**Interfaces:**

- Consumes: existing `deviceName` and `coveredFeatures` Sanity fields.
- Produces: clear authoring language explaining that a feature label is the recall prompt and its feature review is the revealed answer.

- [x] Keep stored names `deviceName`, `coveredFeatures`, `label`, and `summary` unchanged. Update only their visible labels and descriptions to communicate Quick Recall and that learners must reveal every answer before continuing.
- [x] Replace shared refresher guidance in the README with Quick Recall guidance. Explain that a feature name becomes the prompt, its concise review becomes the answer, and empty `Covered Features` produces no activity.
- [x] Run `npx prettier --write apps/web/src/sanity/schemaTypes/lesson/contentFields.ts README.md`, `git diff --check`, and `git diff --name-only`. Formatting and whitespace checks passed; unrelated pre-existing worktree changes remain intact.

## Task 3: Verify the learner flow in the running application

**Files:** None.

**Interfaces:**

- Consumes: the running web app and an authored lesson with at least two covered features.
- Produces: evidence that the panel begins collapsed, an answer only appears after Reveal answer, and navigation unlocks after every answer is revealed.

- [x] Open a configured Content lesson and confirm the main learning content remains unobscured while Quick Recall is collapsed.
- [x] Open Quick Recall, reveal each answer, and confirm the summary and counter update for every feature.
- [x] Confirm Next remains locked until the final answer is revealed and the browser has no console errors. The browser tooling was initially unavailable through the CLI, then verified successfully through the DevTools connector.
- [x] Run `git diff --check` and `git status --short`; leave the work unstaged and report any environment-dependent verification limitation.
