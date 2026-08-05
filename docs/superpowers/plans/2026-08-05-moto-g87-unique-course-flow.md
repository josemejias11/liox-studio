# moto g87 Unique Course Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reshape the seeded moto g87 course into three chapters with one of each non-quiz lesson type, one authored Chapter 1 checkpoint, one final AI quiz, and one Specifications and one Disclaimer page.

**Architecture:** The authored Chapter 1 checkpoint remains a `CourseQuiz` record connected through `CourseChapter.quickCheckId`. The existing course-level `CourseQuiz` player remains the final AI recap, while the seeded graph contains only the nine non-quiz lesson types. The existing course is updated in place so Cloudflare R2 asset inventory and bytes remain untouched.

**Tech Stack:** Next.js 16, React 19, TypeScript, Prisma/PostgreSQL, Cloudflare R2, Course Studio contracts/player.

## Global Constraints

- Keep Cloudflare R2; do not upload, delete, or replace asset bytes for this restructure.
- Preserve Venice source copy as claim authority and keep the course editable, unfrozen, and unpublished.
- Use existing course-level `specifications` and `disclaimer` fields as reference pages, not lessons.
- The supported types are `content`, `interaction`, `stage`, `video`, `quiz`, `canvas`, `colorSwitcher`, `splitScreen`, `dragDrop`, and `scrollStory`.
- Use each of the nine non-quiz types once. Do not create a `quiz` lesson; assessment is one Chapter 1 `CourseQuiz` plus one course-level final AI quiz.
- Do not create or run automated tests. Use typecheck, lint, diff checks, PostgreSQL inspection, and authenticated browser evidence.
- Preserve unrelated working-tree changes.

---

## File Structure

- `apps/web/src/learning/course-flow.ts` — sequence Course Map items as lessons, Specifications, Disclaimer, final AI quiz.
- `apps/web/src/learning/player/hooks/useCourseNavigation.ts` — align forward/backward phase transitions with the Course Map sequence.
- `scripts/seed-moto-g87-course.ts` — define the simplified course graph and a deliberate, asset-preserving `--replace` mode.

### Task 1: Put the final AI quiz after the Disclaimer page

**Files:**
- Modify: `apps/web/src/learning/course-flow.ts:18-48`
- Modify: `apps/web/src/learning/player/hooks/useCourseNavigation.ts:40-110, 179-195, 245-253, 327-333`

**Interfaces:**
- Consumes: `CourseStructure.specSections`, `CourseStructure.disclaimerSection`, `CoursePhase`.
- Produces: existing `CourseFlowItem` and `CoursePhase` values in this order: lesson → specification → disclaimer → quiz.

- [ ] **Step 1: Record the baseline from Studio preview**

The current final segment is `last chapter → Specifications → Final AI quiz → Disclaimer → Complete`.

Confirm `CoursePhaseScreen` already renders `chapter-quiz` through `QuizLesson` and `quiz` through `CourseQuiz`. No new quiz renderer is needed.

- [ ] **Step 2: Reorder Course Map metadata**

Move the final AI quiz entry after the optional disclaimer entry in `deriveCourseFlow`:

```ts
for (const specification of structure.specSections) addSpecification(specification);
if (structure.disclaimerSection) addDisclaimer(structure.disclaimerSection);
items.push({ kind: 'quiz', key: 'quiz', index: items.length, title: 'Knowledge Check' });
```

Keep the `CourseFlowItem` union unchanged.

- [ ] **Step 3: Align navigation transitions**

Change only `postChapterPhase`, final `specifications` handling, `disclaimer` handling, `phaseBeforeQuiz`, `phaseBeforeDisclaimer`, `complete` Back handling, and `QUIZ_DONE` so the sequence is `last chapter → specification when present → disclaimer when present → AI quiz → complete`. The existing Chapter 1 `CHAPTER_QUIZ_DONE` behavior must still advance to Chapter 2.

- [ ] **Step 4: Verify this task**

Run `npm run typecheck`, `npm run lint`, and `git diff --check`. In authenticated Studio preview, verify forward and Back navigation through Specifications, Disclaimer acknowledgement, final AI quiz preview, and Complete. Preview must not generate or grade an AI quiz.

- [ ] **Step 5: Commit**

Run `git add apps/web/src/learning/course-flow.ts apps/web/src/learning/player/hooks/useCourseNavigation.ts` and `git commit -m "feat: place final ai quiz after disclaimer"`.

### Task 2: Define the approved unique-type course graph

**Files:**
- Modify: `scripts/seed-moto-g87-course.ts:73-86, 369-650, 655-709`

**Interfaces:**
- Consumes: existing `assetRef`, `feature`, `hotspot`, `authoredQuestion`, `CourseLessonType`, and the current assets map.
- Produces: exactly three `ChapterDefinition` values, one Chapter 1 `CourseQuiz`, one Specification object, and one Disclaimer object.

- [ ] **Step 1: Make chapter checkpoints optional**

Replace the always-required quick-check fields with `quickCheck?: { title: string; instructions: string; payload: Prisma.InputJsonObject }`. Keep `cameraQuiz` as the only authored checkpoint. Remove the unused everyday and recommendation quiz constants.

- [ ] **Step 2: Replace lesson arrays with the approved sequence**

Use exactly this order while retaining the relevant existing payloads and supplied assets:

```text
Chapter 1: content, stage, interaction, splitScreen; authored checkpoint
Chapter 2: scrollStory, canvas, dragDrop
Chapter 3: colorSwitcher, video
```

