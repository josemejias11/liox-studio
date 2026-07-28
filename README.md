# Moto AI Course Studio

Moto AI is an app-owned e-learning authoring and delivery platform. Course Studio creates and previews learning experiences with the same Moto Player used by learners. PostgreSQL owns course structure, authoring state, reviews, progress, and quiz records; Cloudflare R2 owns course media.

The downstream localization package used by Motorola partners is intentionally not hardcoded yet. Approved, immutable course revisions are the future adapter boundary once the agency workflow and Articulate 360 handoff requirements are confirmed.

## Current product boundary

Course Studio is Lionbridge’s internal tool for building the complete English
Motorola e-learning master. Authors control course structure, learner-facing
copy, media, interactions, ordering, preview, immutable review versions, and
client feedback.

Course Studio does not replace Motorola Insiders or HaLight, provide agency
accounts, translate content, geolocate assets, or generate an Articulate,
SCORM, or xAPI package. Those downstream formats remain an adapter boundary
until Motorola’s agency workflow is confirmed.

## Architecture

```text
Course Studio (/studio) ────────────────┐
Client review (/review/[token]) ───────┼──► PostgreSQL
Moto Player (/course/[slug]) ──────────┘    courses, revisions, reviews,
             │                             feedback, progress, quizzes
             ├──► Cloudflare R2
             │    images, video, source assets
             └──► Next.js APIs ──► durable job worker
                                      └──► FastAPI parser / local AI
```

The repository is an npm workspace:

- `apps/web` — Next.js 16 app, Course Studio, Moto Player, APIs, and analytics.
- `apps/job-worker` — durable Postgres-backed document indexing and quiz jobs.
- `packages/database` — Prisma schema, migrations, and course repositories.
- `packages/contracts` — shared request and response contracts.
- `packages/jobs` — durable queue claiming, leases, retries, and artifacts.
- `packages/parser-client` — typed server client for the parser service.
- `services/parser-service` — FastAPI document parsing, retrieval, chat, and quiz generation.

## Product surfaces

- `/` — published course library backed by PostgreSQL.
- `/course/[slug]` — learner-facing Moto Player.
- `/studio/login` — Course Studio sign-in using `COURSE_STUDIO_PASSWORD`.
- `/studio` — course library and course creation.
- `/studio/[courseId]` — three-pane authoring workspace, non-persistent Moto Player preview, revisions, and review feedback.
- `/review/[token]` — immutable client review with course- and lesson-specific feedback.
- `/analytics` — learning analytics.

Course Studio preview never writes learner progress. Static authored quiz answer keys remain server-side in PostgreSQL; the browser receives only the question and answer-option text.

## Supported learning blocks

All courses use the same authoring workflow. Canvas is a lesson block, not a
course mode. Course Studio exposes the existing Moto Player interactions as
controlled authoring blocks:

| Authoring block     | Runtime type    |
| ------------------- | --------------- |
| Content screen      | `content`       |
| Hotspot exploration | `interaction`   |
| Product stage       | `stage`         |
| Video               | `video`         |
| In-lesson quiz      | `quiz`          |
| Canvas inspection   | `canvas`        |
| Colour switcher     | `colorSwitcher` |
| Split screen        | `splitScreen`   |
| Drag and drop       | `dragDrop`      |
| Scroll story        | `scrollStory`   |

Authors can add, duplicate, reorder, edit, preview, and remove these blocks.
Uploaded images and video are stored in the private R2 bucket and referenced by
the PostgreSQL authoring graph. The inspector uses guided fields for each block
type: hotspots and discovery content, video settings, quiz questions and
choices, color variants, split-screen layout, drag/drop chips and zones, and
scroll-story chapters. Authors do not need to hand-edit JSON.

## Authoring and review workflow

1. Create a course from `/studio`; PostgreSQL creates a safe opening chapter and content screen.
2. Add, duplicate, reorder, edit, or remove chapters and learning blocks in the course outline.
3. Edit course metadata and structured block content in the inspector. Course media uploads to Cloudflare R2 and is referenced from the authored graph.
4. Validate the selected screen in the embedded Moto Player or focus-preview mode. Preview disables progress, analytics, and AI requests.
5. Freeze the current graph as an immutable numbered revision.
6. Create a token-scoped review link and send it to the client.
7. Reviewers explore that exact frozen revision and submit general or screen-specific feedback.
8. Authors read and resolve feedback in Course Studio without changing the frozen revision.

### Screen Trash and recovery

Deleting a screen moves its complete authored snapshot to indefinite Trash in
PostgreSQL. The screen leaves the active outline immediately, while its lesson
ID, type, copy, payload, chapter, and position remain available for recovery.
Course Studio provides an immediate **Undo** action and persistent **Restore**
from the Trash panel. Restore returns the screen to its original chapter and
position when that chapter still exists.

