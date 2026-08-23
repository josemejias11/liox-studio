# Moto AI Course Studio — User Guide

This is the practical "how do I actually use this" guide. For architecture,
environment variables, and deployment details, see [README.md](README.md).
This guide assumes you're running everything locally as the sole author.

## Quick reference: URLs and passwords

| Surface               | URL                                     | Password         |
| --------------------- | --------------------------------------- | ---------------- |
| Course Studio login   | `http://localhost:3000/studio/login`    | `studio`         |
| Course library        | `http://localhost:3000/studio`          | (session cookie) |
| Analytics login       | `http://localhost:3000/analytics/login` | `analytics`      |
| Analytics dashboard   | `http://localhost:3000/analytics`       | (session cookie) |
| Parser service health | `http://127.0.0.1:8000/health`          | —                |
| Parser service docs   | `http://127.0.0.1:8000/docs`            | —                |

These two passwords come from `COURSE_STUDIO_PASSWORD` and
`ANALYTICS_PASSWORD` in `.env.local` — change them there if you ever rotate
them, and update this table to match. This file isn't gitignored, so if it
ever gets committed/pushed, these values go with it.

## Starting everything up

Four things need to be running at once:

1. **PostgreSQL** — installed via Homebrew as `postgresql@18`. Start it with:
   ```bash
   brew services start postgresql@18
   ```
   (`brew services stop postgresql@18` to stop it, `restart` to restart it,
   `brew services list` to check whether it's currently running.)
2. **Parser service** (Python/FastAPI) — from `services/parser-service`:
   ```bash
   source venv/bin/activate
   python -m moto_parser
   ```
3. **Job worker** — from the repo root:
   ```bash
   npm run jobs:worker
   ```
   Handles source indexing, Q&A drafting, AI course generation, and SCORM
   export. If this isn't running, those actions stay stuck "queued" forever.
4. **The web app** — from the repo root:
   ```bash
   npm run dev      # for authoring, day to day
   ```
   Open `http://localhost:3000/studio` and log in with
   `COURSE_STUDIO_PASSWORD` (from `.env.local`; see the table above).

Course assets, source documents, and SCORM exports are stored on local disk
at `LOCAL_STORAGE_ROOT` (also in `.env.local`) — make sure that directory
exists and is writable before uploading anything.

## Authoring a course

### Starting a course: blank or comprehensive

From the course library (`/studio`), you choose between two creation paths:

- **Blank course** — an empty course with just a title. Build the chapter and
  lesson structure yourself from nothing.
- **Comprehensive course** — instantiates the built-in `comprehensive-course`
  template: three chapters covering all nine lesson types, a chapter
  knowledge check, and a final assessment, already wired together. Every
  piece of copy is a neutral placeholder (things like "Replace with the
  course headline" or "Replace with specification"), there is no media
  attached to any lesson yet, and there is no moto/g87 content anywhere in
  it — it's a generic scaffold, not a copy of the demo course.

Either way, fill in the course's title, description, learning objectives,
cover image, specifications, and legal disclaimer once you're inside the
course workspace. Then build it out:

- **Chapters** — ordered, each with an estimated duration.
- **Lessons** — each chapter holds a sequence of lessons. Nine lesson types
  are available, each a different interaction pattern: `content`, `stage`
  (hotspots on an image), `interaction`, `splitScreen`, `scrollStory`,
  `canvas` (hotspot inspection), `dragDrop`, `colorSwitcher`, and `video`.
  Lessons can be reordered, duplicated, soft-deleted (trash), and restored.
  There's no `Quiz` lesson type in the lesson picker anymore — see
  "Chapter and final assessments" below for how quizzes work now. If a course
  still has an old inline quiz lesson from before this change, it opens as a
  read-only "legacy inline quiz" notice; remove it (or replace it with a
  chapter/final assessment) before you can freeze a new revision.
- **Media** — upload images/video directly in a lesson; they land in local
  storage and are served back through `/api/course-assets/...`.

Everything here is live and editable — nothing is "published" to a learner
or reviewer until you explicitly freeze a revision (below).

### Resolving a template's placeholders

A course created from the Comprehensive template tracks a checklist of
specific fields you need to touch before the course is considered "ready" —
things like the course description, the content lesson's headline, the
Stage's two images, the drag-and-drop image, at least one colour variant, and
the chapter/final assessment copy and answers. You don't see a separate
checklist UI: instead, if you try to freeze a revision, create/replace a
review link, or export SCORM while placeholders are still unresolved, the
request is rejected and the panel shows the specific list of what's still
outstanding (for example, "Course description" or "Stage product image").
Edit the flagged field with real content or a real upload and the
corresponding item drops off the list. This checklist only applies to
courses created from a template — a blank course has no placeholder
requirements, though it still has to satisfy the same general readiness
rules described next.

### Chapter and final assessments

Each chapter can have one optional **knowledge check**, and the course can
have one optional **final assessment**. Open a chapter in the outline and
look for an "Add knowledge check" row after its lessons (or "Chapter
knowledge check" if one already exists); the final assessment has its own
row after all the chapters. Both use the same guided editor:

- Title, instructions, passing score, whether learners can retry, and
  whether correct answers are revealed after submission.
- One or more questions, each with an optional image, an explanation, and
  two to eight answers. Exactly one answer per question is marked correct —
  selecting a different one automatically clears the previous selection, so
  you can never save a question with zero or multiple correct answers.
  There's no true/false question type as such; author a two-answer single-
  choice question instead.

Pass/fail feedback is visible in the author preview after you submit a
question, but only as a generic message ("Correct answer." / "Incorrect.
The highlighted option is the correct answer.") — your own written
per-answer feedback and per-question explanation text are never shown in
preview, so don't read a plain pass/fail result as preview being broken.
The correct-answer key itself is never sent through review or the live app
to a learner — only the authenticated authoring surface and server-side
grading see it there. The one exception is a SCORM export, which
intentionally bundles the full answer key for LMS-side grading; see
"Exporting for an LMS (SCORM)" below. Removing an assessment (the Remove
action in its inspector) deletes the attached `CourseQuiz` row entirely; the
outline selection falls back to the chapter or the course rather than
leaving a dead panel open.

A review link renders the chapter and final assessment screens too, but
reviewers can't actually submit or get graded on them there — the answer
key is stripped from review payloads by design, so every click just shows
an unhelpful message. Use the author preview if you need to check how an
assessment actually behaves when answered.

### Setting both Product Stage images

The Product Stage lesson type now has two independent image fields, both
always visible in its inspector:

- **Product image** — the foreground item on the stage (this is the
  lesson's `media` field).
- **Stage background** — the backdrop behind it.

Upload each separately. Both are required for a Stage lesson to pass
readiness (see below) — a Stage with only one image set will block freezing,
review, and SCORM export until the other is added too.

### Course readiness: what blocks freeze, review, and export

Before a course can be frozen into a revision, before a review link can be
created or replaced, and before a SCORM export can be requested, Course
Studio runs the same readiness check against the course graph. If it fails,
you get back a list of specific issues instead of the action completing —
common ones you'll see in practice:

- a lesson still using the removed inline `Quiz` type;
- a lesson type missing media its player rendering needs (for example, a
  Stage lesson missing its background, a video lesson with no file, or a
  colour switcher with zero variants);
- a chapter check or final assessment that isn't valid (for example, a
  question with no correct answer marked);
- for template-created courses, an unresolved placeholder checklist item
  (see "Resolving a template's placeholders" above).

Fix what's listed and retry the same action — there's no separate "run
readiness check" button, the freeze/review/export actions themselves are the
check. See README.md's "Course readiness gates" section for the underlying
issue codes behind each of these symptoms.

### Duplicating a course

Every course card in the library (`/studio`) has a **Duplicate course**
action. Click it, confirm or edit the suggested title (defaults to
`<course title> copy`), and Course Studio queues a background duplication
job and shows its progress inline. When it finishes, you're taken straight
to the new course's workspace.

Duplication copies:

- the full chapter/lesson graph, including chapter knowledge checks and the
  final assessment;
- every piece of media referenced by the graph, into a brand-new storage
  location scoped to the destination course — editing or deleting an image
  in the copy can never touch the source course's media, and vice versa;
  and
- already-approved Course Assistant Q&A, along with its underlying source
  bindings and citations, so the copy's assistant keeps working without
  re-running the parser or OpenAI at all.

Duplication does **not** copy: revisions, review links, review feedback,
learner progress or sessions, quiz attempts, analytics data, background
jobs, AI course generations, or SCORM exports. The copy starts as a fresh,
unfrozen, unreviewed draft — you freeze and review it independently, same
as any other course.

The source course is never modified by a duplication request, whether it
succeeds, fails, or is retried. If the same duplication job is reprocessed
(for example, after a worker restart), it resolves to the same destination
course and the same media — it will not create a second copy.

## Source documents and AI assistance

The Source panel accepts PDF, PPTX, DOCX, and XLSX files up to 50MB. After
upload, each source shows an indexing status:

| Status     | Meaning                                                             |
| ---------- | ------------------------------------------------------------------- |
| `PENDING`  | Queued; waiting for the job worker to send it to the parser service |
| `INDEXED`  | Successfully chunked and embedded — usable for AI drafting          |
| `FAILED`   | Something went wrong — use **Retry** once the issue is fixed        |
| `DELETING` | Removal in progress (file + parser-side chunks)                     |

Once sources are `INDEXED`, you can ask for AI assistance:

- **Course Assistant Q&A drafts** — cited proposals for the learner-facing
  assistant, generated from your selected indexed sources.
- **AI course drafting** — generates a whole new editable course from a
  _frozen_ revision's exact source set.

Both only ever produce **drafts**. Nothing an AI generates goes live until
you review it and explicitly approve it — this is a hard rule of the tool,
not a UI suggestion.

## Freezing a revision and sharing it for review

When a course is ready for a look from someone else, open the **Master
review** panel and:

1. **Freeze master** — snapshots the current course graph, its exact source
   IDs/hashes, and any approved Q&A into an immutable `CourseRevision`. Later
   edits to the live course never change what's in a frozen revision.
2. **Create review link** (or **Replace review link** if one already exists
   for that revision) — mints a single-use, unguessable review URL and shows
   a "Copy review link" button.

### Getting that link in front of a client, for free

There's no built-in hosting or email delivery — you're running this on your
own machine, so the link only works while your machine, the app, and (if
using a tunnel) VS Code stay running. To let an external client actually
open it:

1. Build and run in **production mode**, not dev mode — this matters,
   because `next dev`'s Turbopack dev server blocks cross-origin requests to
   its internal assets, which breaks the page when accessed through a
   tunnel:
   ```bash
   npm run build
   npm start
   ```
2. In VS Code, open the **Ports** panel (Terminal area → Ports tab) →
   **Forward a Port** → `3000`, and set its visibility to **Public** (so the
   client doesn't need to sign into anything to open it).
3. _With the tunnel already running_, click **Create review link** (or
   **Replace review link**) in the Revision panel — the returned URL will
   correctly use the tunnel's `https://*.devtunnels.ms` hostname, not
   `localhost`. Copy it and send it to the client through whatever channel
   you'd like (email, Slack, text — it's just a link).
4. Keep your machine, the app, and the tunnel running until the client is
   done. If you restart the tunnel later, its hostname changes and any
   previously sent link goes dead — just click **Replace review link** again
   and send the fresh one.

## Reading client feedback

There's no email or Slack notification when a client leaves feedback — you
have to check for it yourself. Open the course's **Master review** panel in
Course Studio: every comment a reviewer left appears there, tagged with the
lesson/screen it's attached to. Click **Resolve** once you've acted on one;
resolved items stay visible but greyed out.

## Exporting for an LMS (SCORM)

SCORM export is initiated from Course Studio at `http://localhost:3000`. It
does not have a separate browser port or a separate export application. The
job worker performs the build in the background, but the worker is not an
HTTP server and does not expose a URL.

Before exporting for the first time, build the standalone player from the
repository root:

```bash
npm run build --workspace=@moto-ai/scorm-export
```

Then set `SCORM_PLAYER_BUNDLE_PATH` in the root `.env` to the absolute path
of `packages/scorm-export`. For this checkout, that is:

```env
SCORM_PLAYER_BUNDLE_PATH=/Users/josemejias/Workbench-QA/moto-ai/packages/scorm-export
```

PostgreSQL, shared local storage, the web app, and the job worker must be
available. In separate terminals, run:

```bash
# Background worker — no browser port
npm run jobs:worker

# Course Studio — opens on port 3000
npm run dev
```

The parser service on port `8000` and OpenAI are not used while building a
SCORM package. They are only needed for parser-backed operations such as
source indexing and AI drafting.

To export a course:

1. Open `http://localhost:3000/studio` and log in.
2. Find the course in the library and click **Review master**. The export
   control is currently in this library panel, not inside the open authoring
   route at `/studio/[courseId]`.
3. If there is no frozen revision, click **Freeze master**. Export always uses
   an immutable frozen revision, so later edits to the live course do not
   change an existing package.
4. Click **Export SCORM package** beside the revision you want to export.
5. Course Studio queues the job and checks its status automatically. The
   package can take a few minutes to build.
6. When the job succeeds, click **Download SCORM package** in the same panel
   to save the `.zip`.

The ZIP includes the standalone Moto Player, frozen course content, media,
manifest, approved offline assistant content, answer keys, bookmarking,
score, and completion reporting. Upload the ZIP directly to a SCORM 1.2 LMS;
do not unzip it first. The exported player runs inside the LMS and does not
need this app, PostgreSQL, the parser service, or OpenAI at learner runtime.
There is currently no separate localhost route for launching the generated
ZIP.

## Analytics

`/analytics` (separate password, `ANALYTICS_PASSWORD`) shows aggregated
learner data already recorded in Postgres: session counts, hotspot
exploration, quiz score bands, lesson view counts, and weak-topic
indicators. It's a read-only internal dashboard, not tenant-aware reporting.

## When something's stuck

- **A background job never finishes** — confirm `npm run jobs:worker` is
  actually running and can reach Postgres. Indexing, Q&A drafting, and AI
  generation also require the parser service; SCORM export does not.
- **SCORM export reports missing configuration** — rebuild
  `@moto-ai/scorm-export` and confirm `SCORM_PLAYER_BUNDLE_PATH` points to the
  `packages/scorm-export` directory containing `dist/player.js` and
  `dist/player.css`.
- **Uploads or exports fail** — confirm `LOCAL_STORAGE_ROOT` is set and
  writable by both the web app and the job worker.
- **Parser won't start** — confirm `services/parser-service/.env` has both
  `PARSER_SERVICE_TOKEN` (matching the root `.env.local` value exactly) and
  `OPENAI_API_KEY`.

See README.md's [Troubleshooting](README.md#troubleshooting) section for
more detail on any of the above.
