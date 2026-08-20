# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Moto AI Course Studio is an app-owned e-learning authoring platform. Authors
create an English learning master in Course Studio; the shared Moto Player
renders that content in the author preview and in immutable, shareable review
links. Authored course content is the source of truth — AI only assists
authors by processing approved source material into editable drafts that a
human must review and approve. There is intentionally no public
learner-delivery page at `/course/[slug]` yet; preview and review are not a
substitute for that future surface.

The learner-facing Course Assistant answers only from author-approved Q&A
frozen into a revision, using deterministic local matching with a fallback.
It never calls the parser service or an AI model at runtime — only authoring
flows do.

## Architecture

```text
Browser
  -> Next.js web app (Course Studio, player, review, analytics, APIs)
       -> PostgreSQL (courses, revisions, progress, durable jobs)
       -> Cloudflare R2 (private course assets and source files)
       -> job worker -> private parser service -> OpenAI and ChromaDB
```

The browser never talks to PostgreSQL, R2, or the parser service directly —
everything goes through the Next.js app's API routes. The parser service is
authoring-only and its retrieval is explicitly scoped to the requested course
and source IDs; an empty source set never falls back to searching the whole
course corpus.

| Area                      | Responsibility                                                       |
| ------------------------- | -------------------------------------------------------------------- |
| `apps/web`                | Next.js app: Studio, player, review, analytics, HTTP APIs            |
| `apps/job-worker`         | Long-running consumer for the PostgreSQL durable-job queue           |
| `packages/database`       | Prisma schema, migrations, database client, repositories             |
| `packages/contracts`      | Shared TypeScript contracts and Zod validation schemas               |
| `packages/jobs`           | Queueing, leasing, retries, status, retention                        |
| `packages/parser-client`  | Typed internal client for the parser service                         |
| `services/parser-service` | Private FastAPI source-processing / authoring-draft service (Python) |

### `apps/web/src` layout

- `authoring/` — Course Studio UI (outline, inspectors, source panel, AI
  generation dialogs) and its client/server helpers.
- `learning/` — the Moto Player itself: `player/` holds the renderer and
  per-lesson-type components, plus `course-flow.ts`, `course-structure.ts`,
  `course-content.ts`, `quiz-session.ts` for course/lesson graph logic shared
  across preview, review, and (eventually) delivery.
- `review/` — the frozen, read-only review surface and feedback panel.
- `analytics/` — separately password-protected dashboard reading stored
  progress/assessment data.
- `server/` — auth (`server/auth`), background job status (`server/jobs`),
  and R2 asset storage (`server/storage`) helpers used by API routes.
- `shared/` — cross-surface UI (theme, error boundary, portable text) and
  utils.
- `app/` — Next.js App Router routes (`studio`, `review`, `analytics`,
  `course`, `api`).

### Data model (`packages/database/prisma/schema.prisma`)

Course authoring uses caller-provided String IDs (not autoincrement) so
revisions keep stable references across authoring and learner surfaces.
Key relationships to know before touching this schema:

- `Course` → `CourseChapter` → `CourseLesson` is the live, editable authoring
  graph. `CourseQuiz` is separately addressable (chapter quick-checks and a
  course final quiz) because server-side grading needs direct quiz IDs.
- `CourseSourceFile` is the course-scoped inventory/indexing lifecycle for
  bytes that live in R2; `CourseSourceBinding` lets a course inherit an
  immutable source identity without copying the R2 object.
- `CourseRevision` is an **immutable** learner-ready snapshot (JSON) used for
  review/approval — it freezes `CourseRevisionSource` and
  `CourseRevisionAssistantQa` copies so a later edit to the live graph or
  source never changes what a reviewer already approved.
- `CourseReview` grants read-only access to exactly one revision via a
  token that is stored only **hashed** (the raw review URL cannot be
  reconstructed from the DB).
- `BackgroundJob` (+ `JobArtifact`) is the durable queue backing
  `apps/job-worker`: dedupe key is unique only while a job is active, leasing
  supports safe recovery, and uploaded bytes live with the job artifact until
  indexing succeeds so work survives a process restart.
