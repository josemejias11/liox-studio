# Course Studio Authoring Parity and Templates Design

**Status:** Approved in conversation on 2026-08-22

## Context

The moto g87 course proves that Moto Player can deliver nine visual lesson
families, a chapter knowledge check, a final assessment, specifications,
disclaimer acknowledgement, grounded Course Assistant content, and SCORM
delivery. However, `scripts/seed-moto-g87-course.ts` writes some structures
directly to PostgreSQL that Course Studio cannot currently create through its
guided controls.

Course Studio can author most of the demo's visual lesson payloads, but it
cannot create or edit the dedicated `CourseQuiz` records used for chapter
checks and final assessments. Its lesson picker also advertises an inline Quiz
screen whose player implementation is only a Continue placeholder. Product
Stage can render separate foreground and background images, while its editor
exposes only the background.

The product also needs two distinct creation workflows:

1. create a new course from a neutral, comprehensive template; and
2. duplicate a selected existing course exactly enough to continue authoring
   it independently.

The moto g87 course remains a finished demo and reference course. It is not a
template, master course, or implicit source for new-course media.

## Goals

- Make every learner-facing capability used by the moto g87 demo authorable
  through Course Studio, except an inline quiz lesson.
- Add guided chapter knowledge-check and final-assessment authoring backed by
  the existing `CourseQuiz` model.
- Keep answer keys server-side in learner and review delivery.
- Add the missing Product Stage foreground-media control.
- Add a curated, versioned, product-neutral comprehensive template containing
  placeholders rather than moto g87 content or assets.
- Add exact course duplication as a separate workflow that copies the selected
  course, not the generic template.
- Preserve immutable source grounding and approved Q&A when duplicating a
  course without invoking the parser or OpenAI.
- Deep-copy duplicated media into the destination course namespace so editing
  or deletion cannot affect the source course.
- Prevent unresolved template placeholders and unsupported inline quiz lessons
  from entering a frozen revision, review, or SCORM package.
- Preserve existing courses and frozen revisions without rewriting them.

## Non-goals

- Moto g87 is not converted into a template.
- Template creation does not copy moto g87 media, source documents, citations,
  Q&A, product copy, or storage identifiers.
- Authors cannot promote arbitrary courses into curated templates in this
  release.
- Multiple-answer assessment grading is not implemented.
- The inline Quiz lesson is not made functional in this release.
- Duplication does not copy revisions, review links, review feedback, learner
  sessions, progress, quiz attempts, analytics, jobs, generations, or SCORM
  exports.
- No raw JSON escape hatch is added to Course Studio.
- No new automated test or unit-test files are added; verification follows the
  repository's static, migration, build, direct-database, and browser workflow.

## Product principles

1. A player capability is either guided and authorable or explicitly marked as
   unsupported. The UI must not advertise placeholder behavior as complete.
2. Assessments are structural learning moments. Chapter checks belong to a
   chapter and the final assessment belongs to the course; neither is disguised
   as an ordinary lesson.
3. Templates supply structure and guidance, not customer or product content.
4. Duplication copies a selected course; template creation instantiates a
   generic blueprint. The two operations must remain visibly and technically
   separate.
5. Existing advanced payload values should be preserved when an editor does not
   own them, but preservation is not a substitute for creation controls.
6. Frozen revisions remain immutable delivery inputs.

## Architecture

### 1. Versioned generic template catalog

`packages/contracts` owns a `CourseTemplateDefinition` schema. A definition
contains:

- stable `key` and positive integer `version`;
- library label and description;
- initial course settings;
- chapters and lessons with stable definition keys;
- optional chapter quick checks and final assessment;
- a readiness checklist describing required replacement copy and media; and
- no database IDs, storage URLs, source IDs, citations, or product-specific
  data.

`apps/web/src/authoring/templates` owns the curated catalog and its first entry,
`comprehensive-course.v1`. This template provides neutral draft guidance for
all nine supported visual lesson types:

- content;
- interaction/hotspot;
- Product Stage;
- video;
- canvas inspection;
- colour switcher;
- split screen;
- drag and drop; and
- scroll story.

It also includes at least one chapter knowledge check, a final assessment,
placeholder specifications, and a placeholder disclaimer. It contains empty
media slots rather than borrowed demo media.

Template definitions are parsed with the shared schema before they are listed
or persisted. Invalid built-in definitions are configuration errors and cannot
create partial courses.

### 2. Template creation service

The Course Studio server owns the catalog lookup and passes a validated
definition to a database creation command. The database command creates fresh
IDs for the course, chapters, lessons, and quizzes in one transaction.

The `Course` model gains additive optional fields:

- `createdFromTemplateKey String?`;
- `createdFromTemplateVersion Int?`; and
- `templateChecklist Json?`.

`templateChecklist` is a concrete, versioned snapshot created during
instantiation. Each requirement identifies its destination entity ID, field,
human-readable label, and readiness rule. It does not depend on loading a later
version of the built-in template. Rules cover:

