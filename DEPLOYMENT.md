# Deployment Guide

Moto AI runs a Next.js web app, a PostgreSQL database, a durable job worker,
and a private parser service. Cloudflare R2 stores private course media and
source files.

```text
Browser -> Next.js web app -> PostgreSQL
                |              ^
                +-> R2         |
                +-> job worker -> parser service -> local Ollama and ChromaDB
```

The browser never connects directly to PostgreSQL, R2, or the parser service.
For ownership, retained URLs, and command definitions, see
[docs/architecture.md](docs/architecture.md). For a local database reset, use
[docs/reset-database.md](docs/reset-database.md); it is not a production
recovery procedure.

## Environment

Use `.env.example` for database and non-secret runtime defaults, and
`.env.local.example` for application secrets and R2 credentials. Store the
same values in the deployment platform's secret manager; do not deploy local
environment files.

`COURSE_STUDIO_PASSWORD`, `ANALYTICS_PASSWORD`, and
`PARSER_SERVICE_TOKEN` must be separate random values. The parser service reads
its matching token from `services/parser-service/.env`.

## Deploy and operate

```bash
npm install
npm run db:migrate
npm run build
npm start
```

Run workers separately:

```bash
npm run jobs:worker
```

Run the parser service with its documented Python environment:

```bash
cd services/parser-service
python3 -m venv venv
source venv/bin/activate
pip install -e '.[dev]'
python -m moto_parser
```

Keep R2 and the parser service private. In production, serve the web app over
HTTPS, back up PostgreSQL and R2, supervise the web app, worker, and parser
service, and verify `npm run db:migrate` completes against the configured
database before application startup.

## Release checks

- PostgreSQL is reachable through both configured URLs.
- The R2 bucket is private and its credentials are scoped to that bucket.
- Studio and analytics credentials are distinct.
- The parser token matches across web app, worker, and parser service.
- A draft preview does not write learner progress.
- Frozen revisions remain unchanged when authors edit the live course.
- A review link opens only its frozen revision and accepts feedback.
- Studio and review previews do not persist learner progress or request
  weak-topic analytics; revision- or review-scoped optional AI remains
  available when its identity is supplied.
