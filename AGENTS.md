# Repo Notes

## Detected Stack

- Language: TypeScript/JavaScript, Python
- Frameworks: Next.js 16, React 19, Sanity, Prisma, FastAPI
- CI / infra: Prisma migrations, Next.js headers/CSP config, local Ollama-backed parser service
- Key folders: `src/`, `prisma/`, `parser-service/`, `public/`, `sanity.config.ts`

## Useful Commands

- `npm run dev` - start the Next.js app
- `npm run build` - run Prisma migrations and build the app
- `npm run lint` - lint the app
- `npm run typecheck` - run TypeScript checks
- `npm run figma:build` - type-check the Figma plugin
- `npm run db:migrate` - apply Prisma migrations
- `npm run db:studio` - open Prisma Studio
- `cd parser-service && python main.py` - start the Python parser service

## Subagent Routing

Full routing table lives in `~/.config/opencode/AGENTS.md`.

- **Next.js app, React UI, Sanity Studio, shared TS code** -> `web-engineer`.
- **Python `parser-service`, FastAPI routes, local AI backend logic** -> `api-services-engineer`.
- **Browser verification for app flows** -> `qa-automation-engineer`.
- **Cross-cutting architecture or boundary decisions** -> `tech-lead`.

## SDD Model Selection

Use the SDD triplet for spec-driven work:

- **Implementation (primary)** -> `sdd-implementer` (`openai/gpt-5.4`)
- **Implementation (explicit code-only opt-in)** -> `sdd-implementer-code` (`openai/gpt-5.3-codex-spark`)
- **Implementation (fallback)** -> `general` (`openai/gpt-5.4-mini`)
- **Task review** -> `sdd-reviewer` (`openai/gpt-5.5`)
- **Architecture / final review** -> `sdd-architect` (`openai/gpt-5.5`)
