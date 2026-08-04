# Task 6 — Dependency, configuration, and parser ownership audit

## Contract decision

No behavior-preserving removal was authorized by the Task 6 evidence. Every
direct npm dependency, environment placeholder, parser module, and Python
runtime dependency has a current import, runtime reader, CSS/config consumer,
or operational entrypoint. Keeping those declarations preserves Course Studio
authentication, R2 media access, durable jobs, and revision/source-scoped
optional AI.

`scripts/run-workspace.mjs` remains necessary. It loads Next-style root
environment files before dispatching the web or worker workspace. Next loads
those files itself for the web command, but the `tsx` worker reads
`JOB_WORKER_POLL_INTERVAL_MS` before native workspace execution would load
`.env.local`; deleting the runner would change that configuration behavior.

## Files changed or deleted

- Added this evidence report only.
- No runtime source, manifest, lockfile, configuration, environment example,
  parser module, or parser dependency changed or was deleted.

No direct dependency met the removal criterion, so no `npm uninstall` command
was applicable and the lockfile was intentionally unchanged.

## Ownership evidence

| Category | Retained owner |
| --- | --- |
| Root `@next/env` and workspace runner | `scripts/run-workspace.mjs` loads `.env*` before both root commands delegate to their workspaces. |
| Web dependencies | TypeScript imports, `apps/web/src/app/globals.css` imports for `tailwindcss`, `tw-animate-css`, and `shadcn`, and `apps/web/postcss.config.mjs`. |
| Shared package dependencies | Package source imports: Prisma database adapter and Zod contracts/parser client. |
| Worker dependencies | `apps/job-worker/src/index.ts` and `handlers.ts` import database, jobs, contracts, parser client, and `tsx` is its dev entrypoint. |
| Root environment examples | Prisma reads `DATABASE_URL`/`DIRECT_URL`; parser client reads service URL/token; worker reads poll interval; Studio/analytics/R2 server modules read their respective values. |
| Parser environment example | `settings.py`, `rag.py`, and `main.py` read every OLLAMA, Chroma, retrieval, chunking, token, and port value. |
| Parser modules/dependencies | FastAPI `main.py` exposes authenticated upload/chat/quiz/course-generation/document paths; contracts, document extraction, RAG, generation, and settings are all on its import graph. Python imports cover Chroma, LangChain, MarkItDown, Pydantic, FastAPI, HTTPX, dotenv, and Uvicorn. |

The parser service remains explicitly course/revision/source scoped: chat, quiz,
and course generation require caller-supplied source IDs, and retrieval returns
no corpus-wide fallback for an empty source list.

## Verification

| Command | Observed result |
| --- | --- |
| `npm ls --all --depth=0` | All declared workspaces and direct dependencies resolved. |
| import, entrypoint, config-reader, and Python-import scans | Found retained callers for each direct dependency, environment key, parser module, and Python dependency. |
| `npm run --workspace=@moto-ai/web` and `npm run --workspace=@moto-ai/job-worker` | Native workspace scripts exist for web and worker; the worker has no native environment loader, so the root runner remains required. |
| `npm ci --dry-run --ignore-scripts` | Exit 0; dry run completed and reported one platform-specific optional package. |
| `npm run typecheck` | Exit 0; all six TypeScript workspaces completed `tsc --noEmit`. |
| `npm run lint` | Exit 0; ESLint completed for `apps`, `packages`, and `scripts`. |
| stale-term scan | No `sanity`, `courseMode`, or `legacy corpus` matches in runtime TypeScript/Python source. `run-workspace` remains only in its retained root scripts, runner, and approved plan. |
| `git diff --check` | Exit 0; no whitespace errors. |

## Unresolved risks

No automated tests were created or run, per task instruction. The audit did not
start database, parser, worker, or browser services, so it does not provide
runtime persistence, parser-health, or authenticated-flow evidence; those are
owned by the later integration/browser verification task.
