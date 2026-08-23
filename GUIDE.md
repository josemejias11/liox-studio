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

From the course library (`/studio`), create a course and fill in its title,
description, learning objectives, cover image, specifications, and legal
disclaimer. Then build it out:

- **Chapters** — ordered, each with an estimated duration.
- **Lessons** — each chapter holds a sequence of lessons. Nine lesson types
  are available, each a different interaction pattern: `content`, `stage`
  (hotspots on an image), `interaction`, `splitScreen`, `scrollStory`,
  `canvas` (hotspot inspection), `dragDrop`, `colorSwitcher`, and `video`.
  Lessons can be reordered, duplicated, soft-deleted (trash), and restored.
- **Quizzes** — an optional quick-check per chapter, plus one final
  course-level assessment. These carry the correct answers server-side only;
  the player never receives them.
- **Media** — upload images/video directly in a lesson; they land in local
  storage and are served back through `/api/course-assets/...`.

Everything here is live and editable — nothing is "published" to a learner
or reviewer until you explicitly freeze a revision (below).

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