Remove every `lessonType: 'quiz'` row and every duplicate non-quiz row. The existing global `phase: 'quiz'` is the sole final AI recap.

- [ ] **Step 3: Produce one Specifications page and one Disclaimer page**

Replace the two specification objects with one `spec-moto-g87` object containing Camera, Battery and charging, Display and platform, and Protection and connectivity groups. Retain one acknowledgement-required legal Disclaimer with the existing LATAM availability, battery, IP64, and NFC limits.

- [ ] **Step 4: Add pre-write structural validation**

Invoke this before database or R2 work:

```ts
function assertMotoG87Structure(chapters: ChapterDefinition[]) {
  const types = chapters.flatMap((chapter) => chapter.lessons.map((lesson) => lesson.lessonType));
  if (chapters.length !== 3 || types.length !== 9 || new Set(types).size !== 9) {
    throw new Error('Expected three chapters and each non-quiz type exactly once');
  }
  if (!chapters[0]?.quickCheck || chapters.slice(1).some((chapter) => chapter.quickCheck)) {
    throw new Error('Expected only Chapter 1 to have an authored checkpoint');
  }
}
```

Compare `types` to the approved ordered list as well, so a future edit cannot silently reorder the learner flow.

- [ ] **Step 5: Verify and commit**

Run `npm run typecheck`, `npm run lint`, and `git diff --check`; inspect that chapter counts are `4`, `3`, `2`, only Chapter 1 declares `quickCheck`, and one specification plus one disclaimer object exist. Then run `git add scripts/seed-moto-g87-course.ts` and `git commit -m "feat: simplify moto g87 course flow"`.

### Task 3: Add a targeted asset-preserving reseed mode

**Files:**
- Modify: `scripts/seed-moto-g87-course.ts:180-250, 710-820`

**Interfaces:**
- Consumes: the exact `COURSE_SLUG`, existing `CourseAsset` records, and `chapterDefinitions`.
- Produces: `npx tsx scripts/seed-moto-g87-course.ts --replace`, which replaces only the moto g87 database graph and reuses its existing R2 references.

- [ ] **Step 1: Parse only deliberate modes**

Accept exactly `tsx scripts/seed-moto-g87-course.ts`, `tsx scripts/seed-moto-g87-course.ts --sources`, and `tsx scripts/seed-moto-g87-course.ts --replace`. Plain execution stays non-destructive: it prints the current Studio URL if the slug exists. `--replace` is required to alter it.

- [ ] **Step 2: Resolve existing inventory without Cloudflare calls**

Load records by the exact `assetSources` filenames and require one record per asset before writing:

```ts
const records = await prisma.courseAsset.findMany({ where: { filename: { in: filenames } } });
if (records.length !== filenames.length) {
  throw new Error('Cannot replace course without its existing asset inventory');
}
```

Do not call `uploadAssets`, `putCourseAsset`, or `deleteCourseAsset` in this mode.

- [ ] **Step 3: Replace only the target graph in one transaction**

Use the existing course ID and, in order, delete target `CourseLessonTrash` rows, delete target `CourseChapter` rows (lessons cascade), delete target `CourseQuiz` rows, update target Course settings/reference pages, and create the three chapters plus only the Chapter 1 `CourseQuiz`. Never delete the Course row, `CourseAsset` records, R2 objects, source files, revisions, or any course with another slug.

- [ ] **Step 4: Execute and inspect persisted data**

With PostgreSQL running, execute `npx tsx scripts/seed-moto-g87-course.ts --replace`. Inspect the printed course ID through Prisma and confirm positions `0,1,2`, counts `4,3,2`, only Chapter 1 has `quickCheckId`, exactly one `CourseQuiz` belongs to the course, and existing delivery URLs remain unchanged.

- [ ] **Step 5: Commit**

Run `git add scripts/seed-moto-g87-course.ts` and `git commit -m "feat: add asset-preserving moto g87 reseed"`.

### Task 4: Browser evidence and handoff

**Files:**
- Modify: none unless verification identifies a root-cause fix.

**Interfaces:**
- Consumes: the printed `/studio/<courseId>` URL and existing Studio authentication.
- Produces: browser evidence for the approved outline and final sequence.

- [ ] **Step 1: Run final static checks**

Run `npm run typecheck`, `npm run lint`, `git diff --check`, and `git status --short`. Record actual exits; do not create or run automated tests.

- [ ] **Step 2: Verify Studio outline**

Confirm exactly `Chapter 1: 4 lessons + authored checkpoint`, `Chapter 2: 3 lessons + no checkpoint`, and `Chapter 3: 2 lessons + no checkpoint`. Confirm the authoring type chooser remains unrestricted; uniqueness is seed data only.

- [ ] **Step 3: Verify learner sequence**

Complete the Canvas targets and advance through `single Specifications page → Disclaimer acknowledgement → final AI quiz preview → Complete`. Confirm the authored Chapter 1 quiz reveals answers. Confirm the final AI preview says it is unavailable in preview and does not issue generation or grading requests.

- [ ] **Step 4: Commit only a verified corrective change if necessary**

If verification required a source change, rerun static checks and commit only its responsible files. Otherwise create no extra commit.

## Plan Self-Review

- Spec coverage: the plan covers three chapters, nine unique non-quiz types, one authored Chapter 1 assessment, the final-only AI assessment, one Specifications page, one Disclaimer page, R2 retention, and browser evidence.
- Placeholder scan: no unfinished markers or unspecified implementation steps remain.
- Type consistency: `CourseQuiz` is the authored chapter checkpoint; `CoursePhase` `quiz` remains the final AI quiz; no lesson type or Prisma migration is added.
