# Task 5 — Thin API routes and single-owner server access

## Contract decision

HTTP routes remain the public contract boundary: they retain the exact request parsing, authorization gate, response wrapper, status code, and error translation. Database, R2, durable-job, parser-client, and server-only answer-key access now live in feature/server modules. The only intentionally shared orchestration is `learning/server/revision-sources.ts`, because chat and AI quiz creation had byte-for-byte equivalent frozen-review/source resolution rules.

The three App Router server pages that directly queried Prisma now load data through authoring/review server modules. They remain server components and preserve their auth, redirect, `notFound`, rendered props, review-token, and frozen-version behavior.

## Route-semantic matrix

| Route and method | Auth | Input schema / parsing | Server use case | Success | Error paths retained |
| --- | --- | --- | --- | --- | --- |
| `POST /api/analytics/login` | submitted analytics password | form `password` | `analytics-auth` validation | 303 `/analytics`, cookie | 303 `/analytics/login?error=1` |
| `POST /api/analytics/weak-topics` | none | `WeakTopicsRequestSchema` | analytics service | 200 result | parser response; unexpected 500 |
| `POST /api/chat` | studio cookie for raw revision; review token otherwise | `ChatRequestSchema` | revision-bound course AI | 200 answer | invalid payload; 401; 404 review/revision; 502 RAG; 500 |
| `GET /api/course-assets/[...key]` | none | key segments | storage adapter | 200 stream/cache headers | 400 invalid key; 404; 502 |
| `POST /api/course-studio/assets` | studio cookie | multipart courseId/file | authoring asset upload | 201 asset | 400/413 validation; 404 course; 500 upload |
| `POST /api/course-studio/courses` | studio cookie | title schema | create authoring course | 201 course | 401; parser response |
| `PATCH /api/course-studio/courses/[courseId]` | studio cookie | settings patch schema | update authoring course | 200 course | 400 JSON/settings; 401; 404; 500 |
| `POST/PATCH/DELETE /api/course-studio/courses/[courseId]/chapters` | studio cookie | create/update/delete schemas | authoring chapter commands | 201/200/200 course | 401; parser response; 404 chapter; 409 final chapter; 500 |
| `GET/PATCH /api/course-studio/courses/[courseId]/feedback` | studio cookie | feedbackId schema for PATCH | authoring feedback commands | 200 feedback/resolved | 401; parser response; 404 feedback; 500 |
| `POST/PATCH/DELETE /api/course-studio/courses/[courseId]/lessons` | studio cookie | lesson schemas | authoring lesson commands | 201/200/200 course/trash | 401; parser response; 404 lesson; 409 final lesson; 500 |
| `POST /api/course-studio/courses/[courseId]/reorder` | studio cookie | kind/id/direction schema | reorder authoring item | 200 course | 401; parser response; 500 |
| `GET/POST /api/course-studio/courses/[courseId]/revisions` | studio cookie | notes schema for POST | authoring revision commands | 200 revisions / 201 revision | 401; parser response; 404 course; 409 unindexed sources; 500 |
| `GET/POST /api/course-studio/courses/[courseId]/sources` | studio cookie | multipart file and existing extension/size/name rules | authoring source commands | 200 sources / 202 source+job | 401; 400/413/415 form validation; 404 course; 500 |
| `DELETE /api/course-studio/courses/[courseId]/sources/[sourceId]` | studio cookie | params | authoring source removal | 200 source | 401; 404; 409 frozen; 502 cleanup/RAG; 500 |
| `POST /api/course-studio/courses/[courseId]/sources/[sourceId]/retry` | studio cookie | params | authoring source retry | 202 source+job | 401; 404; 409 retry/removal/asset; 500 |
| `GET/DELETE /api/course-studio/courses/[courseId]/trash` | studio cookie | params | authoring trash commands | 200 trash | 401; 500 |
| `POST/DELETE /api/course-studio/courses/[courseId]/trash/[trashId]` | studio cookie | params | authoring trash-item commands | 200 course/trash | 401; 404; 409 restore conflict; 500 |
| `GET/POST /api/course-studio/generations` | studio cookie | `CourseGenerationRequestSchema` for POST | authoring generation commands | 200 list / 202 generation+job | 401; parser response; 404 revision; 409 empty revision; 500 |
| `GET /api/course-studio/generations/[generationId]` | studio cookie | params | authoring generation query | 200 generation | 401; 404 generation; 500 |
| `POST /api/course-studio/login` | submitted studio password | form `password` | studio token helper | 303 `/studio`, cookie | 303 `/studio/login?error=1` |
| `POST /api/course-studio/revisions/[revisionId]/review` | studio cookie | params | authoring review command | 200 review ID/URL | 401; 404 revision; 500 |
| `GET /api/jobs/[id]` | none | params | server job projection | 200 client-safe job | 404; 500 |
| `GET/POST /api/progress` | none | query UUID / `ProgressRequestSchema` | progress store | 200 progress / `{ok:true}` | 400 validation/type; 500 |
| `POST /api/quiz` | studio cookie for raw revision; review token otherwise | `RevisionBoundQuizRequestSchema` | revision-bound quiz job | 202 job | invalid payload; 401; 404 review/revision; 500 |
| `POST /api/quiz/grade` | none | `QuizGradeRequestSchema` | server answer key, grading, persistence | 200 grade | parser response; 400 bounds/count; 404 quiz; 422 misconfiguration; 500 |
| `POST /api/reviews/[token]/feedback` | review token param | feedback schema | review feedback command | 201 feedback | parser response; 404 token; 500 |

## Files changed

- Added authoring server commands/loaders for courses, assets, sources, generations, Studio pages, revisions, reviews, feedback, and trash.
- Added learning server commands for revision-bound sources, grounded chat, AI quiz requests, and answer-key/attempt persistence.
- Added review server loader/command, server job-status projection, and analytics password validation.
- Replaced direct infrastructure imports in API routes and in `app/studio` and `app/review` server pages with those server-owned use cases.

## Verification

| Command | Observed result |
| --- | --- |
| `find apps/web/src/app/api -name route.ts -print \| sort` | 26 public route files inventoried; no route URL or HTTP method was added or removed. |
| `rg -n "from '@moto-ai/(database\|jobs\|parser-client)'\|from '@aws-sdk/client-s3'" apps/web/src/app/api --glob '*.ts'` | No matches. |
| `rg -n '@moto-ai/(database\|jobs\|parser-client)\|@aws-sdk/client-s3' apps/web/src --glob '*.tsx'` | No matches, including the three server pages moved in this task. |
| `git diff --check` | Exit 0; no whitespace errors. |
| `npm run typecheck` | Exit 0; TypeScript passed for job-worker, web, contracts, database, jobs, and parser-client workspaces. |
| `npm run lint` | Exit 0; ESLint completed for `apps`, `packages`, and `scripts`. |

No tests, migration, build, or browser session were run: Task 5 explicitly excludes database changes and test work; dynamic route/auth/R2/parser behavior needs the later integration/browser task for runtime evidence.
