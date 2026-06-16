# Fleet Architecture & Rules (Hot Cache / "ROM")

> Re-read at the start of every session by `/standup`. Keep it small (< ~2k
> tokens) and **always accurate** — agents trust this as source of truth.

## 1. The Stack
* **Frontend:** Next.js 16 (App Router), React, TypeScript, Tailwind. Lives in `web/`.
* **Backend:** Next.js API routes (`web/src/app/api/**`) + self-hosted FastAPI RAG service (`parser-service/`, Python).
* **Database:** PostgreSQL via Prisma. Models: `Session`, `LessonProgress`, `HotspotVisit`, `GeneratedQuiz`.
* **Testing:** Vitest (`npm run test`) for units · `npm run typecheck` (tsc --noEmit) before every commit.
* **Infra / deploy:** Vercel (web). Parser service self-hosted; needs local Ollama (`llama3` + `nomic-embed-text`).
* **External services:** Sanity CMS (project `e7l925v5`, dataset `production`, Studio at `/studio`); Upstash Redis (rate limiting, gracefully disabled if unset); Ollama (LLM + embeddings).

## 2. Operational Directives
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
* **No comments** unless WHY is non-obvious. Zod at all boundaries; `opt()` normalizes `null → undefined`.

## 3. Delegation Matrix
* **Tech Lead (orchestrator):** routes tasks, writes ADRs, cross-stack decisions. Dispatches via `/forge`; rarely implements.
* **web-engineer:** Next.js/React UI, lesson components, App Router, CMS integration.
* **api-services-engineer:** API routes, Prisma schema/migrations, server contracts.
* **ai-ml-engineer:** RAG pipeline, chat/quiz generation, parser-service, Ollama integration.
* **qa-automation-engineer:** Vitest units, Playwright E2E, RTM against acceptance criteria.
* **product-designer:** lesson UX, design specs (feeds web-engineer).
