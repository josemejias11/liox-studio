# Repo Notes

## Detected Stack

- Language: TypeScript/JavaScript, Python
- Frameworks: Next.js 16, React 19, Sanity, Prisma, FastAPI
- CI / infra: npm workspaces, Prisma migrations, Next.js headers/CSP config, local Ollama-backed parser service
- Key folders: `apps/web/`, `apps/job-worker/`, `packages/database/`, `packages/contracts/`, `packages/jobs/`, `packages/parser-client/`, `services/parser-service/`

## Useful Commands

- `npm run dev` - start the Next.js app
- `npm run build` - run Prisma migrations and build the app
- `npm run lint` - lint the app
- `npm run typecheck` - run TypeScript checks
- `npm run jobs:worker` - run the durable background job worker
- `npm run db:migrate` - apply Prisma migrations
- `npm run db:migrate:dev` - create/apply a development migration
- `npm run db:generate` - generate the Prisma client
- `npm run db:studio` - open Prisma Studio
- `cd services/parser-service && python3 -m venv venv && source venv/bin/activate && pip install -e '.[dev]'` - install parser service
- `cd services/parser-service && moto-parser` (or `python -m moto_parser`) - start the Python parser service

## Subagent Routing

- **Next.js app, React UI, Sanity Studio, shared TypeScript code** -> `application-engineer`.
- **Python `services/parser-service`, FastAPI routes, local AI backend logic** -> `ai-ml-engineer`.
- **Browser verification and release evidence** -> `quality-engineer`.
- **Cross-cutting architecture and boundary decisions** -> `software-architecture-lead`.
- **Deployment, CI/CD, and runtime operations** -> `platform-reliability-engineer`.
