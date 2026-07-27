# Course Studio Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish Course Studio’s first internal workflow in embedded Sanity Studio: Lionbridge can freeze an English course into a traceable localization release with a stable inventory of all translatable e-learning text.

**Architecture:** Existing Sanity Course, Chapter, Lesson, and Quiz documents remain the English authoring source. A new `courseLocaleRelease` document records one target-locale handoff, its lifecycle status, the exact source revision, and a structured snapshot of stable localization units. A custom Studio input on the Course document creates and displays those releases; it does not alter learner routes.

**Tech Stack:** Next.js 16, React 19, TypeScript, Sanity Studio 5, GROQ, Zod, embedded Studio at `/studio`.

## Global Constraints

- Course Studio is Lionbridge-only and lives in the existing embedded Sanity Studio. Create no separate dashboard, login system, Motorola account, or agency account.
- Preserve existing Course, Chapter, Lesson, Quiz, learner routes, progress keys, and player behavior.
- Handle e-learning only. Do not add PPTX, print, PDF, or general asset-management workflows.
- The first release snapshot contains text and metadata only. Binary-media package export/import is a later plan.
- Do not create or run automated tests. Verify only with `npm run typecheck`, `npm run lint`, `git diff --check`, and desktop Chrome at exactly 1440x900.
- Do not start Ollama or make AI API calls.
- Use Course Studio in new Studio-facing copy. Existing learner-facing Moto Tutor copy is out of scope.

---

## File structure

| File | Responsibility |
| --- | --- |
| `apps/web/src/sanity/schemaTypes/courseLocaleRelease.ts` | Defines one locale release, lifecycle state, source revision, and frozen text-unit snapshot. |
| `apps/web/src/sanity/lib/localization-query.ts` | Provides the resolved English source query used only to freeze a localization release. |
| `apps/web/src/sanity/lib/localization-inventory.ts` | Converts a resolved source course into stable localization units and deterministic fingerprint. |
| `apps/web/src/sanity/components/CourseLocalizationInput.tsx` | Embedded Course Studio panel for creating and viewing locale releases. |
| `apps/web/src/sanity/schemaTypes/course.ts` | Adds source-locale metadata and the Course Studio release panel. |
| `apps/web/src/sanity/schemaTypes/index.ts` | Registers the new document type. |
| `apps/web/src/sanity/structure.ts` | Adds Course Studio navigation for all locale releases. |

## Explicit follow-up plans

1. Export the snapshot as XLIFF plus a media manifest.
2. Import and validate agency-returned localized packages.
3. Resolve an approved locale in the learner player and build the Insiders publishing adapter.
4. Add Production AI and optional learner-AI grounding to approved locale content.

### Task 1: Add the Course Studio release schema

**Files:**

- Create: `apps/web/src/sanity/schemaTypes/courseLocaleRelease.ts`
- Modify: `apps/web/src/sanity/schemaTypes/index.ts`
- Modify: `apps/web/src/sanity/schemaTypes/course.ts`

**Interfaces:**

- Consumes: existing `course` documents and Sanity `_rev`.
- Produces: `courseLocaleRelease` documents and `course.sourceLocale` metadata.

- [ ] **Step 1: Define exact release statuses and exported type**

Create these exports:

```ts
export const COURSE_LOCALE_RELEASE_STATUSES = [
  'draft',
  'readyForExport',
  'exported',
  'returned',
  'qa',
  'approved',
  'published',
  'archived',
  'outdated',
] as const;

export type CourseLocaleReleaseStatus =
  (typeof COURSE_LOCALE_RELEASE_STATUSES)[number];
```

- [ ] **Step 2: Define the `courseLocaleRelease` document**

The document must include:

```ts
masterCourse: reference to 'course' // required
locale: string                      // required, /^[a-z]{2,3}(-[A-Z]{2})?$/
status: string                      // required, default 'draft'
sourceRevision: string              // required, read-only
sourceFingerprint: string           // required, read-only
sourceTitle: string                 // required, read-only
unitCount: number                   // required, read-only
localizationUnits: array            // required, read-only
notes: text                         // optional
exportedAt: datetime                // read-only
returnedAt: datetime                // read-only
approvedAt: datetime                // read-only
```

