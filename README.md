# Moto AI Course Studio

Moto AI is an app-owned e-learning authoring platform. Course Studio is where
authors create the English learning master; the shared Moto Player renders that
content in the author preview and in immutable, shareable review links.

Learning comes first: authored course content and assessments are the source of
truth. AI assists authors by processing approved source material and creating
editable drafts; it is not the learner experience or an authority over the
course. The learner-facing Course Assistant uses only author-approved Q&A
included in a frozen revision, with deterministic local matching and fallback.
It never requests the parser service or an AI model.

Authoring AI is directed by the project owner and, when enabled, uses the
configured OpenAI API service.

## Product status

| Capability                          | Status          | Notes                                                                                                                                                                                             |
| ----------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Course Studio authoring             | Implemented     | Password-protected course, chapter, lesson, assessment, media, source, revision, and trash workflows                                                                                              |
| Author preview                      | Implemented     | Uses the same Moto Player components as review and SCORM delivery                                                                                                                                 |
| Structural assessments              | Implemented     | Dedicated `CourseQuiz`-backed chapter quick checks and one course final assessment, authored through a shared guided editor; the inline `Quiz` lesson type is no longer offered for new lessons   |
| Product Stage authoring parity      | Implemented     | The Stage lesson inspector exposes both the foreground product image and the stage background as independent, always-visible fields                                                               |
| Course readiness gates              | Implemented     | A shared validator blocks freezing a revision, creating/replacing a review link, and requesting a SCORM export until the course graph and its assessments pass readiness checks                   |
| Comprehensive course template       | Implemented     | A versioned, code-owned neutral template instantiates a full nine-lesson-type outline with a chapter check and final assessment and no product-specific media or grounding                        |
| Exact course duplication            | Implemented     | A durable background job deep-copies a course's graph, media, assessments, and approved Course Assistant Q&A into an independent destination course without invoking the parser service or OpenAI |
| Frozen review links                 | Implemented     | Capability-token access to one immutable revision, with contextual feedback                                                                                                                       |
| Source indexing                     | Implemented     | PDF, PPTX, DOCX, and XLSX sources are processed asynchronously by the parser service                                                                                                              |
| Course Assistant drafting           | Implemented     | Source-cited Q&A drafts require explicit author approval                                                                                                                                          |
| AI course drafting                  | Implemented     | Creates a new editable course from a frozen revision and its exact source set                                                                                                                     |
| Deterministic Course Assistant      | Implemented     | Frozen approved Q&A is matched locally; learners never call OpenAI or the parser                                                                                                                  |
| SCORM 1.2 export                    | Implemented     | Produces a standalone package with player assets, course media, answer keys, bookmarks, score, and completion reporting                                                                           |
| Analytics dashboard                 | Implemented     | Displays stored session, hotspot, quiz, and lesson-engagement data                                                                                                                                |
| Supplemental parser quiz generation | Boundary only   | The parser endpoint and typed client exist, but no web workflow or worker handler is registered                                                                                                   |
| Public `/course/[slug]` delivery    | Not implemented | There is no public learner page or browser-verified public progress flow yet                                                                                                                      |
| Multi-user accounts and RBAC        | Not implemented | Studio and analytics currently use separate shared passwords                                                                                                                                      |

## Learning and authoring lifecycle

Moto AI separates authoring assistance from learner delivery.

1. An author creates or edits a course in Course Studio.
2. Source files are uploaded to the course source library.
3. The background worker asks the parser service to extract, chunk, embed, and
   index those immutable source identities.
4. The author may request cited Course Assistant Q&A drafts or a new editable
   course draft from an explicitly frozen source revision.
5. Generated material stays editable and unapproved until the author accepts it.
6. Freezing creates an immutable snapshot containing the course graph, exact
   source IDs and hashes, and only approved Course Assistant Q&A.
7. A review link renders that snapshot and collects reviewer feedback without
   mutating the live draft.
8. The same frozen revision can be exported as a standalone SCORM 1.2 package.

The delivered Course Assistant uses deterministic keyword and fuzzy matching
against approved frozen Q&A. It returns a safe fallback when confidence is too
low. Source citations remain available to authors and reviewers for auditability
but are not exposed as generative learner behavior.

## Implemented features

### Course Studio

