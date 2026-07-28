# Moto AI Course Studio

Moto AI is an app-owned e-learning authoring and delivery platform. Course Studio creates and previews learning experiences with the same Moto Player used by learners. PostgreSQL owns course structure, authoring state, reviews, progress, and quiz records; Cloudflare R2 owns course media.

The downstream localization package used by Motorola partners is intentionally not hardcoded yet. Approved, immutable course revisions are the future adapter boundary once the agency workflow and Articulate 360 handoff requirements are confirmed.

## Architecture

```text
Course Studio (/studio) ───────┐
                               ├── PostgreSQL (courses, revisions, reviews, progress)
Moto Player (/course/[slug]) ──┘
             │
             ├── Cloudflare R2 (images, video, source assets)
             └── Next.js APIs ──► durable job worker ──► FastAPI parser / local AI
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
- `/studio/[courseId]` — authored outline and non-persistent Moto Player preview.
- `/analytics` — learning analytics.

Course Studio preview never writes learner progress. Static authored quiz answer keys remain server-side in PostgreSQL; the browser receives only the question and answer-option text.

## Environment

Create the root defaults and the separate local-secret file:

```bash
cp .env.example .env
cp .env.local.example .env.local
```

`.env` owns the database URLs and non-secret service defaults. `.env.local`
owns application secrets and R2 credentials:

```env
DATABASE_URL="postgresql://<user>:<password>@localhost:5432/moto_ai_dev"
DIRECT_URL="postgresql://<user>:<password>@localhost:5432/moto_ai_dev"

COURSE_STUDIO_PASSWORD="<strong-authoring-password>"

R2_ACCOUNT_ID="<cloudflare-account-id>"
R2_ACCESS_KEY_ID="<r2-access-key-id>"
R2_SECRET_ACCESS_KEY="<r2-secret-access-key>"
R2_BUCKET="<course-studio-bucket>"

PARSER_SERVICE_URL="http://localhost:8000"
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

Start the web app:

```bash
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

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Next.js application |
| `npm run jobs:worker` | Start the durable background worker |
| `npm run build` | Apply Prisma migrations and build Next.js |
| `npm run lint` | Run the repository linter |
| `npm run typecheck` | Type-check every TypeScript workspace |
| `npm run db:migrate` | Apply committed Prisma migrations |
| `npm run db:migrate:dev` | Create and apply a development migration |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run db:studio` | Open Prisma Studio |

`npm run build` requires the configured PostgreSQL database to be reachable because migrations run before the Next.js build.

## Data ownership

- Course, chapter, lesson, authored quiz, revision, review, and feedback identity is durable in PostgreSQL.
- Course images and videos are stored in Cloudflare R2 and referenced by Postgres metadata.
- Learner progress keeps stable course and lesson IDs across authoring revisions.
- Source documents are indexed by the parser service; the worker records indexing receipts in `Course.sourceFiles`.
- AI-generated quiz answer keys and authored quiz answer keys never leave server-side storage.

Remote legacy source data is not part of the runtime and is not deleted by this repository.
