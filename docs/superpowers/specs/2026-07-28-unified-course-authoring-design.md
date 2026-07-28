# Unified Course Authoring Design

Date: 2026-07-28
Status: Design approved by product direction; implementation pending spec review

## Purpose

Course Studio will author one unified course shape. The obsolete course-level
`standard` and `canvas` modes are removed. `canvas` remains a lesson type that
authors can place in any course, alongside the other supported lesson types.

The lesson inspector will stop exposing raw JSON as the primary authoring
surface. Each lesson type will receive a structured form that maps directly to
the fields already consumed by the Moto Player.

## Decisions

### Course boundary

`courseMode` is removed from the Prisma model, repository graph and update
inputs, API contracts, player normalization, Course Settings UI, course list
labels, and documentation. A database migration drops the obsolete column.

No course-mode compatibility branch is retained. Existing courses continue to
load as unified courses because lesson records already carry their own
`lessonType`; Canvas lessons are not converted or deleted.

### Lesson boundary

The lesson type registry remains the source of truth for the supported lesson
blocks:

`content`, `interaction`, `stage`, `video`, `quiz`, `canvas`,
`colorSwitcher`, `splitScreen`, `dragDrop`, and `scrollStory`.

Every lesson editor has shared headline and body fields. Body editing uses a
readable text control; persisted Portable Text is preserved when untouched and
existing player rendering remains unchanged. Media uses the existing R2 asset
upload endpoint and stores the same nested asset reference the player expects.

Typed editors then expose only the fields relevant to the selected lesson type:

| Lesson type | Structured fields |
| --- | --- |
| content / interaction | media, text overlay, covered features, ordered hotspots, hotspot topic/body/coordinates/required flag, optional hotspot photos/video |
| stage | stage background, completion animation/transition, ordered hotspots and discovery content |
| canvas | inspection media, ordered targets, target label/topic/body, coordinates, required flag, photos/video |
| video | video asset and aspect ratio |
| quiz | title/instructions, ordered questions, question type, answer choices, passing score, retry and answer-display settings |
| colorSwitcher | ordered variants, labels, color hex values, images |
| splitScreen | media, reverse layout, covered features and body |
| dragDrop | media, ordered chips, ordered drop zones, labels, correct chip references and positions |
| scrollStory | hero media and ordered chapters with heading/body/image and transform values |

Repeatable fields support add, remove, and reorder actions. Validation is
inline and save remains disabled while uploads are active or the draft is
invalid. The editor never requires an author to hand-edit JSON.

### Payload preservation

Each typed draft stores the original lesson payload and merges edited known
fields back into it at save time. Unknown metadata survives edits to unrelated
fields. Known fields removed by the author are explicitly removed from the
persisted payload. The lesson `body` column remains separate from the payload,
matching the existing repository and player adapter contract.

The serializer is the only code allowed to translate a lesson draft into
`LessonInput`. It produces the current player shapes without changing lesson
IDs, ordering, asset URLs, or authored quiz answer semantics.

## Components and data flow

`StudioInspector` remains the selection boundary. Its chapter branch stays
small, its course branch continues delegating to `CourseInspector`, and its
lesson branch delegates to a new `LessonInspector`.

`LessonInspector` owns draft lifecycle, dirty state, upload locking, common
fields, validation display, and save orchestration. Per-type controls live in
focused components under `apps/web/src/course-studio/inspectors/lesson/`.

The flow is:

1. The selected `CourseGraphLesson` is converted into a typed draft using the
   lesson type discriminator and original payload.
2. A type-specific form edits the draft through controlled callbacks.
3. The shared serializer validates and emits `{ headline, body, payload }`.
4. The existing lesson API and repository persist the input.
5. The workspace refreshes the graph and the existing player preview renders
   the same normalized lesson contract.

The lesson form uses stable client-only keys for repeatable rows. Those keys
never enter persisted JSON. Existing asset upload behavior is retained, but the
uploaded reference is applied to the appropriate typed field rather than to a
raw JSON textarea.

## Unified course contract changes

The following are removed together so the old architecture cannot reactivate:

- `courseMode` from `CourseGraph`, `CourseDetailsInput`, authoring course list
  projections, and repository selects/creates/updates.
- `courseModeSchema` and the `courseMode` property from Course Settings input
  contracts and drafts.
- `courseMode` from player-course normalization and summary contracts.
- Standard-versus-Canvas labels and controls in the app and README.
- Any API or documentation examples that describe Canvas as a course mode.

The `courseMode` database migration is additive to the existing authoring
migration history and contains only the column removal. The migration is run
before production build verification.

## Error handling and safety

- Invalid numeric values are surfaced inline and never serialized as `NaN`.
- Required repeatable rows cannot be saved empty.
- A failed upload leaves the draft unchanged and reports the failure beside the
  form.
- Save errors remain visible and do not clear the dirty draft.
- Selection changes, structural mutations, Trash actions, and Focus Preview
  continue to use the existing dirty-confirmation guard.
- Destructive chapter behavior and persistent screen Trash are unaffected.
- Preview remains read-only: typed authoring changes are not applied to the
  learner runtime until saved, and existing preview restrictions stay intact.

## Verification

Static verification will run after implementation:

- `npm run db:generate`
- `npm run typecheck`
- `npm run lint`
- `git diff --check`

No automated tests will be created or run, per the project direction. Runtime
verification will cover Course Settings, one representative lesson from every
lesson editor branch, upload locking, invalid-field messaging, save/reload,
and Canvas lesson preview. Database migration and production build remain
explicit release checks because they require the local PostgreSQL service.

## Out of scope

- Exporting an Articulate/Storyline package.
- Agency localization workflows or third-party distribution integrations.
- Replacing the existing player visuals or interaction semantics.
- Adding a second lesson-authoring data model.
- Restoring a raw JSON editor as a normal or hidden fallback.