Each `localizationUnit` is an object with `unitId`, `sourceText`, `kind` (`plainText` or `portableTextSpan`), and `context`. Set preview to source title + locale, with status and unit count as subtitle.

- [ ] **Step 3: Register the type and add Course metadata**

Register `courseLocaleReleaseType` directly after `courseType` in `schemaTypes/index.ts`.

Add a `Course Studio` group in `course.ts` with:

```ts
sourceLocale: string // required, initialValue 'en-US'
localizationReleases: reference[] // to courseLocaleRelease
```

Set the `localizationReleases` input component to `CourseLocalizationInput`. Its description is exactly: `Lionbridge-only release tracking. Agencies receive exported packages; they do not access Course Studio.`

- [ ] **Step 4: Verify the schema boundary**

Run:

```bash
npm run typecheck
npm run lint
git diff --check
```

Expected: all commands exit successfully. Do not run tests or Ollama.

### Task 2: Build the stable English text inventory

**Files:**

- Create: `apps/web/src/sanity/lib/localization-query.ts`
- Create: `apps/web/src/sanity/lib/localization-inventory.ts`

**Interfaces:**

- Consumes: `COURSE_LOCALIZATION_SOURCE_QUERY` result.
- Produces: `buildLocalizationInventory(source): LocalizationInventory`.

- [ ] **Step 1: Query only authoring content required for localization**

Create `COURSE_LOCALIZATION_SOURCE_QUERY`, parameterized by `$courseId`. It must resolve:

```text
course: _id, _rev, title, description, learningObjectives, coverHeadline, coverButtonText
chapters[]->: _id, title, lessons[]->
lessons: _id, headline, body, deviceName, coveredFeatures(label, summary), hotspots(label, topic, body)
quickCheck->: _id, title, instructions, questions(questionText, answers(text))
```

Do not fetch image, video, or file binaries.

- [ ] **Step 2: Define the inventory contract**

Export:

```ts
export type LocalizationUnitKind = 'plainText' | 'portableTextSpan';

export interface LocalizationUnit {
  unitId: string;
  sourceText: string;
  kind: LocalizationUnitKind;
  context: string;
}

export interface LocalizationInventory {
  sourceCourseId: string;
  sourceRevision: string;
  sourceTitle: string;
  units: LocalizationUnit[];
  fingerprint: string;
}

export function buildLocalizationInventory(
  source: CourseLocalizationSource,
): LocalizationInventory;
```

Keep `CourseLocalizationSource` local to this module; do not widen current browser-facing course contracts.

- [ ] **Step 3: Extract every current e-learning text field using stable paths**

Extract non-empty text in source order from Course title, description, objectives, cover headline/button; Chapter title; Lesson headline, device name, body spans, covered-feature label/summary, hotspot label/topic/body spans; and Quick Check title, instructions, questions, and answers.

Use source-document IDs plus exact field paths. Examples:

```text
courseId:title
lessonId:body[blockKey].children[spanKey].text
lessonId:hotspots[hotspotKey].label
quizId:questions[questionKey].answers[answerKey].text
```

For Portable Text, create one `portableTextSpan` unit per non-empty text child. Preserve block and span keys in `unitId`, skip non-text children, and never use display labels as identifiers.

Set reviewer context as human-readable paths, for example `Chapter: Introduction / Lesson: Welcome / Body`.

- [ ] **Step 4: Make the fingerprint deterministic**

Create a browser-safe SHA-256 helper using `crypto.subtle.digest`. Hash the ordered array of `{ unitId, sourceText, kind }` encoded with `TextEncoder`, returning lowercase hexadecimal. Context changes alone must not change the fingerprint.

- [ ] **Step 5: Run permitted static verification**

Run:

```bash
npm run typecheck
npm run lint
git diff --check
```

Expected: all commands exit successfully; no tests are created or run.

### Task 3: Create locale releases from the Course document

**Files:**

- Create: `apps/web/src/sanity/components/CourseLocalizationInput.tsx`
- Modify: `apps/web/src/sanity/schemaTypes/course.ts`

**Interfaces:**