- a value that must differ from its initial placeholder fingerprint;
- a required media reference;
- a minimum collection size; and
- assessment validity.

The checklist is evaluated from current course data rather than manually
marked complete. Editing a field therefore cannot leave stale completion
state.

Courses created before this feature have no checklist and are evaluated only
by the general readiness rules.

### 3. Assessment authoring

The existing `CourseQuiz` model remains the source of truth because grading
receives stable quiz IDs and answer keys must remain server-side. New database
commands provide:

- `upsertChapterQuickCheck(courseId, chapterId, input)`;
- `removeChapterQuickCheck(courseId, chapterId)`;
- `upsertFinalAssessment(courseId, input)`; and
- `removeFinalAssessment(courseId)`.

Every mutation verifies that the target chapter belongs to the authenticated
course and runs relationship assignment plus quiz creation/update/deletion in
one transaction. Removal clears the relationship before deleting the orphaned
quiz record.

The shared assessment input supports:

- title;
- instructions;
- passing score from 0 through 100;
- retry and answer-reveal settings;
- one or more questions;
- an optional image per question;
- at least two answers per question;
- exactly one correct answer; and
- optional answer feedback or question explanation.

Only single-answer questions are authorable. True/false is a two-answer
single-choice question. Multiple-answer choices are not shown or accepted.

The player continues receiving answers without `isCorrect` for learner and
review payloads. Author preview uses the existing controlled answer-key
projection. Runtime grading continues reading the answer key from
`CourseQuiz.payload`.

### 4. Product Stage parity

Product Stage keeps the existing payload shape:

- `media` is the foreground product image; and
- `stageBackground` is the backdrop.

The Stage inspector exposes both fields with unambiguous labels. The lesson
draft and serializer treat both as owned Stage fields while continuing to
merge unrelated payload metadata. Existing moto g87 values load directly and
require no migration.

### 5. Exact course duplication

Duplication is a durable background job because a course may reference many
large media objects. It is distinct from template creation.

`packages/contracts/jobs` gains `course_duplicate` payload, artifact, and result
schemas. `packages/jobs` gains an enqueue command, and the job worker registers
the handler explicitly.

At request time the web server captures an immutable artifact containing:

- the current editable `CourseGraph`, including quick checks and final
  assessment;
- approved `CourseAssistantQa` items and citations;
- every owned and inherited source ID required by those citations;
- every nested course-asset URL;
- the requested destination title and slug base; and
- a SHA-256 hash of the captured content.

The artifact prevents edits made after the click from changing the queued
copy. It contains references, not media bytes.

The worker uses a deterministic destination course ID derived from the job ID
and deterministic destination asset keys derived from the source asset key.
Retries therefore address the same course and storage objects.

For each referenced media object, the worker:

1. validates that the URL resolves to a course-asset key;
2. reads the source bytes and metadata;
3. writes the bytes under `courses/<destinationCourseId>/...`;
4. records a destination `CourseAsset` inventory row; and
5. rewrites every occurrence of the source URL in the captured graph and Q&A
   payloads.

After media copying, one database transaction creates:

- the destination course with a unique title and slug;
- independent chapter and lesson records;
- independent chapter quick checks and final assessment;
- immutable `CourseSourceBinding` rows for the captured source identities; and
- copied approved Q&A whose citations still address the bound immutable source
  identities.

The destination does not own copied source bytes and does not re-index them.
The parser service and OpenAI are not used by duplication.

The `Course` model gains optional provenance fields:

- `creationJobId String? @unique`; and
- `duplicatedFromCourseId String?`.

`duplicatedFromCourseId` is durable provenance rather than a cascading
self-relation; deleting the source course must not delete the duplicate.
`creationJobId` makes successful retry recovery idempotent.

The worker records `{ courseId }` as its public result only after the
destination transaction commits.

## Author-facing workflow

### Start a course

The Course Studio library presents two explicit choices:

1. **Blank course** uses the existing minimal course creation behavior.
2. **Comprehensive course** creates the neutral curated template.

The template card describes the included interaction and assessment coverage.
It never displays moto g87 as its source.

### Course outline and assessments

The outline represents assessments as structural rows:

```text
Course settings
Course cover
Chapter 1
  Lessons
  Chapter knowledge check
Chapter 2
  Lessons
Final assessment
```

Selecting a knowledge check or final assessment opens one shared guided
assessment editor. Authors may create, edit, reorder, or remove questions and
answers and may remove the whole assessment after confirmation.

The inline Quiz option is removed from the lesson picker. Existing inline quiz
lessons remain visible and preserved, but their inspector shows an unsupported
read-only notice rather than misleading editable assessment controls.

### Duplicate a course

Each course card offers **Duplicate course**. After the author confirms a new
title, the library queues duplication, displays its status, and opens the new
course when the worker succeeds. A failed job remains visible with an
actionable message and retry guidance. The source course is never mutated.

## Readiness validation

A shared authoring-readiness service evaluates the editable graph before:

- freezing a master revision;
- creating a review link; and
- requesting SCORM export.