Direct screen deletion is recoverable. Permanent deletion of one Trash item and
**Empty Trash** are the only ways to destroy screens already in Trash. Deleting
a chapter remains destructive: it permanently deletes that chapter and all of
its active screens, while leaving its separate Trash items intact. If a
screen's original chapter no longer exists, the UI reports that restore is
unavailable while leaving the Trash item recoverable for permanent deletion.

The Trash data model requires the committed Prisma migration
`20260728190000_add_course_lesson_trash`. Apply migrations before starting an
updated local app or deploying an updated release; this documentation does not
assert that the migration is currently applied in any environment.

Creating a new review link for an existing revision invalidates its previous
link. Editing the live course never changes an existing review; freeze another
revision when the client should review updated work.

Review tokens grant read-only access to one frozen revision. Only token hashes
are stored in PostgreSQL. Review and Studio preview modes disable learner
progress, weak-topic analytics, and the Course AI assistant.

## Environment

Create the root defaults and the separate local-secret file:

```bash
cp .env.example .env
cp .env.local.example .env.local
```

`.env` owns Prisma-required database connection values and non-secret service
defaults. The generated file remains local and must not be committed:

```env
DATABASE_URL="postgresql://<user>:<password>@localhost:5432/moto_ai_dev"
DIRECT_URL="postgresql://<user>:<password>@localhost:5432/moto_ai_dev"
PARSER_SERVICE_URL="http://localhost:8000"
JOB_WORKER_POLL_INTERVAL_MS="1000"
```

`.env.local` owns application secrets and R2 credentials:

```env
COURSE_STUDIO_PASSWORD="<strong-authoring-password>"
ANALYTICS_PASSWORD="<different-strong-password>"

R2_ACCOUNT_ID="<cloudflare-account-id>"
R2_ACCESS_KEY_ID="<r2-access-key-id>"
R2_SECRET_ACCESS_KEY="<r2-secret-access-key>"
R2_BUCKET="<course-studio-bucket>"

PARSER_SERVICE_TOKEN="<shared-internal-token>"
```

Set the same `PARSER_SERVICE_TOKEN` in `services/parser-service/.env`. The R2
bucket can remain private; the application serves stable course asset URLs
through its authenticated R2 integration. Keep production credentials only in
the deployment platform’s secret store.

## Local development

Prerequisites:

- Node.js 20 or newer
- PostgreSQL
- Python 3.11 or newer
- Ollama for local AI features

Install and prepare the database:

```bash
npm install
npm run db:migrate
```

The migration command must complete before the updated Course Studio starts;
the same requirement applies to every deployment. The screen Trash feature
depends on migration `20260728190000_add_course_lesson_trash` being present in
the target PostgreSQL database.

Confirm PostgreSQL is accepting connections, then start the web app:

```bash
pg_isready -h localhost -p 5432
npm run dev
```

The app is available at `http://localhost:3000`.

For document indexing, grounded chat, and generated quizzes, also start the parser service and worker:

```bash
cd services/parser-service
python3 -m venv venv
source venv/bin/activate
pip install -e '.[dev]'
python -m moto_parser
```

In another terminal at the repository root:

```bash
npm run jobs:worker
```

## Workspace commands

| Command                  | Purpose                                   |
| ------------------------ | ----------------------------------------- |
| `npm run dev`            | Start the Next.js application             |
| `npm run jobs:worker`    | Start the durable background worker       |
| `npm run build`          | Apply Prisma migrations and build Next.js |
| `npm run lint`           | Run the repository linter                 |
| `npm run typecheck`      | Type-check every TypeScript workspace     |
| `npm run db:migrate`     | Apply committed Prisma migrations         |
| `npm run db:migrate:dev` | Create and apply a development migration  |
| `npm run db:generate`    | Regenerate the Prisma client              |
| `npm run db:studio`      | Open Prisma Studio                        |

`npm run build` requires the configured PostgreSQL database to be reachable because migrations run before the Next.js build.

## Data ownership

- Course, chapter, lesson, authored quiz, revision, review, and feedback identity is durable in PostgreSQL.
- Course images and videos are stored in Cloudflare R2 and referenced by Postgres metadata.
- Frozen revisions are immutable snapshots; editing a live draft cannot change a client review already in progress.
- Review URLs contain the only copy of their access token; PostgreSQL stores the hash.
- Learner progress keeps stable course and lesson IDs across authoring revisions.
- Source documents are indexed by the parser service; the worker records indexing receipts in `Course.sourceFiles`.
- AI-generated quiz answer keys and authored quiz answer keys never leave server-side storage.
