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

Ollama and every other local-model runtime are unsupported in this repository.
Authoring AI is directed by the project owner and, when enabled, uses the
configured OpenAI API service; nothing in the application downloads, starts,
or depends on a local model.

## What is implemented

- **Course Studio** — password-protected course creation and editing, chapters,
  lessons, media assets, source files, and structured learning content.
- **Moto Player** — an author preview and frozen-review player for content,
  interactions, product stages, video, quizzes, split screens, drag and drop,
  colour switching, scroll stories, and canvas lessons.
- **Source-grounded authoring** — owned source files can be uploaded and
  indexed; the system can draft Course Assistant Q&A and an editable course
  graph from explicitly selected, indexed sources. Authors review and approve
  the results before they can become part of a frozen revision.
- **Frozen review** — authors freeze a master revision and create a review URL
  that renders only that snapshot and accepts review feedback.
- **Analytics** — a separately protected dashboard reads stored progress,
  assessment, and weak-topic data when it exists.

There is intentionally no public learner-delivery page or browser-verified
persisted learner-progress flow at `/course/[slug]`. Preview and review are not
a substitute for that future delivery surface.

## Architecture

```text
Browser
  -> Next.js web app (Course Studio, player, review, analytics, APIs)
       -> PostgreSQL (courses, revisions, progress, durable jobs)
       -> Cloudflare R2 (private course assets and source files)
       -> job worker -> private parser service -> OpenAI and ChromaDB
```

The browser never connects directly to PostgreSQL, R2, or the parser service.
The parser service is authoring-only. Its retrieval is explicitly scoped to the
requested course and source IDs; an empty source set does not search the whole
course corpus.

| Area                      | Responsibility                                                        |
| ------------------------- | --------------------------------------------------------------------- |
| `apps/web`                | Next.js application: Studio, player, review, analytics, and HTTP APIs |
| `apps/job-worker`         | Long-running consumer for the PostgreSQL durable-job queue            |
| `packages/database`       | Prisma schema, migrations, database client, and repositories          |
| `packages/contracts`      | Shared TypeScript contracts and validation schemas                    |
| `packages/jobs`           | Queueing, leasing, retries, status, and retention                     |
| `packages/parser-client`  | Typed internal client for the parser service                          |
| `services/parser-service` | Private FastAPI source-processing and authoring-draft service         |

## Local development

Requirements: Node.js 20+, PostgreSQL, Python 3.11+, and an OpenAI API project
for authoring-only source processing and AI drafts.

Create local environment files from the templates and set the placeholder
values. Do not commit either local environment file.

```bash
cp .env.example .env
cp .env.local.example .env.local
npm ci
npm run db:generate
npm run db:migrate
```

Run these processes in separate terminals.

### 1. Web app

```bash
npm run dev
```

The app is available at `http://localhost:3000`; the root URL redirects to the
Studio. Authoring requires `COURSE_STUDIO_PASSWORD`; analytics uses the distinct
`ANALYTICS_PASSWORD`.

### 2. Parser service

```bash
cd services/parser-service
python3 -m venv venv
source venv/bin/activate
pip install -e '.[dev]'
python -m moto_parser
```

The development service listens on `http://127.0.0.1:8000` by default. Its
`PARSER_SERVICE_TOKEN` must match the root application's value. See the
[parser-service README](services/parser-service/README.md) for endpoint and
configuration details.

### 3. Durable job worker

```bash
npm run jobs:worker
```

The worker polls the PostgreSQL queue every second by default
(`JOB_WORKER_POLL_INTERVAL_MS` changes the interval). It handles:

- document indexing after source upload;
- Course Assistant Q&A draft generation; and
- editable course-draft generation from a frozen source revision.

Jobs are deduplicated, leased for safe recovery, retried for transient errors
up to three times, and retained for seven days after completion or failure. If
the worker is stopped, these operations remain queued; the web app continues to
serve non-background features. Supplemental quiz generation exists at the
parser-service boundary, but no quiz-generation job handler is currently
registered in this worker.

## Commands

| Command               | Purpose                                           |
| --------------------- | ------------------------------------------------- |
| `npm run dev`         | Start the Next.js web application                 |
| `npm run jobs:worker` | Start the durable background-job worker           |
| `npm run lint`        | Lint application, package, and script source      |
| `npm run typecheck`   | Type-check all workspaces that expose the command |
| `npm run db:generate` | Generate the Prisma client                        |
| `npm run db:migrate`  | Apply committed Prisma migrations                 |
| `npm run build`       | Apply migrations, then build the web application  |
| `npm start`           | Start the built web application                   |

`npm run format` writes formatting changes; use it deliberately rather than as
a read-only check.

## Deployment

Deploy and supervise the web app, PostgreSQL database, job worker, and private
parser service as separate runtime processes. Keep R2 private and provide
credentials and secrets through the deployment platform rather than committed
files. The full operational guidance and release checks are in the
[deployment guide](DEPLOYMENT.md).