- Consumes: `COURSE_LOCALIZATION_SOURCE_QUERY`, `buildLocalizationInventory`, and the Studio field patch API.
- Produces: a draft `courseLocaleRelease` linked to the current English Course.

- [ ] **Step 1: Require a persisted English Course**

Use `useFormValue([])` to read the Course document, normalize its ID by stripping `drafts.`, and use `useClient({ apiVersion: '2025-07-27' })`.

When the Course has no persisted ID, disable release creation and show exactly:

```text
Publish this Course once before creating a localization release.
```

- [ ] **Step 2: Create one release per locale and source revision**

Render a target-locale input plus `Create localization release`.

On submit:

1. Validate the locale with `/^[a-z]{2,3}(-[A-Z]{2})?$/`.
2. Fetch the resolved source and build its inventory.
3. Query for an existing release with the same master Course ID, locale, and source revision.
4. If found, show `A release for this locale and source revision already exists.`
5. Otherwise create the `courseLocaleRelease` document with status `draft`, its exact source revision, title, fingerprint, unit count, and inventory units.
6. Append its reference to the Course field through `PatchEvent.from(setIfMissing([]), insert([reference], 'after', [-1]))`.

Do not create a translated Course, change learner content, or call AI.

- [ ] **Step 3: Display the release index**

List releases newest first with locale, status, first 12 characters of source revision, unit count, and a link to the release document.

Use these labels:

```text
Draft → Ready for export → Exported → Returned → Lionbridge QA → Approved → Published → Archived
```

For `outdated`, show `Outdated — English master changed`.

Do not add export, import, approval, or publish controls in this task.

- [ ] **Step 4: Verify the internal Studio workflow at 1440x900**

At `/studio` in desktop Chrome exactly 1440x900:

1. Confirm the Course Studio group exposes source locale and the release panel.
2. Confirm an invalid locale cannot create a release.
3. Confirm a valid locale creates one draft release with non-zero unit count and a source revision.
4. Confirm a duplicate locale/source revision is blocked.
5. Confirm existing lesson authoring and the learner route remain usable.

Do not reset Course content, progress, or Studio data to create test conditions.

### Task 4: Add Course Studio navigation and finish the foundation acceptance pass

**Files:**

- Modify: `apps/web/src/sanity/structure.ts`
- Modify only if acceptance identifies a direct defect in Task 1–3 files.

**Interfaces:**

- Consumes: `courseLocaleRelease` documents.
- Produces: a dedicated Studio entry for Lionbridge to find all localization releases.

- [ ] **Step 1: Add navigation**

Add a top-level Studio item titled `Course Studio` with subtitle `Localization releases`. It opens a document list filtered by:

```groq
_type == \"courseLocaleRelease\"
```

Order the list by `_createdAt desc`. Preserve all current Studio navigation entries.

- [ ] **Step 2: Verify learner-route isolation**

Confirm `COURSES_QUERY` and `COURSE_BY_SLUG_QUERY` do not include locale releases. The new workflow must not appear in public learner responses.

- [ ] **Step 3: Run final permitted checks**

Run:

```bash
npm run typecheck
npm run lint
git diff --check
```

Expected: successful with no diagnostics.

- [ ] **Step 4: Record desktop acceptance evidence**

At exactly 1440x900, confirm:

1. Course Studio navigation opens the locale-release list.
2. A locale release displays source title, locale, status, source revision, fingerprint, and text-unit snapshot.
3. Existing Course and Lesson authoring remain usable.
4. The learner course route renders the existing English source unchanged.

Record any inability to safely create a draft release without altering existing content as a blocker. Do not create fake lesson data or reset learner progress.

## Plan self-review

- **Spec coverage:** Tasks 1–4 implement embedded-Sanity access, Lionbridge-only ownership, English-master freezing, locale release lifecycle foundation, stable text inventory, and external-agency handoff preparation. Package export/import, locale playback, publishing, and AI are explicitly decomposed follow-up plans.
- **Placeholder scan:** No task contains TBD/TODO language or an unspecified validation path.
- **Type consistency:** `LocalizationUnit`, `LocalizationInventory`, `COURSE_LOCALIZATION_SOURCE_QUERY`, and `courseLocaleRelease` are defined before later tasks consume them.
