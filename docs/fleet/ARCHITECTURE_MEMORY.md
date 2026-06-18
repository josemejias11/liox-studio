# Fleet Architecture & Rules (Hot Cache / "ROM")

> Re-read at the start of every session by `/standup`. Keep it small (< ~2k
> tokens) and **always accurate** — agents trust this as source of truth.

## 1. The Stack
* **Frontend:** Next.js 16 (App Router), React, TypeScript, Tailwind. Lives in `web/`.
* **Backend:** Next.js API routes (`web/src/app/api/**`) + self-hosted FastAPI RAG service (`parser-service/`, Python).
* **Database:** PostgreSQL via Prisma. Models: `Session`, `LessonProgress`, `HotspotVisit`, `GeneratedQuiz`, `QuizAttempt`. Schema at `web/prisma/schema.prisma`.
* **Testing:** Vitest (`npm run test`) for units · `npm run typecheck` (tsc --noEmit) before every commit.
* **Infra / deploy:** Vercel (web). Parser service self-hosted; needs local Ollama (`llama3` + `nomic-embed-text`).
* **External services:** Sanity CMS (project `e7l925v5`, dataset `production`, Studio at `/studio`); Upstash Redis (rate limiting, gracefully disabled if unset); Ollama (LLM + embeddings).

## 2. Dev Startup Sequence (4 processes, all required)
```
1. PostgreSQL      → local instance on :5432  (Postgres.app / Homebrew / Docker)
2. Ollama          → ollama serve              (pulls llama3 + nomic-embed-text once)
3. parser-service  → cd parser-service && source venv/bin/activate && python main.py
4. Next.js         → cd web && npm run dev     (http://localhost:3000)
```
Health check: `curl http://localhost:8000/health` must return `"status":"ok"` before uploads/chat work.

## 3. Key Environment Variables
`web/.env.local` (secrets; `web/.env` holds safe local defaults):
| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Pooled PG URL |
| `DIRECT_URL` | yes | Direct PG URL (migrations) |
| `SANITY_API_TOKEN` | yes | Editor token from sanity.io/manage |
| `PARSER_SERVICE_URL` | yes | `http://localhost:8000` in dev |
| `PARSER_SERVICE_TOKEN` | yes | Shared secret — must match `parser-service/.env` |
| `ANALYTICS_PASSWORD` | yes | Gates `/analytics` dashboard **and** `/api/upload` |
| `UPSTASH_REDIS_REST_URL/TOKEN` | no | Rate limiting; disabled when unset |

`parser-service/.env` (copy from `.env.example`):
`PARSER_SERVICE_TOKEN`, `OLLAMA_BASE_URL`, `LLM_MODEL`, `EMBEDDING_MODEL`, `CHROMA_DIR`

## 4. Auth Gate — Critical
`analytics_token` httpOnly cookie (set at `POST /analytics/login`, lasts 7 days) guards **two** things:
1. All `/analytics` pages (via `web/src/proxy.ts` middleware matcher).
2. `POST /api/upload` and `DELETE /api/upload` route handlers.

**You must visit `/analytics/login` before Studio uploads will work.** This is the #1 cause of upload failures in Studio — the cookie is not automatically set by the Sanity session.

## 5. Operational Directives
* **Artifact-Driven Memory:** Never rely on chat history. Decisions, contracts, and state live in `docs/fleet/` and `docs/tasks/`.
* **Before mutating state:** read `CURRENT_STATE.md` for the active context.
* **Distillation (`/commit`):** roll `CURRENT_STATE.md` forward — a *rolling window*, not an append log.
* **Always run `npm run typecheck && npm run test` (from `web/`) before declaring a task done.**

