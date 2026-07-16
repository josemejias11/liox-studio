# Background Jobs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add PostgreSQL-backed background processing for document indexing and quiz generation.

**Architecture:** Next.js routes persist jobs and return immediately; a dedicated Node worker claims durable jobs and calls the parser service. Job status is exposed through a small polling API, with the Studio upload control and learner quiz flow updated to consume it.

**Tech Stack:** Next.js 16, React 19, Prisma 5, PostgreSQL, TypeScript, FastAPI parser service.

## Global Constraints

- Keep chat and quiz grading synchronous.
- Do not add a test runner; the repository has no active test setup.
- Use the existing Prisma database and parser-service client.
- Never return artifact bytes, internal errors, or answer keys from job-status APIs.

---

### Task 1: Durable queue schema and shared contracts

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_background_jobs/migration.sql`
- Create: `src/lib/jobs/contracts.ts`
- Create: `src/lib/jobs/repository.ts`

**Interfaces:**

- Produces `JobKind`, `JobStatus`, `JobSnapshot`, and queue persistence functions.

- [ ] Add job and artifact models, including status, retry, lease, progress, result, public error, deduplication key, and timestamps.
- [ ] Generate the Prisma client and type-check the contracts.

### Task 2: Queue lifecycle and worker

**Files:**

- Create: `src/lib/jobs/queue.ts`
- Create: `src/lib/jobs/handlers.ts`
- Create: `src/jobs/worker.ts`
- Modify: `package.json`

**Interfaces:**

- Consumes queue contracts from Task 1 and existing parser-service functions.
- Produces `enqueueDocumentIndexJob`, `enqueueQuizGenerationJob`, `getJob`, and `npm run jobs:worker`.

- [ ] Implement deduplicated enqueueing, atomic claiming, lease expiry recovery, progress updates, retry scheduling, success/failure transitions, and artifact cleanup.
- [ ] Implement handlers that index uploaded document bytes and persist a server-only generated quiz.
- [ ] Add the dedicated worker script with bounded concurrency and polling.

### Task 3: HTTP APIs and client polling

**Files:**

- Modify: `src/app/api/upload/route.ts`
- Modify: `src/app/api/quiz/route.ts`
- Create: `src/app/api/jobs/[id]/route.ts`
- Modify: `src/sanity/components/CourseFileUploadInput.tsx`
- Modify: `src/components/course-ai/CourseQuiz.tsx`
- Modify: `src/lib/contracts/api.ts`
- Modify: `src/lib/contracts/quiz.ts`

**Interfaces:**

- Consumes the Task 2 enqueue and status functions.
- Produces 202 job envelopes and a public job-status projection.

- [ ] Return queued job IDs from upload and quiz APIs, preserving validation/auth behavior.
- [ ] Add authenticated/safe status polling.
- [ ] Update upload rows and quiz-generation UI to poll until terminal state.

### Task 4: Verification and documentation

**Files:**

- Modify: `README.md`
- Modify: `.env.example`

- [ ] Document worker startup and environment settings.
- [ ] Run Prisma generation, TypeScript type checking, linting, and a production build when PostgreSQL is available.
