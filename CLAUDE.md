# Moto Tutor AI — CLAUDE.md

## Project overview

Motorola 2026 product-training platform. Sales reps complete interactive courses built in Sanity CMS; an AI layer (RAG + Ollama) lets them chat with course materials and take AI-generated quizzes. The stack is a Next.js 16 frontend/API (`web/`) backed by a self-hosted FastAPI RAG service (`parser-service/`).

## Repo layout

```
moto-ai/
├── web/                  Next.js 16 app (frontend + API routes)
│   ├── src/
│   │   ├── app/          Pages and API routes (App Router)
│   │   │   └── api/      chat/, quiz/grade/, upload/, progress/, analytics/
│   │   ├── components/   React UI — one file per lesson type
│   │   ├── hooks/        useCourseNavigation, useLessonProgress
│   │   ├── lib/
│   │   │   ├── contracts/
│   │   │   │   ├── sanity.ts   Zod schemas + types for all GROQ projections
│   │   │   │   ├── quiz.ts     Request/response contracts for /api/quiz/grade
│   │   │   │   └── api.ts      Shared API contracts
│   │   │   ├── course-structure.ts  deriveCourseStructure — single flat sections array
│   │   │   ├── parser-service.ts    Server-only client for the FastAPI RAG service
│   │   │   ├── quiz-grading.ts      Pure grading logic (no I/O)
│   │   │   └── db.ts                Prisma singleton
│   │   └── sanity/
│   │       ├── lib/
│   │       │   ├── client.ts   readClient (CDN) and sanityClient (write token)
│   │       │   └── queries.ts  All GROQ queries
│   │       └── schemaTypes/    Sanity Studio schema — source of truth for CMS fields
│   ├── prisma/           PostgreSQL schema + migrations
│   └── sanity.config.ts  Sanity Studio config (basePath: /studio)
└── parser-service/       Python FastAPI RAG microservice
    ├── main.py           All endpoints + ChromaDB + Ollama integration
    └── requirements.txt
```

## Dev commands (run from `web/`)

```bash
npm run dev          # Next.js dev server (localhost:3000); Studio at /studio
npm run typecheck    # tsc --noEmit — run before every commit
npm run lint         # ESLint
npm run test         # vitest run (unit tests)
npm run build        # prisma migrate deploy + next build
npm run db:migrate:dev   # Create a new Prisma migration
npm run db:studio    # Prisma Studio GUI
```

**Always run `npm run typecheck && npm run test` before declaring a task done.**

## Parser service (run from `parser-service/`)

**First-time setup (one-off):**
```bash
cp parser-service/.env.example parser-service/.env   # then edit PARSER_SERVICE_TOKEN
```

```bash
pip install -r requirements.txt
python main.py              # localhost:8000 (always; reads $PORT, guards < 1024)
```

Requires Ollama running locally (`llama3` for LLM, `nomic-embed-text` for embeddings). The service is **server-to-server only** — never called from the browser. All requests carry `X-Internal-Token` matching `PARSER_SERVICE_TOKEN` in `.env.local`.

## Environment variables

Secrets go in `web/.env.local` (gitignored). See `web/.env.example` for all keys. Critical ones:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Pooled Postgres URL (PgBouncer in prod) |
| `DIRECT_URL` | Direct Postgres URL (migrations only) |
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | `e7l925v5` |
| `NEXT_PUBLIC_SANITY_DATASET` | `production` |
| `SANITY_API_TOKEN` | Editor token — Studio mutations only |
| `PARSER_SERVICE_URL` | FastAPI RAG service URL |
| `PARSER_SERVICE_TOKEN` | Shared secret (X-Internal-Token) |
| `UPSTASH_REDIS_REST_URL/TOKEN` | Rate limiting (gracefully disabled if unset locally) |
| `ANALYTICS_PASSWORD` | Dashboard auth |

## Architecture invariants — never break these