### Project invariants (never break)
* **Quiz answer isolation:** `QUIZ_GRADING_QUERY` (answer key: `isCorrect`/`feedback`/`explanation`) is SERVER-ONLY. Never reaches the browser. Grading happens in `/api/quiz/grade`.
* **GROQ ↔ Zod parity:** every field projected in `queries.ts` has a matching field in `contracts/sanity.ts`. Update both in the same commit.
* **Lesson type enum in sync:** `lessonType` in `schemaTypes/lesson.ts` must match `lessonSchema` in `contracts/sanity.ts` — `content | interaction | stage | video | quiz | colorSwitcher | splitScreen | dragDrop | scrollStory`.
* **Sanity clients:** `readClient` (CDN, no token) for content; `sanityClient` (write token, no CDN) for Studio mutations only — never in client components.
* **`lib/parser-service.ts` is server-only** — import only in route handlers.
* **Course section order:** `deriveCourseStructure` builds flat `sections` as lessons → specifications → disclaimer. Absolute index drives navigation. Do not reorder.
* **Sanity schema changes:** after editing `web/src/sanity/schemaTypes/`, run `cd web && npx sanity@latest schema deploy`. Stage prod dataset migrations as drafts; review before publish.
* **Sanity CLI:** `web/sanity.cli.ts` configures the CLI (project `e7l925v5`, dataset `production`). All `npx sanity` commands must be run from `web/`.
* **`filter` + compositor layer = GPU-composited:** `filter` on an element with `transform` / `will-change: transform` runs on the GPU. Add `will-change: transform, opacity, filter` — never remove the filter to "improve perf." `background-position` is never GPU-composited; static gradients are always correct.
* **No comments** unless WHY is non-obvious. Zod at all boundaries; `opt()` normalizes `null → undefined`.
* **analytics_token scope:** guards both `/analytics` pages AND `/api/upload`. Do not remove the auth gate from the upload route.
* **Portable Text mark components:** shared renderers live in `web/src/lib/portable-text-components.tsx` (e.g., `supMark`). Import from there; never inline mark components at callsites. When adding `marks.decorators` to a block that previously omitted it, list the full default set (strong, em, underline, strike-through, code) plus additions — adding the key overrides the Sanity defaults entirely.

## 6. Key Utilities
* **`reset-all.sh`** (repo root) — canonical one-command full reset: wipes Postgres, deletes Sanity docs, removes `parser-service/chroma_db`. Loads `web/.env` + `web/.env.local`. Use before a clean content-entry run.
* **`parser-service/eval/run_eval.py`** — RAG eval harness. Results land in `eval/results/`. RAG tuning changes must beat the recorded baseline before merging.
* **`web/src/proxy.ts`** — Next.js middleware that guards `/analytics` (but not `/analytics/login`). Not a route handler — it runs before the page.

## 7. Delegation Matrix

Agents are puppeteers: they invoke skills as their execution layer. Skills encode curated best practices; project invariants here always override skill guidance.

| Agent | Domain | Skills to invoke |
|---|---|---|
| **Tech Lead** | Routes tasks, ADRs, cross-stack decisions. Dispatches via `/forge`; rarely implements. | — |
| **web-engineer** | Next.js/React UI, lesson components, App Router, CMS integration | `nextjs-app-router-patterns`, `react-best-practices`, `typescript-pro`, `tailwind-patterns`, `zod-validation-expert`; `react-component-performance` / `web-performance-optimization` for perf work; `vercel-deployment` for deploy |
| **api-services-engineer** | API routes, Prisma schema/migrations, server contracts | `api-design-principles`, `prisma-expert`, `postgresql`, `zod-validation-expert`; `fastapi-pro` for parser-service route work |
| **ai-ml-engineer** | RAG pipeline, chat/quiz generation, parser-service, Ollama integration | `rag-engineer`, `rag-implementation`, `embedding-strategies`, `vector-database-engineer`; `python-pro`, `fastapi-pro`, `pydantic-models-py`; `claude-api` for Anthropic/model specifics |
| **qa-automation-engineer** | Vitest units, Playwright E2E, RTM | `javascript-testing-patterns`, `python-testing-patterns`, `e2e-testing`, `playwright-skill` |
| **product-designer** | Lesson UX, design specs (feeds web-engineer) | `frontend-design` |
| **systems-performance-engineer** | CSS/JS perf profiling, GPU compositing audits. **Must be called BEFORE web-engineer removes visual effects.** | `react-component-performance`, `web-performance-optimization` |