- `CourseGeneration` is durable work provenance for AI course generation, not
  a partially-created course — the `createdCourseId` relation only populates
  once a validated graph is written.

## Commands

```bash
npm ci                 # install
npm run db:generate     # generate Prisma client (also runs on postinstall)
npm run db:migrate      # apply committed Prisma migrations (deploy)
npm run db:migrate:dev  # create/apply a new migration in dev
npm run db:studio       # Prisma Studio

npm run dev             # start the Next.js web app (apps/web) at :3000
npm run jobs:worker     # start the durable background-job worker

npm run lint             # eslint over apps, packages, scripts
npm run typecheck        # tsc --noEmit across every workspace that has it
npm run format            # prettier --write . (writes; not a check)

npm run build            # db:migrate, then build apps/web
npm start                 # start the built web app
```

`npm run dev` / `npm run jobs:worker` / `npm run build` / `npm start` are
thin wrappers around `scripts/run-workspace.mjs`, which runs the named
workspace's own script — don't `cd` into `apps/web` to run these, use the
root npm scripts.

There is no root JS/TS test runner configured (`npm run lint` and
`npm run typecheck` are the checks that exist). Adding one is real setup
work, not a missing script to guess at — confirm with the user first.

### Parser service (Python, `services/parser-service`)

```bash
cd services/parser-service
python3 -m venv venv && source venv/bin/activate
pip install -e '.[dev]'
python -m moto_parser        # dev server w/ reload, http://127.0.0.1:8000
```

- Tests: `python -m unittest discover -s tests` (from within the activated
  venv — `unittest`, not `pytest`).
- Lint/format: `ruff check .` / `ruff format .` (line length 100,
  `E`/`F`/`I`/`UP`/`B` rules, first-party import group is `moto_parser`).
- Types: `mypy src` (strict-ish subset — `disallow_untyped_defs`,
  `warn_return_any` are on; being incrementally tightened, don't relax them).
- `PARSER_SERVICE_TOKEN` in this service's env must match the root app's
  value or every non-`/health` request will be rejected with 401.
- All endpoints except `GET /health` require `X-Internal-Token` and are only
  ever called by `packages/parser-client` (worker/server side) — never wire
  a browser call to this service.

## Working in this repo

- Two auth surfaces guard different things and are intentionally distinct:
  `COURSE_STUDIO_PASSWORD` gates authoring (`server/auth/course-studio.ts`),
  `ANALYTICS_PASSWORD` gates the analytics dashboard. Don't conflate them.
- `.env` holds values Prisma loads directly plus non-secret local defaults;
  `.env.local` holds the rest (API keys, tokens, R2 config). Both are
  git-ignored — never commit either, and mirror new variables into
  `.env.example` / `.env.local.example` when you add config.
- Generation and Q&A jobs always carry explicit source IDs end-to-end
  (contracts → job payload → parser-service request). An empty `sourceIds`
  list must stay empty context, never silently expand to "all sources in
  the course" — this is a deliberate scoping guarantee, not an oversight to
  "fix".
- `CourseRevision.snapshot` and the `CourseRevision*` copy tables exist so a
  frozen/reviewed revision never mutates when the live authoring graph
  changes later. If you're editing revision-freeze logic, preserve that
  immutability rather than optimizing away the copy.
- ESLint enforces `@typescript-eslint/no-explicit-any` as an error (not just
  the Next.js default warn) — don't introduce `any` to silence a type error.
- Shared types/schemas live in `packages/contracts` and are imported by both
  `apps/web` and `apps/job-worker` (e.g. `@moto-ai/contracts/jobs`); add new
  cross-package payload shapes there rather than duplicating them.
- `apps/job-worker/src/handlers.ts` is the single dispatch point
  (`executeJob`) for every background job kind; a `NonRetryableJobError`
  short-circuits retries and writes a failure message straight to the DB
  record the user sees, so its message must be UI-appropriate copy, not a
  debug string.
