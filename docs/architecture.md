# Moto AI architecture

Moto AI is an app-owned learning platform. Course Studio authors the English
learning master; Moto Player delivers published courses. PostgreSQL owns course
structure, authoring state, immutable revisions, review feedback, learner
progress, quizzes, source records, generation provenance, and durable jobs.
Cloudflare R2 owns private course media and source-file bytes.

## Ownership and direction

`apps/web/src/app` is the Next.js transport boundary: pages and route handlers
translate requests to feature use cases. Feature code is owned by authoring,
learning, review, analytics, and shared concerns. Server infrastructure owns
authentication, storage, jobs, parser clients, and HTTP adapters. Browser
components must not import server infrastructure.

`packages/contracts` owns browser-safe shared contracts. `packages/database`
owns Prisma schema, migrations, and repositories. `packages/jobs` owns durable
queue behaviour. `packages/parser-client` is the typed server-side parser
boundary. `apps/job-worker` claims database jobs and calls the parser service.
`services/parser-service` handles document parsing, retrieval, grounded chat,
and supplemental quiz generation.

```text
browser -> Next.js pages and APIs -> feature use cases -> server adapters
                                              |              |
                                              |              +-> PostgreSQL / R2 / jobs / parser client
                                              +-> shared contracts
job worker -> parser client -> private parser service -> local Ollama / ChromaDB
```

Authored lessons and assessments are authoritative. AI features remain
optional, revision- and source-scoped support; they must not bypass author
approval or become a learner-completion requirement. Frozen revisions are
immutable snapshots. Review tokens are read-only, stored only as hashes, and
identify one frozen revision. Studio and review previews do not write learner
progress, weak-topic analytics, or AI requests.

## Retained web surfaces

Pages:

- `/` — published course library
- `/analytics` and `/analytics/login` — analytics and sign-in
- `/course/[slug]` — learner player
- `/studio`, `/studio/login`, and `/studio/[courseId]` — Course Studio
- `/review/[token]` — frozen client review

API routes:

- `/api/analytics/login`, `/api/analytics/weak-topics`
- `/api/chat`, `/api/course-assets/[...key]`
- `/api/course-studio/login`, `/api/course-studio/assets`,
  `/api/course-studio/courses`
- `/api/course-studio/courses/[courseId]`, `/chapters`, `/lessons`, `/reorder`,
  `/revisions`, `/feedback`, `/trash`, and `/trash/[trashId]`
- `/api/course-studio/courses/[courseId]/sources`,
  `/sources/[sourceId]`, and `/sources/[sourceId]/retry`
- `/api/course-studio/generations` and `/generations/[generationId]`
- `/api/course-studio/revisions/[revisionId]/review`
- `/api/jobs/[id]`, `/api/progress`, `/api/quiz`, `/api/quiz/grade`
- `/api/reviews/[token]/feedback`

## Retained commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Next.js web application. |
| `npm run jobs:worker` | Start the durable background worker. |
| `npm run build` | Apply committed Prisma migrations and build the web app. |
| `npm run start` | Start the built web app. |
| `npm run lint` | Lint application, package, and script source. |
| `npm run format` | Format repository files. |
| `npm run typecheck` | Type-check every workspace that exposes the command. |
| `npm run db:migrate` | Apply committed Prisma migrations. |
| `npm run db:migrate:dev` | Create and apply a development migration. |
| `npm run db:generate` | Generate the Prisma client. |
| `npm run db:studio` | Open Prisma Studio. |

`npm run build` requires the configured PostgreSQL database because it runs
`npm run db:migrate` first.
