# Background Jobs Design

## Goal

Move document parsing and embedding, AI quiz generation, and future long-running AI work off request paths while retaining durable progress, retry, and result state in PostgreSQL.

## Scope

- Add a Prisma-backed queue with durable job and upload-artifact records.
- Run a dedicated Node worker that claims jobs and delegates AI work to the existing parser service.
- Make uploads and quiz generation asynchronous and pollable.
- Keep chat and grading synchronous.

## Architecture

`BackgroundJob` is the source of truth for queue state. It stores the job kind, input payload, status, progress, retry count, lease timestamps, result payload, public error, and deduplication key. `JobArtifact` stores the original upload bytes until indexing completes so a queued document survives web-process and worker restarts.

Next.js validates requests, writes durable job state, and returns `202 Accepted` with a job ID. A standalone Node worker atomically claims queued or expired leased jobs, invokes the parser service through the existing typed client, and records terminal results. Job-specific behavior is isolated in focused handlers.

## Job lifecycle

`queued` jobs are claimed as `running` with a time-bounded lease. Workers refresh progress while processing. Successful jobs become `succeeded`; input validation failures become `failed`; transport and local-model failures retry three times with exponential backoff. Expired leases are reclaimable. Document artifacts are deleted after successful indexing. Terminal job data is retained for seven days so clients can finish polling and operators can inspect failures.

## Public API and UX

- `POST /api/upload` persists an artifact and enqueues `document_index`.
- `POST /api/quiz` enqueues `quiz_generate`.
- `GET /api/jobs/[id]` reports public status, progress, result, and retryable error information.
- Sanity Studio renders queued, processing, success, and failure state for uploads.
- The learner quiz UI stays in its generating state and polls until the generated quiz is ready or fails.

## Constraints

- PostgreSQL and Prisma are the only queue infrastructure.
- The worker is started separately from Next.js using an npm script.
- Do not expose uploaded bytes, parser-service credentials, raw errors, or quiz answer keys through job status responses.
- Keep existing chat and grading endpoint semantics unchanged.
