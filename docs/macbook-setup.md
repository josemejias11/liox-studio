# MacBook setup

This guide recreates the local Moto AI Course Studio environment on a new
MacBook. It uses the committed `stg` branch, including the offline Course
Assistant introduced in commit `64d816e`.

## 1. Prerequisites

Install these tools before cloning the repository:

- Node.js 20 or later
- PostgreSQL 18
- Python 3.11 or later
- Git
- Codex, if you want to work with the repository through Codex

With Homebrew:

```bash
brew install node@20 postgresql@18
brew services start postgresql@18
pg_isready -h localhost -p 5432
```

The readiness command must report `accepting connections` before applying
migrations.

## 2. Clone the approved branch

```bash
git clone <repository-url> moto-ai
cd moto-ai
git switch stg
git pull --ff-only
git log -1 --oneline
```

The log should include `64d816e feat: add offline course assistant`, or a
newer commit on `origin/stg`.

## 3. Configure PostgreSQL and local secrets

Create the local development database if it does not already exist:

```bash
createdb moto_ai_dev
```

Create local-only environment files. These files contain secrets and remain
ignored by Git.

```bash
cp .env.example .env
cp .env.local.example .env.local
cp services/parser-service/.env.example services/parser-service/.env
```

Edit the copied files using values from the password manager or the existing
development machine. Do not copy secrets into source control.

| File                           | Required configuration                                                                                                                                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.env`                         | `DATABASE_URL` and `DIRECT_URL` for the local `moto_ai_dev` PostgreSQL database; `PARSER_SERVICE_URL=http://localhost:8000`. In local development, both database URLs may be the same direct PostgreSQL URL. |
| `.env.local`                   | `COURSE_STUDIO_PASSWORD`, `ANALYTICS_PASSWORD`, `PARSER_SERVICE_TOKEN`, and the private R2 credentials when source upload/indexing is required.                                                              |
| `services/parser-service/.env` | `OPENAI_API_KEY` and the exact same `PARSER_SERVICE_TOKEN` as `.env.local`. Keep the committed model and Chroma defaults unless you have a deliberate reason to change them.                                 |

## 4. Install and migrate

Use the lockfile to reproduce the workspace dependencies exactly:

```bash
npm ci
npm run db:generate
npm run db:migrate
```

`db:migrate` applies the committed Prisma migrations, including the
offline-assistant Q&A tables. It does not create or modify migration files.

## 5. Run local services

Run the web app, parser service, and durable job worker in separate terminals.

```bash
# Terminal 1: Next.js Course Studio
npm run dev
```

```bash
# Terminal 2: authoring-only parser service
cd services/parser-service
python3 -m venv venv
source venv/bin/activate
pip install -e '.[dev]'
python -m moto_parser
```

```bash
# Terminal 3: source-indexing and generation jobs
npm run jobs:worker
```

Open `http://localhost:3000/studio/login` and sign in with
`COURSE_STUDIO_PASSWORD`.

The Course Assistant that learners see is local and revision-bound: it makes
no model or parser calls. The parser service and job worker are only required
for Studio work such as source indexing, assistant-Q&A drafts, course drafts,
and quiz-draft suggestions.

## 6. Verify the local install

```bash
curl http://127.0.0.1:8000/health
npm run lint
npm run typecheck
npm run build
```

`npm run build` applies pending committed migrations before building. Do not
use `npm run format -- --check`: this repository's `format` command writes
files.

## 7. Codex configuration

After installing Codex, add the repository to `~/.codex/config.toml`. Replace
the path with your MacBook checkout path.

```toml
model = "gpt-5.6-terra"
model_reasoning_effort = "medium"
approvals_reviewer = "auto_review"

[projects."/absolute/path/to/moto-ai"]
trust_level = "trusted"
```

The model settings above match the working development-machine baseline but
are preferences, not a repository requirement. MCP integrations such as
Context7, Playwright, and GitHub are optional productivity tooling; configure
them only through your own Codex account and local credential store. Never put
API keys, tokens, or R2 credentials in `config.toml` or committed files.

## 8. Shutdown

Stop the web, parser, and worker processes with `Ctrl-C`. If you do not need
PostgreSQL running between sessions:

```bash
brew services stop postgresql@18
```
