# Task 6 — Dependency, configuration, and parser ownership audit

## Contract decision

No behavior-preserving dependency or parser removal was authorized by the Task
6 evidence. Every direct npm dependency, environment placeholder, parser
module, and Python runtime/development dependency has a current import, runtime
reader, CSS/config consumer, or operational entrypoint. The stale shadcn CLI
aliases were removed because they pointed at nonexistent paths; `utils` now
maps to the canonical `src/shared/utils.ts` module. Keeping retained
declarations preserves Course Studio authentication, R2 media access, durable
jobs, and revision/source-scoped optional AI.

`scripts/run-workspace.mjs` remains necessary. It loads Next-style root
environment files before dispatching the web or worker workspace. Next loads
those files itself for the web command, but the `tsx` worker reads
`JOB_WORKER_POLL_INTERVAL_MS` before native workspace execution would load
`.env.local`; deleting the runner would change that configuration behavior.

## Files changed or deleted

- Updated `apps/web/components.json` to retain only existing `components` and
  canonical `utils` aliases.
- Updated the parser endpoint inventory to include the live authenticated
  `POST /api/generate-course` endpoint.
- Expanded this report with direct dependency and stale-configuration evidence.
- No runtime manifest, lockfile, environment example, parser module, or parser
  dependency changed or was deleted.

No direct dependency met the removal criterion, so no `npm uninstall` command
was applicable and the lockfile was intentionally unchanged.

## Ownership evidence

| Category                                   | Retained owner                                                                                                                                                                                                                                                                           |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Root `@next/env` and workspace runner      | `scripts/run-workspace.mjs` imports `@next/env` and calls `loadEnvConfig(process.cwd(), script === 'dev')` before both root commands delegate to their workspaces.                                                                                                                       |
| Root TypeScript, Prisma, and type packages | Root scripts invoke `tsc` and Prisma; every workspace `tsconfig` extends `tsconfig.base.json`, and Node/React types are selected by the base or workspace configs.                                                                                                                       |
| Root lint and formatting packages          | `eslint.config.mjs` imports `eslint/config` and `eslint-config-next`; root scripts invoke Prettier, while `.prettierrc` explicitly loads `prettier-plugin-tailwindcss`.                                                                                                                  |
| Web dependencies                           | TypeScript imports, `apps/web/src/app/globals.css` imports for `tailwindcss`, `tw-animate-css`, and `shadcn`, and `apps/web/postcss.config.mjs`.                                                                                                                                         |
| Shared package dependencies                | Package source imports: Prisma database adapter and Zod contracts/parser client.                                                                                                                                                                                                         |
| Worker dependencies                        | `apps/job-worker/src/index.ts` and `handlers.ts` import database, jobs, contracts, parser client, and `tsx` is its dev entrypoint.                                                                                                                                                       |
| Root environment examples                  | Prisma reads `DATABASE_URL`/`DIRECT_URL`; parser client reads service URL/token; worker reads poll interval; Studio/analytics/R2 server modules read their respective values.                                                                                                            |
| Parser environment example                 | `settings.py`, `rag.py`, and `main.py` read every OLLAMA, Chroma, retrieval, chunking, token, and port value.                                                                                                                                                                            |
| Parser modules/dependencies                | FastAPI `main.py` exposes authenticated upload/chat/quiz/course-generation/document paths; contracts, document extraction, RAG, generation, and settings are all on its import graph. Python imports cover Chroma, LangChain, MarkItDown, Pydantic, FastAPI, HTTPX, dotenv, and Uvicorn. |
| Parser multipart and development tools     | `main.py` uses FastAPI `Form`, `File`, and `UploadFile`, which require `python-multipart` for request parsing. `pyproject.toml` configures Ruff and mypy, and README installation explicitly requests the `[dev]` extra containing those tools.                                          |

The parser service remains explicitly course/revision/source scoped: chat, quiz,
and course generation require caller-supplied source IDs, and retrieval returns
no corpus-wide fallback for an empty source list.

## Verification

| Command                                                                          | Observed result                                                                                                                                                                                                                                               |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ls --all --depth=0`                                                         | All declared workspaces and direct dependencies resolved.                                                                                                                                                                                                     |
| import, entrypoint, config-reader, and Python-import scans                       | Found retained callers for each direct dependency, environment key, parser module, and Python dependency.                                                                                                                                                     |
| `npm run --workspace=@moto-ai/web` and `npm run --workspace=@moto-ai/job-worker` | Native workspace scripts exist for web and worker; the worker has no native environment loader, so the root runner remains required.                                                                                                                          |
| `rg -n -F '@/lib/utils'`, `@/components/ui`, and `@/hooks`                       | No remaining project consumers or retained `components.json` aliases. `@/shared/utils` consumers resolve to `src/shared/utils.ts`.                                                                                                                            |
| parser endpoint scan                                                             | `main.py` and README now both inventory `/api/upload`, `/api/chat`, `/api/generate-quiz`, `/api/generate-course`, `/api/document`, and `/health`.                                                                                                             |
| `npm ci --dry-run --ignore-scripts`                                              | Exit 0; dry run completed and reported one platform-specific optional package.                                                                                                                                                                                |
| `npm run typecheck`                                                              | Exit 0; all six TypeScript workspaces completed `tsc --noEmit`.                                                                                                                                                                                               |
| `npm run lint`                                                                   | Exit 0; ESLint completed for `apps`, `packages`, and `scripts`.                                                                                                                                                                                               |
| stale-term scan                                                                  | No `sanity`, `courseMode`, or `legacy corpus` matches in runtime TypeScript/Python source. No stale component-alias paths remain in configuration or project consumers. `run-workspace` remains only in its retained root scripts, runner, and approved plan. |
| `git diff --check`                                                               | Exit 0; no whitespace errors.                                                                                                                                                                                                                                 |

## Unresolved risks

No automated tests were created or run, per task instruction. The audit did not
start database, parser, worker, or browser services, so it does not provide
runtime persistence, parser-health, or authenticated-flow evidence; those are
owned by the later integration/browser verification task.