The service combines general validity with the course's template checklist.
General validity includes:

- supported lesson types;
- required media for media-dependent interactions;
- internally consistent drag/drop mappings;
- valid hotspot positions and cue targets;
- complete chapter and final assessments;
- exactly one correct answer per question; and
- absence of unsupported inline quiz lessons.

Failures use human-readable paths, for example:

```text
Chapter 2 -> Product Stage -> Product image is required
Chapter 3 -> Knowledge check -> Question 2 has no correct answer
Course cover -> Replace the template headline
```

Draft saving and preview remain available while a course is incomplete. The
delivery actions are blocked until readiness succeeds.

Review creation and SCORM export validate the frozen revision they consume in
addition to the live-course freeze gate. This prevents direct API use from
bypassing readiness.

## API surfaces

All new APIs remain under the authenticated `/api/course-studio` boundary.

- `POST /api/course-studio/templates/[templateKey]/courses` creates a course
  from the selected built-in template version.
- `PUT /api/course-studio/courses/[courseId]/final-assessment` creates or
  replaces the final assessment.
- `DELETE /api/course-studio/courses/[courseId]/final-assessment` removes it.
- `PUT /api/course-studio/courses/[courseId]/chapters/[chapterId]/quick-check`
  creates or replaces a chapter check.
- `DELETE /api/course-studio/courses/[courseId]/chapters/[chapterId]/quick-check`
  removes it.
- `POST /api/course-studio/courses/[courseId]/duplicate` captures and queues an
  exact copy.

The existing job-status surface reports duplication state. Every mutation
re-checks Course Studio authorization and course/chapter ownership server-side.

Validation failures return stable error codes and field paths suitable for the
guided editors. Internal storage paths, source bytes, answer keys, and stack
traces are never returned.

## Failure handling and recovery

### Template creation

- An unknown or invalid template key returns a configuration error.
- Template persistence is one database transaction, so no partial course is
  visible.
- A slug collision is resolved deterministically with the repository's normal
  unique-suffix behavior.

### Assessment mutation

- Invalid fields return structured errors without writing the quiz.
- A chapter outside the course returns not found.
- Removing an absent assessment is idempotent.

### Duplication

- A missing or malformed source asset is a non-retryable, actionable failure.
- A transient storage or database error uses the existing job retry policy.
- Deterministic destination keys make repeated writes safe.
- If media copying fails before the database transaction, copied destination
  objects are cleaned up or reused by retry.
- If the transaction fails, no destination course is visible; destination
  objects are cleaned up after the final failed attempt.
- If the transaction committed but job completion was interrupted, the worker
  finds the course by `creationJobId` and returns it instead of creating another
  copy.
- The source course, source media, and source bindings are never modified.

## Migration and backward compatibility

The Prisma migration is additive. It adds optional template and duplication
provenance fields and the duplication job kind. It does not rewrite course JSON
or existing relationships.

- Existing moto g87 quick checks and final assessment become editable through
  the new structural controls.
- Existing Product Stage foreground media appears in the new field.
- Existing inline quiz lessons remain stored and readable but block new frozen
  revisions until removed.
- Existing frozen revisions, reviews, progress, and exports remain unchanged.
- The moto g87 seed remains a demo maintenance utility and is never invoked by
  template creation.

Release order is database migration, compatible worker, then web application.
This prevents the web app from queueing duplication jobs before a registered
handler exists.

## Verification and acceptance

The project does not add or run automated tests for this work. Fresh observed
evidence must include:

```bash
npm run db:generate
npm run db:migrate
npm run typecheck
npm run lint
npm run build
git diff --check
npm run build --workspace=@moto-ai/scorm-export
```

Authenticated browser and direct database acceptance must demonstrate:

1. Blank-course creation remains functional.
2. Comprehensive template creation produces no moto g87 names, URLs, assets,
   sources, Q&A, or citations.
3. Every supported visual lesson opens its guided inspector.
4. Required unresolved placeholders produce actionable readiness paths.
5. An author can create, edit, reorder, preview, and remove a chapter check and
   final assessment.
6. Correct-answer feedback and passing-score behavior work in author preview.
7. Learner/review payloads do not expose answer keys.
8. Product Stage edits both foreground and background images.
9. A ready template course can freeze, create a review, and export SCORM.
10. Duplicating moto g87 produces different destination media keys and an
    independently editable graph.
11. Editing or deleting duplicated media does not affect moto g87.
12. Duplicated courses retain inherited sources, approved Q&A, and valid
    citations without parser or OpenAI calls.
13. The duplicate has no copied revisions, review links, feedback, progress,
    analytics, jobs, generations, or exports.
14. Reprocessing the same duplication job resolves to the same destination
    course and media keys.
15. Existing moto g87 preview, review, and SCORM behavior remain intact.

## Documentation

The root `README.md` will document template versus duplication semantics,
assessment ownership, the duplication worker requirement, and readiness gates.
`GUIDE.md` will document the author-facing creation, assessment, Product Stage,
duplication, freeze, and export workflow.
