# Moto AI Course Studio

Moto AI is an app-owned e-learning authoring and delivery platform. Course
Studio creates the English learning master. The shared Moto Player currently
renders in Studio preview and frozen review; the app has no public
`/course/[slug]` page or browser-reachable persisted learner-progress flow.
Authored content and assessments remain authoritative. The learner-facing
Course Assistant uses only approved, frozen course Q&A and never makes an AI
or parser request.

See [architecture.md](docs/architecture.md) for retained routes, commands,
ownership, and dependency direction. See [reset-database.md](docs/reset-database.md)
before resetting a local Moto AI database.

## Local development

Requirements: Node.js 20+, PostgreSQL, Python 3.11+, and an OpenAI API project
for authoring-only source processing and AI drafts.

```bash
cp .env.example .env
cp .env.local.example .env.local
npm ci
npm run db:generate
npm run db:migrate
npm run dev
```

The web app is available at `http://localhost:3000`. For source indexing,
Course Assistant Q&A drafts, course drafts, and quiz-draft suggestions, start
the parser service and worker as separate processes:

```bash
cd services/parser-service
python3 -m venv venv
source venv/bin/activate
pip install -e '.[dev]'
python -m moto_parser
```

```bash
npm run jobs:worker
```

For the complete new-MacBook handoff—including PostgreSQL, environment files,
the Codex project configuration, and verification—see
[MacBook setup](docs/macbook-setup.md).

## Documentation

- [Architecture and retained product surface](docs/architecture.md)
- [MacBook setup](docs/macbook-setup.md)
- [Named local database reset procedure](docs/reset-database.md)
- [Deployment guide](DEPLOYMENT.md)
