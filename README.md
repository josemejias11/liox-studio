# Moto AI Course Studio

Moto AI is an app-owned e-learning authoring and delivery platform. Course
Studio creates the English learning master. The shared Moto Player currently
renders in Studio preview and frozen review; the app has no public
`/course/[slug]` page. Authored content and assessments remain authoritative;
grounded AI is optional learner support and never a required completion path.

See [architecture.md](docs/architecture.md) for retained routes, commands,
ownership, and dependency direction. See [reset-database.md](docs/reset-database.md)
before resetting a local Moto AI database.

## Local development

Requirements: Node.js 20+, PostgreSQL, and Python 3.11+. Ollama is needed only
for local grounded-AI features.

```bash
cp .env.example .env
cp .env.local.example .env.local
npm install
npm run db:migrate
npm run dev
```

The web app is available at `http://localhost:3000`. For source indexing,
grounded chat, and generated quiz suggestions, start the parser service and
worker as separate processes:

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

## Documentation

- [Architecture and retained product surface](docs/architecture.md)
- [Named local database reset procedure](docs/reset-database.md)
- [Deployment guide](DEPLOYMENT.md)