- Course library with an explicit choice between creating a **Blank course**
  and creating a **Comprehensive course** from the code-owned template
  catalog.
- Course title, slug, description, learning objectives, cover, thumbnail,
  specifications, and disclaimer editing.
- Ordered chapters with estimated duration.
- Lesson creation, editing, duplication, reordering, soft deletion, restoration,
  and permanent trash removal. The `Quiz` lesson type is no longer offered in
  the new-lesson picker; any pre-existing inline quiz lesson renders as a
  read-only "legacy inline quiz" notice instead of an editable one.
- Portable Text editing that preserves unrecognized content metadata.
- Course-level final assessments and chapter quick checks, authored through a
  shared guided assessment editor (title, instructions, passing score, retry,
  answer reveal, and single-correct-answer questions with per-answer
  feedback).
- The Product Stage lesson exposes both a foreground **Product image** and an
  independent **Stage background** field.
- Media uploads stored in local filesystem storage and delivered through
  the web application.
- Source-library upload, indexing status, retry, and deletion workflows.
- Revision history, review-link creation, review feedback, and SCORM export,
  all gated behind course readiness validation (see "Course readiness gates"
  below).
- Exact course duplication into an independent destination course (see
  "Course templates and duplication" below).

### Moto Player

The shared player supports content, hotspot interactions, product stages, video,
quizzes, canvas inspection, colour switching, split-screen comparison, drag and
drop, and scroll stories. It also supports course covers, chapter introductions,
specifications, disclaimers, navigation locks, completion states, final
assessments, reduced motion, and the deterministic Course Assistant.

The player is currently used by the live Course Studio author preview, immutable
review links, and exported SCORM packages. Preview and review intentionally
suppress learner-progress persistence. There is no public `/course/[slug]` page,
so the existing progress APIs are not a complete learner-delivery product.

### Source-grounded authoring

The source library accepts non-empty PDF, PPTX, DOCX, and XLSX files up to 50 MB.
Source bytes are stored in local filesystem storage and queued for durable processing. The worker
verifies queued bytes against the stored SHA-256 before sending them to the
parser service. Parser retrieval is scoped to an explicit course and source-ID
set; an empty source set never falls back to the entire corpus.

The parser can extract and index documents, propose source-cited Course
Assistant Q&A, create an editable course graph, and expose a supplemental quiz
draft endpoint for future authoring integration.

### Course templates and duplication

Two independent, separately implemented creation paths exist from the course
library:

