# Course Studio Forward Authoring Design

## Goal

Make the app-owned Course Studio the complete Lionbridge master-authoring
workspace, restore the authoring controls lost in the move from Sanity, enable
author-controlled AI course-draft generation, and fully retire Sanity. This
work deliberately excludes delivery/export to Motorola Insiders.

## Product boundary

Course Studio is an authoring library, not a learner catalog or client
delivery system. Every saved course appears in the authoring library and is
available for in-app author preview. A client receives only a frozen master
delivery candidate through a future Insiders delivery/export adapter.

The future adapter is out of scope: do not choose, infer, or build an Insiders
format or integration in this work.

## Source of truth

- PostgreSQL owns the course graph, structured lesson payloads, revision
  snapshots, attached source-material records, review feedback, generation
  jobs, and generation provenance.
- R2 owns authoring media and source-file bytes.
- A frozen revision is an immutable master delivery candidate and review/share
  snapshot. It does not determine learner visibility or publication.
- Sanity is not a compatibility target. There is no migration, archive,
  export, read-only fallback, or dual-write period.

## Course availability and lifecycle

There is no course-level Draft/Published state, publish control, client-facing
course catalog, or approval state in Course Studio.

- A manually created course must contain a minimally valid starter graph so it
  can be opened and previewed immediately in the authoring library.
- A generated course is created in the authoring library only after its
  generation output validates as a complete course graph.
- Authors may edit a course after it has been frozen; that does not mutate an
  existing frozen revision.
- Existing database publication enum/field and every query/filter/API that
  relies on it are removed.

## Authoring controls to add

### Spatial editors

- Replace numeric-only hotspot positioning with a media-backed canvas that
  supports click-to-add, pointer drag, selected-target editing, and keyboard
  coordinate adjustment.
- Replace numeric-only text-overlay placement with a media-backed canvas,
  drag positioning, and the existing supported width presets.
- Retain numeric values as the stored contract and accessible fallback; the
  visual tool is an editor for those values, not a new rendering model.

### Structured copy and learning cues

- Replace plain-text-only copy fields with a constrained rich-text editor for
  lesson, hotspot, and scroll-story copy.
- Support emphasis and lists plus a validated learning-cue link to an existing
  hotspot or recall feature in the same lesson.
- Preserve all previously authored payload metadata that the guided editor does
  not own; reject invalid learning-cue targets on save.

### Media authoring

Add reusable R2 asset-picker/upload controls for:

- hotspot photo galleries and hotspot video;
- quiz-question images;
- colour-variant product images; and
- scroll-story chapter images.

Each control reports upload progress and errors, validates MIME type and size,
and writes the current typed lesson payload shape. Existing asset references
remain preserved when fields are edited.

## Source-material grounding

Add a Course Sources panel for approved source files. It supports permitted
office/document types, upload progress, durable indexing status, error
recovery, list, and removal.

When a revision is frozen, it records the exact attached source-file IDs and
content hashes. Retrieval and AI generation may use only sources explicitly
attached to that revision. Uploading/indexing a file alone never makes it
authoritative.

The legacy unbound parser corpus is deprecated during the transition and is
removed once revision-bound indexing is live. It is never used for new
revision-bound retrieval.

## AI course-draft generation

Add **Create with AI** in Course Studio. An author gives a course brief and
selects approved sources; a durable background job produces a complete,
editable course graph containing title, objectives, chapters, lesson types,
copy, interaction drafts, asset placeholders, and authored-quiz suggestions.

- The result is a new course, never an overwrite of an existing course.
- The job creates the course only after the complete generated graph validates.
- The system records the source IDs/hashes, source revision, model/version,
  prompt-template version, timestamp, job ID, and result metadata.
- Failures and partial output are presented as recoverable job errors, never as
  a half-created course or a client delivery.
- AI content is author-editable and requires author choice before it becomes a
  frozen master. Authored assessments remain authoritative; generated quiz
  material is a suggestion.
- The integration stays browser -> Next.js API -> typed parser client ->
  parser-service. Local Ollama remains a development-only provider.

## Review and preview

The in-app player stays an author preview and review experience. The existing
immutable revision, review-link, and feedback features remain, but their copy
and contracts must refer to a master review snapshot rather than publishing or
learner delivery.

## Sanity retirement

After the replacements above are verified end-to-end, delete:

- Sanity packages and lockfile entries;
- embedded Studio route, CLI/configuration, schemas, GROQ queries, image
  loader, and Sanity-specific contracts/player adapters;
- Sanity-specific quiz grading branch;
- Sanity document writes and upload/indexing behavior in workers;
- Sanity environment variables, documentation, and operational instructions.

Do not delete generic Next.js runtime configuration or the parser-service,
durable jobs, PostgreSQL, R2, review, or author-preview infrastructure.

## Explicit non-goals

- Sanity content migration, archive, export, or a generic CMS/Desk.
- Any client-facing learner catalog in Moto AI.
- Insiders delivery format, package generation, or integration.
- Localization workflows or Articulate import/export.
- Autonomous publishing/delivery, silent course overwrite, or AI-authored
  content treated as authoritative without author control.

## Delivery order

1. Establish revision-bound source records, indexing, provenance, and remove
   course publication state.
2. Restore visual spatial editing, rich text/learning cues, and missing asset
   controls.
3. Add AI course-draft generation, durable job status/retry, provenance, and
   author review.
4. Verify authoring, master snapshot, source grounding, and preview flows.
5. Retire Sanity completely.

## Acceptance evidence

Each release requires source/type/lint validation plus authenticated browser
evidence for its changed authoring flow. Claim persistence only after the
stored graph/revision/source provenance has been inspected, and claim AI
grounding only after the recorded attached source set matches the request.
No automated test files are added unless the user explicitly changes the
project's no-testing instruction.
