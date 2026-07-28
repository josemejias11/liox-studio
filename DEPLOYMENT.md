# Deployment Guide

Moto AI runs as four cooperating services:

```text
Browser ──► Next.js web app ──► PostgreSQL
                    │              ▲
                    ├──► R2        │
                    │              │
                    └──► job worker ──► parser service ──► Ollama + ChromaDB
```

- PostgreSQL is the source of truth for authored courses, immutable revisions, review feedback, learner progress, jobs, and asset metadata.
- A private Cloudflare R2 bucket stores course media and source files.
- The Next.js app owns Course Studio, the learner player, review surfaces, and authenticated asset delivery.
- The worker and parser service handle document indexing, grounded chat, and generated quizzes.

The browser never connects directly to PostgreSQL, R2, or the parser service.

## Prerequisites

- Node.js 20 or newer
- PostgreSQL 16 or newer
- A private Cloudflare R2 bucket and scoped API credentials
- Python 3.11 or newer for the parser service
- Ollama with `llama3` and `nomic-embed-text` for local AI features

## Environment

Use `.env.example` for database and non-secret runtime defaults. Use
`.env.local.example` for application secrets and R2 credentials. In production,
store the same values in the deployment platform's secret manager; do not deploy
local environment files.

### Web app and worker

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Runtime PostgreSQL connection; use a pooled URL when available |
| `DIRECT_URL` | Yes | Direct PostgreSQL connection used by Prisma migrations |
| `COURSE_STUDIO_PASSWORD` | Yes | Independent Course Studio sign-in secret |
| `ANALYTICS_PASSWORD` | Yes | Independent analytics sign-in secret |
| `R2_ACCOUNT_ID` | Yes for assets | Cloudflare account containing the R2 bucket |
| `R2_ACCESS_KEY_ID` | Yes for assets | Scoped R2 API access key |
| `R2_SECRET_ACCESS_KEY` | Yes for assets | Scoped R2 API secret |
| `R2_BUCKET` | Yes for assets | Private course asset bucket |
| `PARSER_SERVICE_URL` | Yes for AI features | Internal parser-service base URL |
| `PARSER_SERVICE_TOKEN` | Yes for AI features | Shared secret used by the web app, worker, and parser service |
| `JOB_WORKER_POLL_INTERVAL_MS` | No | Worker polling interval; defaults to the repository setting |
| `UPSTASH_REDIS_REST_URL` | No | Optional rate-limit store |
| `UPSTASH_REDIS_REST_TOKEN` | No | Optional rate-limit store credential |

`COURSE_STUDIO_PASSWORD`, `ANALYTICS_PASSWORD`, and
`PARSER_SERVICE_TOKEN` must be separate random values.

### Parser service

The parser service reads its own environment from
`services/parser-service/.env`.

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `PARSER_SERVICE_TOKEN` | Yes | — | Must exactly match the web app and worker |
| `OLLAMA_BASE_URL` | No | `http://localhost:11434` | Ollama server URL |
| `PARSER_PORT` | No | `8000` | Service port |
| `CHROMA_DIR` | No | service-local `chroma_db` | Vector-store persistence path |

## Database

Create a production database and configure both connection URLs. Apply committed
migrations before starting the application:

```bash
npm install
npm run db:migrate
```

`npm run build` also applies committed migrations, so the configured database
must be reachable during the build.

## Cloudflare R2

Create a private bucket and API credentials limited to that bucket. Course
assets are addressed through `/api/course-assets/[...key]`; the bucket does not
need a public URL or public-read policy.

Back up the bucket using R2 object versioning, replication, or an external
object-store backup process appropriate to the deployment.

## Web app

Build and run the application from the repository root:

```bash
npm run build
npm start
```

The deployment must keep `/studio`, `/course/[slug]`, `/analytics`, and
`/api/course-assets/[...key]` on the same Next.js application. HTTPS is required
in production so authentication cookies remain protected in transit.

## Background worker

Run one or more long-lived workers separately from the web process:

```bash
npm run jobs:worker
```

Each worker needs the same database, parser URL, and parser token as the web
application. Workers claim jobs through PostgreSQL leases, so multiple
instances may share the queue.

## Parser service

Install and start the parser service:

```bash
cd services/parser-service
python3 -m venv venv
source venv/bin/activate
pip install -e '.[dev]'
python -m moto_parser
```

Keep the parser and Ollama internal-only. The browser must reach AI features
through the Next.js API and durable worker, never by calling the parser directly.

## Release checklist

- [ ] PostgreSQL is reachable through both configured URLs.
- [ ] `npm run db:migrate` completed against the production database.
- [ ] The R2 bucket is private and credentials are scoped to it.
- [ ] Course Studio and analytics use separate strong passwords.
- [ ] The parser token matches across the web app, worker, and parser service.
- [ ] The parser health endpoint reports healthy dependencies.
- [ ] The web app, worker, and parser are supervised and restart on failure.
- [ ] HTTPS, database backups, R2 backups, and ChromaDB backups are enabled.
- [ ] A draft course can be previewed without writing learner progress.
- [ ] A published course loads through `/course/[slug]`.

## Backup and recovery

Back up PostgreSQL with the managed provider's point-in-time recovery or
`pg_dump`. PostgreSQL backups are authoritative for course structure, releases,
reviews, progress, jobs, and R2 object references.

Back up `services/parser-service/chroma_db` only when the deployment relies on
local Chroma persistence. It can be rebuilt from approved source documents, but
restoring it is faster than re-indexing.

Restore PostgreSQL and R2 to a mutually consistent point whenever possible.
Missing R2 objects remain missing even when their metadata row is present.

## Security

- Never expose database, R2, parser, or password values to client-side code.
- Keep the R2 bucket and parser service private.
- Rotate credentials independently; do not reuse the authoring password for
  analytics or internal service authentication.
- Quiz answer keys remain server-side and must not be added to learner payloads.
- Treat immutable course revisions as the delivery audit boundary. Downstream
  Motorola and localization packaging remains a future adapter, not a runtime
  dependency.