- **Blank course** creates a minimal course with no chapters or lessons.
- **Comprehensive course** instantiates a versioned, code-owned template
  (`apps/web/src/authoring/templates/`, currently `comprehensive-course.v1`)
  in a single transaction. The template covers all nine supported visual
  lesson types plus a chapter knowledge check and a final assessment, using
  entirely neutral placeholder copy (for example, "Replace with the course
  headline") with no media references and no moto g87 or other
  product-specific names, URLs, source IDs, Q&A, or citations. A course
  created from a template carries a concrete `templateChecklist` of
  destination-entity requirements — unresolved placeholder text, missing
  required media, and unedited assessment copy are readiness failures until
  the author changes them (see "Course readiness gates" below). Moto g87's
  own seed script (`scripts/seed-moto-g87-course.ts`) is never imported or
  executed by template code; moto g87 remains a maintenance demo, not a
  template source.

**Exact course duplication** is a separate action, available from each course
card in the library ("Duplicate course"). It captures a consistent snapshot of
the live source course (graph, chapter/final assessments, approved Course
Assistant Q&A with its source bindings and citations, and referenced asset
URLs), enqueues a durable `course_duplicate` background job
(`BackgroundJobKind.COURSE_DUPLICATE`), and the job worker then:

- deep-copies the course graph, chapters, lessons, and assessments into a new,
  independently editable course;
- copies every referenced media object into a destination-course-prefixed
  storage path, so editing or deleting the copy's media can never affect the
  source course's media;
- reuses the source course's immutable `CourseSourceBinding` rows for
  duplicated grounding rather than copying or re-indexing source bytes, and
  copies only already-approved Course Assistant Q&A — no call to the parser
  service or OpenAI happens during duplication; and
- is idempotent by `creationJobId`: retrying the same duplication job
  resolves to the same destination course and the same destination media
  keys rather than creating a second copy.

Duplication intentionally does **not** copy revisions, review links, review
feedback, learner progress or sessions, quiz attempts, analytics data,
background jobs, AI course generations, or SCORM exports — only the live,
editable authoring state and its already-approved grounding are duplicated.
The source course itself is never mutated by a duplication request or by its
worker execution.

### Course readiness gates

A shared `validateCourseReadiness(course: CourseGraph)` validator
(`packages/contracts/src/course-readiness.ts`) runs before three delivery
actions: freezing the live course into a revision, creating or replacing a
review link, and requesting a SCORM export. Each of those requests returns
HTTP 422 with `{ error, issues }` on failure instead of proceeding, and
`RevisionPanel.tsx` renders the returned issue list inline. Readiness issue
codes include `unsupported_lesson` (a legacy inline quiz lesson is still
present), `required_media` (a lesson type is missing media its player
rendering requires, including both Stage images), `invalid_assessment` (a
chapter check or final assessment does not have exactly one correct answer
per question, or otherwise fails assessment validation), `invalid_drag_drop`
and `invalid_learning_cue` (structural validation for those lesson payloads),
and `template_placeholder` (a template-created course still has an unresolved
checklist requirement). Review and SCORM requests re-validate the frozen
`CourseRevision.snapshot` itself, so a direct API call cannot bypass the live
freeze gate. See GUIDE.md's "Course readiness" section for the
plain-language, author-facing view of these same issue codes.

### Frozen revisions and review

A frozen revision records an immutable course graph, a monotonically increasing
version, exact source IDs and SHA-256 hashes, approved Course Assistant Q&A, and
optional author notes. Creating a review URL rotates a high-entropy token; only
its SHA-256 is stored. Reviewers see the frozen snapshot and can attach feedback
to a lesson or deterministic assistant interaction. Chapter and final
assessment payloads sent to review and (once a public delivery surface
exists) learner clients never include `isCorrect`, per-answer feedback, or
explanations; only server-side grading and the authenticated author preview
receive the full answer-key projection.

### SCORM export

SCORM export is a background job created from a frozen revision. The worker
loads the immutable course and approved assistant, copies referenced media from
local filesystem storage, builds a standalone Moto Player, writes the SCORM 1.2
manifest, writes the ZIP to local filesystem storage, and records it for
authenticated download.

The exported player runs without Next.js, PostgreSQL, local storage, the parser
service, or OpenAI. It reports bookmark, lesson status, final score, session time, and
completion through the LMS SCORM 1.2 API.

### Analytics

The separately password-gated analytics surface summarizes stored sessions,
hotspot exploration, quiz attempts and score bands, lesson view counts, and
weak-topic metadata. It is an internal dashboard, not tenant-aware reporting.

## Architecture

```text
Author or reviewer browser
        |
        v
apps/web — Next.js Course Studio, Moto Player, review, analytics, HTTP APIs
   |             |                         |
   |             |                         +--> Local filesystem storage
   |             |                              assets, sources, SCORM ZIPs
   |             |
   |             +--> PostgreSQL durable job queue
   |                         |
   |                         v
   |                  apps/job-worker
   |                    |           |
   |                    |           +--> packages/scorm-export
   |                    |
   |                    v
   |          packages/parser-client
   |                    |
   |                    v
   |          services/parser-service — private FastAPI service
   |                    |                    |
   |                    v                    v
   |                  OpenAI              ChromaDB
   |
   +--> PostgreSQL — courses, sources, revisions, reviews, progress, jobs

Exported SCORM ZIP --> LMS SCORM 1.2 API
```

The browser never connects directly to PostgreSQL, local storage, ChromaDB, or
the parser service. The parser service is an internal authoring boundary; its
token and OpenAI key must never be exposed to browser code.

## Repository structure

```text
.
├── apps/
│   ├── web/                    Next.js application and shared Moto Player
│   └── job-worker/             Long-running PostgreSQL queue consumer
├── packages/
│   ├── contracts/              Shared TypeScript and Zod contracts
│   ├── database/               Prisma schema, migrations, client, repositories
│   ├── jobs/                   Queueing, leasing, retries, status, retention
│   ├── parser-client/          Typed private FastAPI client
│   ├── scorm-export/           Standalone player and SCORM 1.2 package builder
│   └── storage/                Local filesystem storage client
├── services/
│   └── parser-service/         Native Python FastAPI, OpenAI, and Chroma service
├── scripts/
│   ├── run-workspace.mjs       Root environment loading and workspace delegation
│   └── seed-moto-g87-course.ts Development course seeding utility
├── docs/superpowers/           Historical implementation plans and design records
├── .env.example                Database and non-secret service configuration
├── .env.local.example          Local passwords, tokens, and local storage root
└── package.json                Root workspace commands
```

### Ownership boundaries

| Area                      | Owns                                                                                                                             |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web`                | App Router pages and APIs, Course Studio UI, author preview, review, analytics, learner rendering, feature-owned server commands |
| `apps/job-worker`         | Durable asynchronous execution and registered job handlers                                                                       |
| `packages/contracts`      | Cross-workspace request, response, course, assistant, quiz, generation, and job schemas                                          |
| `packages/database`       | PostgreSQL schema, migrations, Prisma client, and domain repositories                                                            |
| `packages/jobs`           | Enqueueing, deduplication, leases, retries, cleanup, and public job status                                                       |
| `packages/parser-client`  | Authenticated parser requests, timeouts, error normalization, and response validation                                            |
| `packages/scorm-export`   | Standalone browser bundle, SCORM bridge, manifest, asset rewriting, and ZIP creation                                             |
| `packages/storage`        | Local filesystem object storage operations                                                                                       |
| `services/parser-service` | Document extraction, embeddings, Chroma retrieval, and OpenAI-backed authoring drafts                                            |

## Data ownership

| System                   | Data                                                                                                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PostgreSQL               | Editable course graph, trash, source metadata, frozen revisions, review tokens and feedback, approved Q&A, learner sessions, progress, quiz attempts, jobs, and export records |
| Local filesystem storage | Course media, immutable source bytes, and generated SCORM ZIPs                                                                                                                 |
| ChromaDB                 | Source chunks and OpenAI embeddings scoped by course and source identity                                                                                                       |
| OpenAI                   | On-demand embedding and authoring-generation requests sent by the private parser service                                                                                       |
| Browser storage          | Preview state and the future learner session identifier; preview does not persist server-side progress                                                                         |
| LMS                      | SCORM bookmark, score, lesson status, session time, and completion state for exported packages                                                                                 |

## Runtime processes

Moto AI is not one process. Local development and production require
independently supervised services.

| Process                  | Command                                  | Required for                                                                        |
| ------------------------ | ---------------------------------------- | ----------------------------------------------------------------------------------- |
| Next.js web              | `npm run dev` or `npm start`             | Studio, preview, review, analytics, HTTP APIs, downloads                            |
| Job worker               | `npm run jobs:worker`                    | Source indexing, Q&A drafting, AI course drafting, SCORM export, course duplication |
| Parser service           | `python -m moto_parser`                  | Document indexing and optional OpenAI-backed authoring operations                   |
| PostgreSQL               | Platform-specific                        | Application state, revisions, progress, and durable jobs                            |
| ChromaDB                 | Embedded in parser service               | Persistent source embeddings and retrieval                                          |
| Local filesystem storage | Local disk, shared by web app and worker | Media, source bytes, and export artifacts                                           |

If the worker or parser is stopped, queued background operations remain pending;
ordinary non-background Studio and review features can continue as long as their
own database and storage dependencies are available.

## Prerequisites

- Node.js 20 or later.
- npm with support for the committed lockfile.
- PostgreSQL reachable through both configured Prisma URLs.
- Python 3.11 or later for the parser service.
- A local filesystem directory, readable and writable by both the web app and
  the job worker, for media, source, and export flows.
- An OpenAI API project with billing enabled when source indexing or AI
  authoring is required.

The web application can be developed without invoking OpenAI, but parser
startup requires both `PARSER_SERVICE_TOKEN` and `OPENAI_API_KEY`.

## Initial setup

### 1. Install the Node workspaces

```bash
cp .env.example .env
cp .env.local.example .env.local
npm ci
```

`npm ci` runs the root `postinstall` hook, which generates the Prisma client.
Replace every placeholder in the copied environment files before starting the
application. Never commit `.env`, `.env.local`, or parser credentials.

### 2. Create and migrate PostgreSQL

Create the database named by `DATABASE_URL` and `DIRECT_URL`, then run:

```bash
npm run db:migrate
```

For local schema development that intentionally creates a migration:

```bash
npm run db:migrate:dev
```

Committed environments and deployments should use `db:migrate`.

### 3. Install the parser service

```bash
cd services/parser-service
python3 -m venv venv
source venv/bin/activate
pip install -e '.[dev]'
cp .env.example .env
```

Set `OPENAI_API_KEY` and make the parser's `PARSER_SERVICE_TOKEN` exactly match
the value in root `.env.local`. The dedicated
[parser-service README](services/parser-service/README.md) documents its HTTP
contracts and configuration boundary.

### 4. Build the standalone SCORM player

From the repository root:

```bash
npm run build --workspace=@moto-ai/scorm-export
```

Set `SCORM_PLAYER_BUNDLE_PATH` in `.env` to the absolute path of
`packages/scorm-export`. The worker expects generated files under that
directory's `dist/` folder.

## Environment variables

### Root `.env`

Copy `.env.example` to `.env`.

| Variable                      | Required              | Purpose                                                                          |
| ----------------------------- | --------------------- | -------------------------------------------------------------------------------- |
| `DATABASE_URL`                | Yes                   | Pooled/runtime PostgreSQL URL; local development may use the direct server URL   |
| `DIRECT_URL`                  | Yes                   | Direct PostgreSQL URL used by Prisma migrations                                  |
| `PARSER_SERVICE_URL`          | For parser operations | Internal FastAPI base URL; the client defaults to `http://localhost:8000`        |
| `JOB_WORKER_POLL_INTERVAL_MS` | No                    | Worker idle polling interval; defaults to `1000` milliseconds                    |
| `SCORM_PLAYER_BUNDLE_PATH`    | For SCORM export      | Absolute path to `packages/scorm-export`, containing the built `dist/` directory |

### Root `.env.local`

Copy `.env.local.example` to `.env.local`.

| Variable                 | Required              | Purpose                                                                                                                                           |
| ------------------------ | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `COURSE_STUDIO_PASSWORD` | Yes                   | Shared internal authoring password                                                                                                                |
| `ANALYTICS_PASSWORD`     | For analytics         | Separate shared dashboard password                                                                                                                |
| `AUTH_SESSION_SECRET`    | Yes                   | Signs Course Studio and analytics session cookies; 32+ random bytes, e.g. `openssl rand -hex 32`. Rotating it invalidates every existing session. |
| `PARSER_SERVICE_TOKEN`   | For parser operations | Internal bearer token shared with the parser service                                                                                              |
| `LOCAL_STORAGE_ROOT`     | For storage           | Absolute path to the shared local storage directory                                                                                               |

The root workspace runner loads `.env.local` before `.env` for the web app and
job worker.

### Parser `services/parser-service/.env`

Copy `services/parser-service/.env.example` to
`services/parser-service/.env`.

| Variable                 | Required | Default or purpose                                               |
| ------------------------ | -------- | ---------------------------------------------------------------- |
| `PARSER_SERVICE_TOKEN`   | Yes      | Must exactly match root `.env.local`                             |
| `OPENAI_API_KEY`         | Yes      | Server-only OpenAI credential                                    |
| `OPENAI_CHAT_MODEL`      | No       | `gpt-5.4-mini`                                                   |
| `OPENAI_EMBEDDING_MODEL` | No       | `text-embedding-3-small`                                         |
| `CHROMA_DIR`             | No       | `./chroma_db`, resolved relative to the parser-service directory |
| `OPENAI_TIMEOUT_SECONDS` | No       | `120`                                                            |
| `RELEVANCE_THRESHOLD`    | No       | `0.45` for cosine relevance                                      |
| `CHUNK_SIZE`             | No       | `1000` characters                                                |
| `CHUNK_OVERLAP`          | No       | `200` characters                                                 |
| `VECTORSTORE_CACHE_SIZE` | No       | `50` cached per-course Chroma wrappers                           |
| `PARSER_PORT`            | No       | `8000`; must be 1024 or higher                                   |

## Running locally

Use separate terminals so failures and logs remain attributable to one runtime.

### Terminal 1: parser service

```bash
cd services/parser-service
source venv/bin/activate
python -m moto_parser
```

The parser listens on `http://127.0.0.1:8000` by default. Check readiness with:

```bash
curl http://127.0.0.1:8000/health
```

Swagger is available at `http://127.0.0.1:8000/docs` during local development.
Every parser endpoint except `/health` requires `X-Internal-Token`.

### Terminal 2: job worker

```bash
npm run jobs:worker
```

The worker uses PostgreSQL for durable queue state. It claims work with leases,
refreshes active leases, retries transient failures up to three attempts, and is
configured to clean up terminal jobs after seven days.

Registered handlers currently cover:

- document indexing;
- Course Assistant Q&A draft generation;
- editable course generation;
- SCORM export; and
- exact course duplication (`BackgroundJobKind.COURSE_DUPLICATE`, public job
  kind `course_duplicate`), which copies media, graph, and assessment data
  without calling the parser service or OpenAI.

### Terminal 3: web application

```bash
npm run dev
```

Open `http://localhost:3000`. The root URL redirects to `/studio`.

| Surface             | Local path           |
| ------------------- | -------------------- |
| Course Studio login | `/studio/login`      |
| Course library      | `/studio`            |
| Course workspace    | `/studio/[courseId]` |
| Frozen review       | `/review/[token]`    |
| Analytics login     | `/analytics/login`   |
| Analytics dashboard | `/analytics`         |

There is no public `/course/[slug]` page.

## Root commands

| Command                                           | Purpose                                                               |
| ------------------------------------------------- | --------------------------------------------------------------------- |
| `npm run dev`                                     | Start the Next.js development server                                  |
| `npm run jobs:worker`                             | Start the durable background worker                                   |
| `npm run build`                                   | Apply committed Prisma migrations, then build the Next.js application |
| `npm start`                                       | Start the built Next.js application                                   |
| `npm run lint`                                    | Lint application, package, and script source                          |
| `npm run typecheck`                               | Type-check every workspace exposing a typecheck script                |
| `npm run format`                                  | Write Prettier formatting changes across the repository               |
| `npm run db:generate`                             | Generate the Prisma client                                            |
| `npm run db:migrate`                              | Apply committed Prisma migrations                                     |
| `npm run db:migrate:dev`                          | Create or apply a development migration                               |
| `npm run db:studio`                               | Open Prisma Studio                                                    |
| `npm run build --workspace=@moto-ai/scorm-export` | Build the standalone SCORM player bundle                              |

`npm run format` is not a read-only check. To inspect formatting without
changing files, run Prettier directly with `--check` and an explicit path.

## HTTP surfaces

The Next.js application owns these API families:

| API family                      | Purpose                                                                                                                                                              | Access model                                                  |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `/api/course-studio/*`          | Authoring CRUD, assets, sources, Q&A, chapter/final assessments, template-based course creation, course duplication, revisions, generation, review creation, exports | Course Studio password session                                |
| `/api/course-assets/*`          | Local-storage-backed media delivery                                                                                                                                  | Asset URL capability                                          |
| `/api/reviews/[token]/feedback` | Feedback against one frozen review                                                                                                                                   | Review-link token                                             |
| `/api/jobs/[id]`                | Browser polling for asynchronous work                                                                                                                                | Job identifier                                                |
| `/api/progress`                 | Session progress read/write                                                                                                                                          | Browser session identifier; public learner flow is unfinished |
| `/api/quiz/grade`               | Server-side authored or generated quiz grading                                                                                                                       | Quiz identity; public learner flow is unfinished              |
| `/api/analytics/*`              | Analytics login and weak-topic calculation                                                                                                                           | Internal analytics surface                                    |

The parser service owns:

| Method   | Path                         | Purpose                                                    |
| -------- | ---------------------------- | ---------------------------------------------------------- |
| `POST`   | `/api/upload`                | Parse and index one immutable source                       |
| `POST`   | `/api/generate-assistant-qa` | Produce source-cited authoring drafts                      |
| `POST`   | `/api/generate-course`       | Produce a validated editable course draft                  |
| `POST`   | `/api/generate-quiz`         | Produce a supplemental quiz draft; not wired to the worker |
| `DELETE` | `/api/document`              | Remove chunks for one source identity                      |
| `GET`    | `/health`                    | Report OpenAI configuration and Chroma writability         |

## Authentication and trust boundaries

- Course Studio and analytics use separate shared passwords and HTTP-only
  cookies. This is an internal single-team model, not user accounts or RBAC.
- Review URLs are bearer capabilities for one immutable revision. Treat them as
  sensitive even though the database stores only their hashes.
- The parser must remain on a private network and requires the shared
  `X-Internal-Token` for every non-health request.
- OpenAI credentials are server-only.
- Local storage is not served directly; application URLs mediate asset and
  export delivery.
- SCORM packages contain frozen course content, approved offline assistant Q&A,
  media, and assessment answer keys. Distribute them as controlled learning
  artifacts.

## Database and migrations

Prisma schema and committed migrations live under
`packages/database/prisma/`.

- `DATABASE_URL` is used for runtime queries.
- `DIRECT_URL` is used for migrations.
- `npm run build` intentionally runs `npm run db:migrate` before the Next.js
  build. A build therefore requires a reachable database and is not a purely
  offline compilation command.
- The job worker and web app must use the same PostgreSQL database.

Before changing queries because of a `P1001` error, verify that PostgreSQL is
actually listening at the configured host and port.

## Validation and release checks

The repository currently uses static, package, build, and manual acceptance
evidence rather than an automated test suite.

Run the non-destructive checks:

```bash
npm run typecheck
npm run lint
npx prettier --check README.md
npm ci --dry-run --ignore-scripts
npm ls --workspaces --depth=0
npx prisma validate --schema packages/database/prisma/schema.prisma
git diff --check
```

Validate the parser from `services/parser-service` with its virtual environment:

```bash
venv/bin/ruff check src
venv/bin/ruff format --check src
venv/bin/mypy src
venv/bin/python -m compileall -q src
venv/bin/python -m pip check
```

Build both delivery artifacts:

```bash
npm run build --workspace=@moto-ai/scorm-export
npm run build
```

Because the root build applies migrations, verify PostgreSQL before running it.
Before release, manually exercise:

1. Studio login and course load.
2. Course settings and lesson save/reload.
3. Media upload and rendering.
4. Source upload, indexing, retry, and deletion.
5. Q&A drafting, approval, and deterministic assistant matching.
6. Frozen revision creation and immutable review rendering.
7. Review feedback creation and Studio resolution.
8. AI course generation from a frozen source revision, when authorized.
9. SCORM export, authenticated download, LMS import, bookmarking, score, and
   completion reporting.
10. Analytics login and expected reporting data.

## Deployment guide

Deploy the runtimes independently even when they share one repository.

### Web application

- Install with the committed lockfile.
- Provide root `.env` and `.env.local` values through the deployment platform.
- Ensure PostgreSQL is reachable before `npm run build`, because the build
  applies migrations.
- Run `npm start` from the built workspace.
- Terminate TLS at the platform or reverse proxy.

### Job worker

- Run `npm run jobs:worker` as a continuously supervised process.
- Use the same PostgreSQL, parser URL and token, and local storage root as the
  web app.
- Build `@moto-ai/scorm-export` during the worker image or build phase.
- Set `SCORM_PLAYER_BUNDLE_PATH` to the deployed package directory.
- Restart automatically after process failure and monitor queue age, retries,
  and failed jobs.

### Parser service

- Install the native Python package from `pyproject.toml`.
- Run it on a private network; do not expose parser routes publicly.
- Provide the matching parser token and OpenAI credential through a secret
  manager.
- Mount durable storage for `CHROMA_DIR` if source embeddings must survive
  restarts or redeployments.
- Monitor `/health`, request latency, OpenAI errors, and Chroma capacity.

### PostgreSQL

- Use a pooled `DATABASE_URL` for runtime traffic and a direct `DIRECT_URL` for
  migrations.
- Back up course, revision, review, progress, job, and export metadata.
- Run one controlled migration step per deployment rather than allowing several
  replicas to race the same migration command.

### Local filesystem storage

- Mount `LOCAL_STORAGE_ROOT` on durable, backed-up storage shared by the web
  app and job worker.
- Keep the directory off any public web root; it is only ever served through
  the application's own API routes.
- Define retention and cleanup policies for abandoned assets, source bytes, and
  SCORM exports before production use.

### Release order

1. Validate configuration and backups.
2. Build the SCORM player bundle.
3. Apply Prisma migrations once.
4. Deploy the parser service and verify `/health`.
5. Deploy or restart the worker.
6. Deploy the web application.
7. Perform the manual acceptance checklist.

The database migration must land before the worker or web app is restarted:
the `Course` table's template/duplication columns and the
`COURSE_DUPLICATE` background-job kind are additive, but a worker or web
process running against the pre-migration schema cannot read or write them.
Deploy in migration → worker → web order; deploying the web application
before the worker is restarted on a compatible schema leaves duplication
requests queued until the worker catches up, rather than failing. Deploying
the web app before the migration lands is worse than that: `studio-loaders.ts`
queries `BackgroundJobKind.COURSE_DUPLICATE` unconditionally on every
`/studio` page load, so Postgres rejects the unknown enum literal and the
entire course library page fails to load, not just duplication.

## Troubleshooting

### Prisma `P1001`

PostgreSQL is not reachable at the configured host and port. Check the database
service and listener before changing application queries. Confirm both
`DATABASE_URL` and `DIRECT_URL` target the intended database.

### Background operation stays queued

- Confirm `npm run jobs:worker` is running.
- Confirm the web app and worker use the same PostgreSQL database.
- Confirm the parser URL is reachable from the worker.
- Confirm the root and parser `PARSER_SERVICE_TOKEN` values match.
- Check the job status and worker log for retry or configuration errors.

### Parser will not start

- Confirm `services/parser-service/.env` exists.
- Set both `PARSER_SERVICE_TOKEN` and `OPENAI_API_KEY`.
- Confirm `CHROMA_DIR` is writable.
- Use Python 3.11 or later and the parser's virtual environment.
- If port 8000 is occupied, set `PARSER_PORT` to an available port at or above
  1024 and update `PARSER_SERVICE_URL` accordingly.

### Login rejects the correct password

Check that `AUTH_SESSION_SECRET` is set. An unset secret makes both logins
fail closed even when the password is correct; the login page shows a
distinct "Server misconfiguration" message (`?error=config`) for this case,
but it is still worth confirming the variable is set and checking the server
log for the `AUTH_SESSION_SECRET is not set` message.

### SCORM export reports missing configuration

Build the standalone player and verify `SCORM_PLAYER_BUNDLE_PATH` points to the
`packages/scorm-export` directory containing `dist/player.js`,
`dist/player.css`, and the bundled fonts.

### Asset or export storage fails

Verify `LOCAL_STORAGE_ROOT` is set and points to a directory both `apps/web`
and `apps/job-worker` can read from and write to.

## Current limitations

- There is no public learner-delivery page at `/course/[slug]`.
- Persisted browser learner progress has not been accepted through a real
  public learner flow.
- Authentication is shared-password based; there are no user accounts, roles,
  tenant boundaries, password recovery, or identity-provider integration.
- Parser quiz generation is not registered as a background-worker workflow.
- The web app, worker, parser, PostgreSQL, Chroma persistence, and local
  filesystem storage must be operated as separate dependencies.
- Production exposure requires dedicated security, retention, monitoring, and
  runtime acceptance work beyond a successful static build.

### Production-readiness gates

The current implementation has known hardening work that should be resolved
before external production exposure:

- restrict uploaded media types and isolate asset delivery from authenticated
  application pages;
- align authorization across analytics and job-status APIs;
- reconcile queue cleanup with retained course-generation and SCORM-export
  records;
- make SCORM export completion idempotent across retries and lease recovery;
- make parser source replacement atomic and bind retrieval to frozen hashes;
- align relative course-asset URLs with Course Settings validation;
- bind progress and quiz persistence to a legitimate learner session and course;
- add course ownership and recurring orphan cleanup for course assets (a
  one-time cleanup script exists today; see `scripts/cleanup-orphaned-course-assets.ts`); and
- update production dependencies reported by `npm audit` before release.

## Development principles

- Learning purpose, pacing, feedback, and clarity take priority over generic UI
  novelty.
- Editable authoring state and immutable delivery revisions must remain separate.
- AI output is a proposal, never an authority or automatic publication event.
- Source selection and frozen hashes define the grounding boundary.
- Browser code must not import database, storage, queue, parser, or credentialed
  infrastructure clients.
- Preserve stable course, chapter, lesson, and revision identities because
  review, progress, analytics, and SCORM bookmarks depend on them.
- Keep external service calls behind typed server boundaries and validate
  untrusted responses before persistence.