### Quiz answer isolation
`QUIZ_GRADING_QUERY` (in `queries.ts`) contains the answer key (`isCorrect`, `feedback`, `explanation`). It is **SERVER-ONLY**. Never import or use it in any file that could be serialized to the browser. The client receives only question text and answer options; grading happens in `/api/quiz/grade`.

### GROQ ↔ Zod contract parity
Every field projected in `queries.ts` must have a matching field in `contracts/sanity.ts`. The Zod schemas are the validation boundary — all downstream components consume typed values. When changing a GROQ fragment, update the corresponding Zod schema in the same commit. When adding a new field to a schema type, add it to both the GROQ fragment and the Zod schema.

### Lesson type enum must stay in sync
`lessonType` values in `schemaTypes/lesson.ts` (Studio options) and `lessonSchema` (contracts/sanity.ts) must be identical. Currently: `content | interaction | stage | video | quiz | colorSwitcher | splitScreen | dragDrop | scrollStory`.

### Sanity clients
- `readClient` — CDN-enabled, no token. Use for all content fetching.
- `sanityClient` — write token, no CDN. Studio mutations only. Never import in client components.

### Parser service client
`lib/parser-service.ts` is **server-only**. Only import it in route handlers (`app/api/**`). Never in components or hooks.

### Course section order
`deriveCourseStructure` builds the flat `sections` array in this fixed order: lessons → specifications → disclaimer. The absolute index controls navigation. Do not reorder.

## Sanity workflow

- Studio: `localhost:3000/studio` in dev, `/studio` in prod
- Project: `e7l925v5`, dataset: `production`
- After changing any file in `web/src/sanity/schemaTypes/`, deploy the schema so the Sanity MCP can validate edits:
  ```bash
  cd web && npx sanity@latest schema deploy
  ```
- **Do not edit the production Sanity dataset directly** for content migrations without first verifying the change in Studio. Use `mcp__Sanity__edit_document` + `mcp__Sanity__publish_documents` for programmatic migrations, but always stage them as a draft first and review before publishing.

## Database (Prisma + PostgreSQL)

Models: `Session`, `LessonProgress`, `HotspotVisit`, `GeneratedQuiz`.

- `Session.id` is a browser-generated UUID — not a server-issued token
- `GeneratedQuiz.payload` stores the full AI quiz JSON server-side (correct answers never leave the server)
- Migrations live in `prisma/migrations/`; create new ones with `npm run db:migrate:dev`
- `prisma generate` runs automatically on `npm install` (postinstall hook)

## Code conventions

- **No comments** unless the WHY is non-obvious. Never describe what the code does.
- **Zod everywhere at boundaries** — API inputs, Sanity payloads, parser service responses. Trust nothing from outside; trust internal types completely.
- `opt()` helper in `contracts/sanity.ts` normalizes `null → undefined` for all nullable GROQ projections. Use it for any field that can be missing.
- Component files are one-to-one with lesson types: `ContentLesson.tsx`, `VideoLesson.tsx`, etc. New lesson types get their own file.
- API routes return `{ error: string }` on failure with an appropriate HTTP status. Never leak internal error details to the client.
- Rate limiting (`lib/rate-limit.ts`) uses Upstash Redis and is gracefully disabled when env vars are absent. Do not remove the guard.

## Key files to read before touching an area

| Area | Read first |
|---|---|
| Course rendering | `components/MotoViewer.tsx`, `lib/course-structure.ts` |
| Navigation | `hooks/useCourseNavigation.ts`, `components/NavMap.tsx` |
| CMS queries | `sanity/lib/queries.ts`, `lib/contracts/sanity.ts` |
| Quiz grading | `lib/quiz-grading.ts`, `lib/contracts/quiz.ts`, `app/api/quiz/grade/route.ts` |
| AI chat/quiz gen | `app/api/chat/route.ts`, `app/api/quiz/route.ts`, `lib/parser-service.ts` |
| Progress tracking | `hooks/useLessonProgress.ts`, `app/api/progress/route.ts` |
| Sanity Studio | `sanity/schemaTypes/`, `sanity/structure.ts`, `sanity.config.ts` |
| Parser RAG service | `parser-service/main.py` |
