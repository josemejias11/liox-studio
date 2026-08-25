# Repository Hardening Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every still-open finding from the `moto-ai-code-validation-report-2026-08-22.md` audit that has real, verified impact against the current codebase, right-sized to this app's actual local-only exposure today.

**Architecture:** Eleven independent tasks, each touching one subsystem: job-queue reliability (retention crash, SCORM idempotency), authorization gaps (job-status, analytics, course-scoping, learner endpoints), asset-upload/delivery hardening, freeze-time schema validation, SCORM packaging memory, session-cookie signing plus login rate limiting, parser source-replacement atomicity, and dependency/formatting/documentation drift. No task depends on another's code; they can be executed and committed in any order, though the plan sequences reliability fixes first per the spec's rationale.

**Tech Stack:** TypeScript, Next.js App Router, Prisma/PostgreSQL, Node `crypto`, `archiver`; Python 3.11/FastAPI/Chroma for the one parser-service task.

**Spec:** `docs/superpowers/specs/2026-08-23-repo-hardening-remediation-design.md`

## Global Constraints

- Do not add new automated JS/TS test files. Verification for every TypeScript/web task is `npm run typecheck`, `npm run lint`, `npm run build`, targeted Prettier, direct Prisma queries, and authenticated browser acceptance where relevant — matching this repository's established convention (see `CLAUDE.md` and the prior plan).
- Task 10 (parser service) is the one exception: this repo's `services/parser-service` already has an established `python -m unittest discover -s tests` convention documented in `CLAUDE.md`. Write that task test-first with a real failing test.
- No multi-tenant / per-course ACL system. Course Studio remains single shared-password authorization. Course-scoping fixes prevent accidental cross-course mutation from a client-side ID mix-up; they do not add authorization boundaries between courses.
- No signed learner-session capability system. `/api/progress` and `/api/quiz/grade` get relationship checks (does this ID actually belong to that course), not a new capability token — there is no public learner-delivery surface yet to protect with one.
- No `CourseAsset.courseId` migration. `scripts/cleanup-orphaned-course-assets.ts` already solves orphan accumulation globally and is documented in `README.md`. Not touched by this plan.
- No distributed rate limiter (Upstash or similar). A small in-memory fixed-window limiter is right-sized for this single-process local dev server.
- Keep `isCourseStudioAuthorized(request)` and every page-level auth check's external call shape unchanged wherever a caller doesn't need to change — Task 9 rewrites what these functions do internally, not their signatures, specifically to avoid touching all 22 existing call sites unnecessarily.
- Format only files owned by the active task; do not run the root formatter across the whole repo.
- Each task receives an implementation review before its commit. Stage only the files listed for that task.

## File ownership map

- `packages/jobs/src/queue.ts`: `cleanupExpiredJobs()` retention query.
- `apps/job-worker/src/index.ts`: cleanup-tick error handling.
- `apps/job-worker/src/handlers.ts`: `scormExport()` idempotency.
- `apps/web/src/app/api/jobs/[id]/route.ts`: job-status authorization.
- `apps/web/src/analytics/server/analytics-auth.ts`: analytics request authorization.
- `apps/web/src/app/api/analytics/weak-topics/route.ts`: analytics API authorization.
- `apps/web/src/app/api/course-studio/assets/route.ts`, `apps/web/src/app/api/course-assets/[...key]/route.ts`, `apps/web/src/server/storage/course-assets.ts`: asset upload/delivery hardening.
- `packages/database/src/course-review-repository.ts`: freeze-time canonical schema validation.
- `packages/database/src/course-repository.ts`, `apps/web/src/authoring/server/course-commands.ts`, `apps/web/src/app/api/course-studio/courses/[courseId]/chapters/route.ts`, `.../lessons/route.ts`: course-scoping invariants.
- `apps/web/src/app/api/progress/route.ts`, `apps/web/src/app/api/quiz/grade/route.ts`, `apps/web/src/learning/server/progress-store.ts`, `apps/web/src/learning/server/quiz-grading.ts`: learner-endpoint relationship checks.
- `packages/scorm-export/src/build-package.ts`: SCORM packaging memory.
- `apps/web/src/server/auth/course-studio.ts`, `apps/web/src/server/auth/session-token.ts` (new), `apps/web/src/server/auth/rate-limit.ts` (new), `apps/web/src/analytics/server/analytics-auth.ts`, both login routes, `apps/web/src/app/studio/actions.ts`, `apps/web/src/app/studio/page.tsx`, `apps/web/src/app/studio/[courseId]/page.tsx`: session signing and login rate limiting.
- `services/parser-service/src/moto_parser/retrieval.py`, `services/parser-service/tests/test_retrieval.py` (new): parser atomicity.
- Dependency manifests, 8 drifted files, `services/parser-service/pyproject.toml`, `services/parser-service/.env.example`, `.github/workflows/validate.yml` (new): drift cleanup.

---

### Task 1: Fix job-retention foreign-key crash and make cleanup non-fatal

**Files:**

- Modify: `packages/jobs/src/queue.ts`
- Modify: `apps/job-worker/src/index.ts`

**Interfaces:**

- Consumes: existing `BackgroundJob.generation` / `BackgroundJob.scormExport` optional back-relations (`packages/database/prisma/schema.prisma`).
- Produces: no interface change — `cleanupExpiredJobs(): Promise<void>` keeps its exact signature.

- [ ] **Step 1: Exclude retained jobs from the cleanup query**

In `packages/jobs/src/queue.ts`, find `cleanupExpiredJobs` (around line 612):

```ts
export async function cleanupExpiredJobs(): Promise<void> {
  const cutoff = new Date(Date.now() - RETENTION_MS);
  await prisma.backgroundJob.deleteMany({
    where: {
      status: { in: [BackgroundJobStatus.SUCCEEDED, BackgroundJobStatus.FAILED] },
      completedAt: { lt: cutoff },
    },
  });
}
```

Replace with:

```ts
export async function cleanupExpiredJobs(): Promise<void> {
  const cutoff = new Date(Date.now() - RETENTION_MS);
  await prisma.backgroundJob.deleteMany({
    where: {
      status: { in: [BackgroundJobStatus.SUCCEEDED, BackgroundJobStatus.FAILED] },
      completedAt: { lt: cutoff },
      generation: null,
      scormExport: null,
    },
  });
}
```

A job with a retained `CourseGeneration` or `CourseScormExport` row is now excluded from deletion entirely, so the FK-violation path this finding describes can't occur. Retained rows accumulate past the retention window rather than being deleted — that's the correct behavior, since the FK is `Restrict` precisely because those records must outlive their originating job.

- [ ] **Step 2: Make a cleanup failure non-fatal to the worker loop**

In `apps/job-worker/src/index.ts`, find the main loop (around line 60-67):

```ts
while (true) {
  const processed = await processOneJob();
  if (Date.now() >= cleanupAt) {
    await cleanupExpiredJobs();
    cleanupAt = Date.now() + 60 * 60 * 1000;
  }
  if (!processed) await sleep(POLL_INTERVAL_MS);
}
```

Replace the cleanup call with a caught one, as defense in depth against any _other_ future cleanup failure mode:

```ts
while (true) {
  const processed = await processOneJob();
  if (Date.now() >= cleanupAt) {
    try {
      await cleanupExpiredJobs();
    } catch (error) {
      console.error('[jobs] cleanup failed (continuing):', error);
    }
    cleanupAt = Date.now() + 60 * 60 * 1000;
  }
  if (!processed) await sleep(POLL_INTERVAL_MS);
}
```

- [ ] **Step 3: Verify**

```bash
npx prettier --write packages/jobs/src/queue.ts apps/job-worker/src/index.ts
npm run typecheck
npm run lint
git diff --check
```

With PostgreSQL running, directly verify the new query excludes retained jobs: create a `BackgroundJob` row with `completedAt` in the past and a related `CourseScormExport` row (or inspect an existing one from local testing), run `cleanupExpiredJobs()` via a short Node script (`node --env-file=.env -e "..."` against `@moto-ai/jobs`), and confirm the row survives. Confirm an unrelated old succeeded job with no retained relation is still deleted.

- [ ] **Step 4: Commit**

```bash
git add packages/jobs/src/queue.ts apps/job-worker/src/index.ts
git commit -m "fix: exclude retained jobs from cleanup and survive cleanup failure"
```

---

### Task 2: Make SCORM export completion idempotent

**Files:**

- Modify: `apps/job-worker/src/handlers.ts`

**Interfaces:**

- Consumes: `CourseScormExport.jobId` (`@unique`, already in `packages/database/prisma/schema.prisma`).
- Produces: `scormExport(job: ClaimedJob): Promise<ScormExportResult>` keeps its exact signature and return shape.

- [ ] **Step 1: Return an existing export before doing any work**

In `apps/job-worker/src/handlers.ts`, find `scormExport()` (around line 202). Immediately after the existing payload/artifact/revision validation (before the player-bundle read and `buildScormPackage()` call), add an idempotency check mirroring the pattern already used for `COURSE_DUPLICATE` (`findCourseCreatedByJob` in `packages/database/src/course-duplication-repository.ts:93-99`):

```ts
const existingExport = await prisma.courseScormExport.findUnique({
  where: { jobId: job.id },
  select: { id: true, byteSize: true, sha256: true },
});
if (existingExport) {
  return {
    exportId: existingExport.id,
    byteSize: existingExport.byteSize,
    sha256: existingExport.sha256,
  };
}
```

Place this after the `revision` lookup/validation and before the player-bundle file reads, so a retry after a crash between the successful `courseScormExport.create()` and the queue's `completeJob()` commit skips re-downloading the player bundle, rebuilding the ZIP, and re-uploading it entirely — not just the database write. The export's storage key (`exports/${revision.id}/${job.id}.zip`) is already deterministic per `job.id`, so even if a retry somehow reached the upload step again, it would overwrite the same key with identical bytes; this early return just avoids the redundant work and closes the actual failure mode (the unique-constraint throw on `.create()`).

- [ ] **Step 2: Verify**

```bash
npx prettier --write apps/job-worker/src/handlers.ts
npm run typecheck
npm run lint
git diff --check
```

With PostgreSQL, the worker, and the web app running: freeze a course, trigger a SCORM export, let it complete once, then directly invoke the job-worker's `scormExport()` handler again for that same completed job's `ClaimedJob` shape (or, more simply, requeue by calling `enqueueScormExportJob` with the same deterministic inputs isn't idempotent by request — instead, verify by reading the code path: confirm `existingExport` is returned before any `readFile`/`buildScormPackage`/`putObject` call executes, by temporarily adding a `console.log` before the early return, exporting once, and confirming the log appears exactly once during the real export and would short-circuit correctly on a hypothetical retry). Remove any temporary logging before committing.

- [ ] **Step 3: Commit**

```bash
git add apps/job-worker/src/handlers.ts
git commit -m "fix: make SCORM export completion idempotent on retry"
```

---

### Task 3: Require authorization on job-status and analytics APIs

**Files:**

- Modify: `apps/web/src/app/api/jobs/[id]/route.ts`
- Modify: `apps/web/src/analytics/server/analytics-auth.ts`
- Modify: `apps/web/src/app/api/analytics/weak-topics/route.ts`

**Interfaces:**

- Consumes: existing `isCourseStudioAuthorized(request: NextRequest): Promise<boolean>` (`apps/web/src/server/auth/course-studio.ts`).
- Produces: `isAnalyticsAuthorized(request: NextRequest): boolean`, following the same shape.

- [ ] **Step 1: Authorize the job-status endpoint**

In `apps/web/src/app/api/jobs/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';

import { jsonError, unexpectedApiError } from '@/shared/server/http';
import { getClientSafeJobStatus } from '@/server/jobs/job-status';

export const runtime = 'nodejs';
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const job = await getClientSafeJobStatus(id);
    if (!job) return jsonError('Job not found', 404);
    return NextResponse.json(job);
  } catch (error: unknown) {
    return unexpectedApiError('api/jobs GET', error);
  }
}
```

becomes:

```ts
import { NextRequest, NextResponse } from 'next/server';

import { isCourseStudioAuthorized } from '@/server/auth/course-studio';
import { jsonError, unexpectedApiError } from '@/shared/server/http';
import { getClientSafeJobStatus } from '@/server/jobs/job-status';

export const runtime = 'nodejs';
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isCourseStudioAuthorized(request))) return jsonError('Unauthorized', 401);
  const { id } = await params;
  try {
    const job = await getClientSafeJobStatus(id);
    if (!job) return jsonError('Job not found', 404);
    return NextResponse.json(job);
  } catch (error: unknown) {
    return unexpectedApiError('api/jobs GET', error);
  }
}
```

Every job kind this endpoint serves today (document indexing, Q&A generation, course generation, SCORM export, course duplication) is authoring-only, so `isCourseStudioAuthorized` is the correct single guard — this repo has no other job kind category that needs a different check.

- [ ] **Step 2: Add a request-based analytics authorization helper**

In `apps/web/src/analytics/server/analytics-auth.ts`:

```ts
export function isAnalyticsPasswordValid(submitted: FormDataEntryValue | null): boolean {
  const expected = process.env.ANALYTICS_PASSWORD;
  return !!expected && typeof submitted === 'string' && submitted === expected;
}

export function analyticsCookieValue(): string | null {
  return process.env.ANALYTICS_PASSWORD ?? null;
}
```

Add, importing `NextRequest` from `next/server`:

```ts
import type { NextRequest } from 'next/server';

export function isAnalyticsAuthorized(request: NextRequest): boolean {
  const expected = process.env.ANALYTICS_PASSWORD;
  const token = request.cookies.get('analytics_token')?.value;
  return !!expected && token === expected;
}
```

(This mirrors the exact check `proxy.ts` already does for analytics pages; Task 9 replaces this bare-comparison implementation with a signed-token one — this step only makes the check callable from an API route.)

- [ ] **Step 3: Authorize the weak-topics API**

In `apps/web/src/app/api/analytics/weak-topics/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { WeakTopicsRequestSchema } from '@/shared/contracts/api';
import { getWeakTopicsForCourse } from '@/analytics/server/analytics.service';
import { readJson, unexpectedApiError } from '@/shared/server/http';

export async function POST(req: NextRequest) {
  const parsed = await readJson(req, WeakTopicsRequestSchema);
  if (!parsed.success) return parsed.response;

  const { courseId, lessons } = parsed.data;

  try {
    const result = await getWeakTopicsForCourse(courseId, lessons);
    return NextResponse.json(result);
  } catch (err: unknown) {
    return unexpectedApiError('api/analytics/weak-topics', err);
  }
}
```

becomes:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { isAnalyticsAuthorized } from '@/analytics/server/analytics-auth';
import { WeakTopicsRequestSchema } from '@/shared/contracts/api';
import { getWeakTopicsForCourse } from '@/analytics/server/analytics.service';
import { jsonError, readJson, unexpectedApiError } from '@/shared/server/http';

export async function POST(req: NextRequest) {
  if (!isAnalyticsAuthorized(req)) return jsonError('Unauthorized', 401);
  const parsed = await readJson(req, WeakTopicsRequestSchema);
  if (!parsed.success) return parsed.response;

  const { courseId, lessons } = parsed.data;

  try {
    const result = await getWeakTopicsForCourse(courseId, lessons);
    return NextResponse.json(result);
  } catch (err: unknown) {
    return unexpectedApiError('api/analytics/weak-topics', err);
  }
}
```

- [ ] **Step 4: Verify**

```bash
npx prettier --write apps/web/src/app/api/jobs/[id]/route.ts apps/web/src/analytics/server/analytics-auth.ts apps/web/src/app/api/analytics/weak-topics/route.ts
npm run typecheck
npm run lint
git diff --check
```

With the web app running: confirm `curl -i http://localhost:3000/api/jobs/some-id` returns 401 with no cookie, and confirm `CourseDuplicationStatusPanel` still polls successfully in an authenticated `/studio` browser session (it already sends the `course_studio_token` cookie by default same-origin, so this must keep working with no client change). Confirm `curl -i -X POST http://localhost:3000/api/analytics/weak-topics -d '{}'` returns 401 with no cookie, and that the analytics dashboard's weak-topics call still works after logging in at `/analytics/login`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/jobs/[id]/route.ts apps/web/src/analytics/server/analytics-auth.ts apps/web/src/app/api/analytics/weak-topics/route.ts
git commit -m "fix: require authorization on job-status and analytics APIs"
```

---

### Task 4: Harden course asset upload validation and delivery

**Files:**

- Modify: `apps/web/src/app/api/course-studio/assets/route.ts`
- Modify: `apps/web/src/app/api/course-assets/[...key]/route.ts`
- Create: `apps/web/src/server/storage/asset-signatures.ts`

**Interfaces:**

- Produces: `detectAssetSignature(bytes: Uint8Array): { extension: string; contentType: string } | null` — pure, no I/O.
- Consumes: existing `uploadAuthoringAsset({ courseId, filename, contentType, bytes })` (`apps/web/src/authoring/server/asset-commands.ts`) — signature unchanged, callers now pass a server-verified `contentType`.

- [ ] **Step 1: Add a magic-byte signature allowlist**

Create `apps/web/src/server/storage/asset-signatures.ts`. This covers exactly the formats Course Studio's own upload UI offers (`accept="image/*"` and `accept="image/*,video/*"` / `accept="video/*"` across `AssessmentQuestionsField.tsx` and `LessonInspector.tsx` — no audio upload exists in this product):

```ts
interface AssetSignature {
  extension: string;
  contentType: string;
  matches: (bytes: Uint8Array) => boolean;
}

const SIGNATURES: AssetSignature[] = [
  {
    extension: '.jpg',
    contentType: 'image/jpeg',
    matches: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    extension: '.png',
    contentType: 'image/png',
    matches: (b) =>
      b.length >= 8 &&
      b[0] === 0x89 &&
      b[1] === 0x50 &&
      b[2] === 0x4e &&
      b[3] === 0x47 &&
      b[4] === 0x0d &&
      b[5] === 0x0a &&
      b[6] === 0x1a &&
      b[7] === 0x0a,
  },
  {
    extension: '.gif',
    contentType: 'image/gif',
    matches: (b) =>
      b.length >= 6 &&
      b[0] === 0x47 &&
      b[1] === 0x49 &&
      b[2] === 0x46 &&
      b[3] === 0x38 &&
      (b[4] === 0x37 || b[4] === 0x39) &&
      b[5] === 0x61,
  },
  {
    extension: '.webp',
    contentType: 'image/webp',
    matches: (b) =>
      b.length >= 12 &&
      b[0] === 0x52 &&
      b[1] === 0x49 &&
      b[2] === 0x46 &&
      b[3] === 0x46 &&
      b[8] === 0x57 &&
      b[9] === 0x45 &&
      b[10] === 0x42 &&
      b[11] === 0x50,
  },
  {
    extension: '.mp4',
    contentType: 'video/mp4',
    matches: (b) =>
      b.length >= 12 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70,
  },
  {
    extension: '.webm',
    contentType: 'video/webm',
    matches: (b) =>
      b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3,
  },
];

export function detectAssetSignature(
  bytes: Uint8Array,
): { extension: string; contentType: string } | null {
  const match = SIGNATURES.find((signature) => signature.matches(bytes));
  return match ? { extension: match.extension, contentType: match.contentType } : null;
}
```

- [ ] **Step 2: Reject unrecognized uploads and use the sniffed content-type**

In `apps/web/src/app/api/course-studio/assets/route.ts`, replace the caller-trusted content-type with a server-verified one. Current body (around line 16-45):

```ts
  if (SOURCE_EXTENSIONS.has(extension(file.name))) {
    return NextResponse.json(
      { error: 'Course documents must be uploaded through the course source library' },
      { status: 400 },
    );
  }

  try {
    const asset = await uploadAuthoringAsset({
      courseId,
      filename: file.name,
      contentType: file.type || undefined,
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
```

becomes:

```ts
  if (SOURCE_EXTENSIONS.has(extension(file.name))) {
    return NextResponse.json(
      { error: 'Course documents must be uploaded through the course source library' },
      { status: 400 },
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const signature = detectAssetSignature(bytes);
  if (!signature) {
    return NextResponse.json(
      { error: 'Only JPEG, PNG, GIF, WebP images or MP4/WebM video are accepted' },
      { status: 400 },
    );
  }

  try {
    const asset = await uploadAuthoringAsset({
      courseId,
      filename: file.name,
      contentType: signature.contentType,
      bytes,
    });
```

Add the import at the top of the file:

```ts
import { detectAssetSignature } from '@/server/storage/asset-signatures';
```

- [ ] **Step 3: Add defensive delivery headers**

In `apps/web/src/app/api/course-assets/[...key]/route.ts`, find the headers construction:

```ts
const headers = new Headers({
  'Cache-Control': 'public, max-age=31536000, immutable',
  'Content-Type': object.ContentType ?? 'application/octet-stream',
});
```

Replace with:

```ts
const headers = new Headers({
  'Cache-Control': 'public, max-age=31536000, immutable',
  'Content-Type': object.ContentType ?? 'application/octet-stream',
  'Content-Disposition': 'inline',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': 'sandbox',
});
```

`X-Content-Type-Options: nosniff` stops the browser from re-sniffing a stored content-type into something more dangerous than what Step 2 already verified server-side; `Content-Security-Policy: sandbox` on the response prevents any content served from this endpoint from executing script or navigating top-level, even in the event a future format gets added to the allowlist without equally careful signature verification. Both are harmless for the actual image/video responses this endpoint serves.

- [ ] **Step 4: Verify**

```bash
npx prettier --write apps/web/src/app/api/course-studio/assets/route.ts apps/web/src/app/api/course-assets/[...key]/route.ts apps/web/src/server/storage/asset-signatures.ts
npm run typecheck
npm run lint
git diff --check
```

With the web app running and authenticated: upload a real JPEG/PNG/MP4 through a lesson's media field and confirm it still renders correctly (proves the signature table matches real browser-exported files, not just the byte patterns on paper). Then `curl -X POST http://localhost:3000/api/course-studio/assets -F courseId=<id> -F file=@/tmp/fake.html;type=image/png` with a plain-text/HTML file renamed to look like an image and confirm the upload is rejected with 400, not accepted. Confirm a legitimate delivered asset's response headers include the three new ones via `curl -I`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/course-studio/assets/route.ts apps/web/src/app/api/course-assets/[...key]/route.ts apps/web/src/server/storage/asset-signatures.ts
git commit -m "fix: verify asset upload signatures and harden delivery headers"
```

---

### Task 5: Validate the full canonical player schema before freezing a revision

**Files:**

- Modify: `packages/database/src/course-review-repository.ts`
- Modify: `apps/web/src/app/api/course-studio/courses/[courseId]/revisions/route.ts`

**Interfaces:**

- Consumes: existing `toPlayerCourseContent` from `@/learning/course-player-adapter` (already used the same way by `requestScormExport` in `apps/web/src/authoring/server/course-commands.ts:41,190`).

- [ ] **Step 1: Run the canonical schema parse inside the freeze transaction**

In `packages/database/src/course-review-repository.ts`, find `freezeCourseRevision` (around line 89-124). After the existing readiness check:

```ts
const graph = toCourseGraph(course);
const readinessIssues = validateCourseReadiness(graph);
if (readinessIssues.length > 0) throw new CourseNotReadyError(readinessIssues);
```

add a canonical-schema parse before proceeding to build the revision snapshot:

```ts
const graph = toCourseGraph(course);
const readinessIssues = validateCourseReadiness(graph);
if (readinessIssues.length > 0) throw new CourseNotReadyError(readinessIssues);
if (!toPlayerCourseContent(graph, { includeAnswerKey: true })) {
  throw new Error('COURSE_GRAPH_INVALID');
}
```

Import it the same way `requestScormExport` already does in `apps/web/src/authoring/server/course-commands.ts:41,190`:

```ts
import { toPlayerCourseContent } from '@/learning/course-player-adapter';
```

Reuse this exact import path so both call sites stay in sync against one schema, not two.

- [ ] **Step 2: Surface the failure as an actionable readiness-shaped error**

In `apps/web/src/app/api/course-studio/courses/[courseId]/revisions/route.ts`, the `POST` handler's catch block currently reads:

```ts
  } catch (error) {
    if (error instanceof CourseNotReadyError) {
      return NextResponse.json(
        { error: 'Course is not ready for delivery', issues: error.issues },
        { status: 422 },
      );
    }
    if (error instanceof Error && error.message === 'COURSE_NOT_FOUND') {
      return jsonError('Course not found', 404);
    }
    if (error instanceof Error && error.message === 'COURSE_SOURCES_NOT_INDEXED') {
      return jsonError('All course sources must finish indexing before freezing a revision', 409);
    }
    return unexpectedApiError('course-studio/revisions', error);
  }
```

Add one more branch, alongside the `COURSE_SOURCES_NOT_INDEXED` check and before the final `unexpectedApiError` fallback:

```ts
if (error instanceof Error && error.message === 'COURSE_GRAPH_INVALID') {
  return jsonError(
    'This course has an invalid screen or field that cannot be frozen. Check recent edits and try again.',
    422,
  );
}
```

- [ ] **Step 3: Verify**

```bash
npx prettier --write packages/database/src/course-review-repository.ts apps/web/src/app/api/course-studio/courses/[courseId]/revisions/route.ts
npm run typecheck
npm run lint
git diff --check
```

With the app running: freeze a normal, valid course and confirm freezing still succeeds exactly as before (this must not regress the common case — the canonical schema should already accept anything readiness accepts). If you can construct an invalid graph shape that readiness rules don't specifically check (for example, a malformed Portable Text body written directly via a raw API call bypassing the guided editors), confirm freeze now rejects it with 422 and a clear message instead of succeeding and failing later at review/export time.

- [ ] **Step 4: Commit**

```bash
git add packages/database/src/course-review-repository.ts apps/web/src/app/api/course-studio/courses/[courseId]/revisions/route.ts
git commit -m "fix: validate the canonical player schema before freezing a revision"
```

---

### Task 6: Fix course-scoping invariants on chapter and lesson mutation

**Files:**

- Modify: `packages/database/src/course-repository.ts`
- Modify: `apps/web/src/authoring/server/course-commands.ts`
- Modify: `apps/web/src/app/api/course-studio/courses/[courseId]/chapters/route.ts`
- Modify: `apps/web/src/app/api/course-studio/courses/[courseId]/lessons/route.ts`

**Interfaces:**

- Produces: `updateChapter(chapterId, courseId, input)`, `deleteChapter(chapterId, courseId)`, `createLesson(chapterId, courseId, lessonType)`, `updateLesson(lessonId, courseId, input)`, `duplicateLesson(lessonId, courseId)` — each now takes the caller-claimed `courseId` and throws `CHAPTER_NOT_FOUND` / `LESSON_NOT_FOUND` on a mismatch (indistinguishable from the entity not existing at all, so this doesn't leak cross-course existence).
- Consumes: existing `courseIdForChapter` / `lessonLocation` internal helpers, extended to verify rather than just resolve.

- [ ] **Step 1: Make the internal lookup helpers verify ownership**

In `packages/database/src/course-repository.ts`, find both helpers (around line 47-63):

```ts
async function courseIdForChapter(chapterId: string): Promise<string> {
  const chapter = await prisma.courseChapter.findUnique({
    where: { id: chapterId },
    select: { courseId: true },
  });
  if (!chapter) throw new Error('CHAPTER_NOT_FOUND');
  return chapter.courseId;
}

async function lessonLocation(lessonId: string): Promise<{ courseId: string; chapterId: string }> {
  const lesson = await prisma.courseLesson.findUnique({
    where: { id: lessonId },
    select: { chapterId: true, chapter: { select: { courseId: true } } },
  });
  if (!lesson) throw new Error('LESSON_NOT_FOUND');
  return { courseId: lesson.chapter.courseId, chapterId: lesson.chapterId };
}
```

Replace with:

```ts
async function courseIdForChapter(chapterId: string, expectedCourseId: string): Promise<string> {
  const chapter = await prisma.courseChapter.findUnique({
    where: { id: chapterId },
    select: { courseId: true },
  });
  if (!chapter || chapter.courseId !== expectedCourseId) throw new Error('CHAPTER_NOT_FOUND');
  return chapter.courseId;
}

async function lessonLocation(
  lessonId: string,
  expectedCourseId: string,
): Promise<{ courseId: string; chapterId: string }> {
  const lesson = await prisma.courseLesson.findUnique({
    where: { id: lessonId },
    select: { chapterId: true, chapter: { select: { courseId: true } } },
  });
  if (!lesson || lesson.chapter.courseId !== expectedCourseId) throw new Error('LESSON_NOT_FOUND');
  return { courseId: lesson.chapter.courseId, chapterId: lesson.chapterId };
}
```

- [ ] **Step 2: Thread `courseId` through every caller of these helpers**

In the same file, update each function that calls them (around lines 256-345):

```ts
export async function updateChapter(chapterId: string, input: ChapterInput): Promise<CourseGraph> {
  const courseId = await courseIdForChapter(chapterId);
  await prisma.courseChapter.update({ where: { id: chapterId }, data: input });
  return requireGraph(courseId);
}

export async function deleteChapter(chapterId: string): Promise<CourseGraph> {
  const courseId = await courseIdForChapter(chapterId);
  ...
```

becomes:

```ts
export async function updateChapter(
  chapterId: string,
  courseId: string,
  input: ChapterInput,
): Promise<CourseGraph> {
  await courseIdForChapter(chapterId, courseId);
  await prisma.courseChapter.update({ where: { id: chapterId }, data: input });
  return requireGraph(courseId);
}

export async function deleteChapter(chapterId: string, courseId: string): Promise<CourseGraph> {
  await courseIdForChapter(chapterId, courseId);
  ...
```

(leave the rest of `deleteChapter`'s body unchanged — it already re-derives from `courseId`, just remove the reassignment since `courseId` is now a parameter, not a local returned from the helper).

Apply the same pattern to `createLesson`, `updateLesson`, and `duplicateLesson`:

```ts
export async function createLesson(
  chapterId: string,
  courseId: string,
  lessonType: CourseLessonType,
): Promise<CourseGraph> {
  await courseIdForChapter(chapterId, courseId);
  await prisma.$transaction(async (tx) => {
    const position = await tx.courseLesson.count({ where: { chapterId } });
    await tx.courseLesson.create({
      data: {
        id: newId('lesson'),
        chapterId,
        position,
        lessonType,
        headline: `New ${lessonType} screen`,
        payload: {},
      },
    });
  });
  return requireGraph(courseId);
}

export async function updateLesson(
  lessonId: string,
  courseId: string,
  input: LessonInput,
): Promise<CourseGraph> {
  await lessonLocation(lessonId, courseId);
  await prisma.courseLesson.update({
    where: { id: lessonId },
    data: {
      ...(input.headline !== undefined ? { headline: input.headline } : {}),
      ...(input.body !== undefined
        ? { body: jsonValue(input.body as Prisma.InputJsonValue | null) }
        : {}),
      ...(input.payload !== undefined ? { payload: input.payload as Prisma.InputJsonValue } : {}),
    },
  });
  return requireGraph(courseId);
}

export async function duplicateLesson(lessonId: string, courseId: string): Promise<CourseGraph> {
  const { chapterId } = await lessonLocation(lessonId, courseId);
  await prisma.$transaction(async (tx) => {
    const source = await tx.courseLesson.findUniqueOrThrow({ where: { id: lessonId } });
    ...
```

(leave the remainder of `duplicateLesson`'s transaction body unchanged.)

- [ ] **Step 3: Fix the lesson branch of `reorderCourseItem`**

In the same file, find `reorderCourseItem`'s lesson branch (around line 372-394):

```ts
const lesson = await tx.courseLesson.findUnique({
  where: { id: input.id },
  select: { chapterId: true },
});
if (!lesson) throw new Error('LESSON_NOT_FOUND');
```

becomes:

```ts
const lesson = await tx.courseLesson.findUnique({
  where: { id: input.id },
  select: { chapterId: true, chapter: { select: { courseId: true } } },
});
if (!lesson || lesson.chapter.courseId !== courseId) throw new Error('LESSON_NOT_FOUND');
```

The chapter branch above it already scopes its `findMany` by `{ courseId }`, so a mismatched chapter ID already silently no-ops via `index < 0` — no change needed there.

- [ ] **Step 4: Update the command layer to pass `courseId` through**

In `apps/web/src/authoring/server/course-commands.ts` (around lines 59-76, 98-121):

```ts
export function updateAuthoringChapter(
  chapterId: string,
  input: { title?: string; estimatedDuration?: number | null },
) {
  return updateChapter(chapterId, input);
}

export function deleteAuthoringChapter(chapterId: string) {
  return deleteChapter(chapterId);
}

export function createAuthoringLesson(chapterId: string, lessonType: CourseLessonType) {
  return createLesson(chapterId, lessonType);
}

export function updateAuthoringLesson(lessonId: string, input: LessonInput) {
  return updateLesson(lessonId, input);
}
```

becomes:

```ts
export function updateAuthoringChapter(
  courseId: string,
  chapterId: string,
  input: { title?: string; estimatedDuration?: number | null },
) {
  return updateChapter(chapterId, courseId, input);
}

export function deleteAuthoringChapter(courseId: string, chapterId: string) {
  return deleteChapter(chapterId, courseId);
}

export function createAuthoringLesson(
  courseId: string,
  chapterId: string,
  lessonType: CourseLessonType,
) {
  return createLesson(chapterId, courseId, lessonType);
}

export function updateAuthoringLesson(courseId: string, lessonId: string, input: LessonInput) {
  return updateLesson(lessonId, courseId, input);
}
```

And in `deleteOrDuplicateAuthoringLesson` (around line 98-121), pass `courseId` into the duplicate branch too, closing the same gap there:

```ts
if (action === 'duplicate') return { course: await duplicateLesson(lessonId) };
```

becomes:

```ts
if (action === 'duplicate') return { course: await duplicateLesson(lessonId, courseId) };
```

- [ ] **Step 5: Read `courseId` in the two route files**

In `apps/web/src/app/api/course-studio/courses/[courseId]/chapters/route.ts`, the `PATCH` and `DELETE` handlers currently don't destructure `{ params }` at all:

```ts
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  if (!(await isCourseStudioAuthorized(request))) return jsonError('Unauthorized', 401);
  const body = await readJson(request, updateSchema);
  if (!body.success) return body.response;
  const { chapterId, ...input } = body.data;
  try {
    return NextResponse.json({ course: await updateAuthoringChapter(chapterId, input) });
  } catch (error) {
    return chapterError(error);
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  if (!(await isCourseStudioAuthorized(request))) return jsonError('Unauthorized', 401);
  const body = await readJson(request, deleteSchema);
  if (!body.success) return body.response;
  try {
    return NextResponse.json({ course: await deleteAuthoringChapter(body.data.chapterId) });
  } catch (error) {
    return chapterError(error);
  }
}
```

becomes:

```ts
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
): Promise<NextResponse> {
  if (!(await isCourseStudioAuthorized(request))) return jsonError('Unauthorized', 401);
  const body = await readJson(request, updateSchema);
  if (!body.success) return body.response;
  const { chapterId, ...input } = body.data;
  try {
    return NextResponse.json({
      course: await updateAuthoringChapter((await params).courseId, chapterId, input),
    });
  } catch (error) {
    return chapterError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
): Promise<NextResponse> {
  if (!(await isCourseStudioAuthorized(request))) return jsonError('Unauthorized', 401);
  const body = await readJson(request, deleteSchema);
  if (!body.success) return body.response;
  try {
    return NextResponse.json({
      course: await deleteAuthoringChapter((await params).courseId, body.data.chapterId),
    });
  } catch (error) {
    return chapterError(error);
  }
}
```

Apply the equivalent change to `apps/web/src/app/api/course-studio/courses/[courseId]/lessons/route.ts`'s `POST` and `PATCH` handlers — both currently take no `{ params }` either; add it the same way and pass `(await params).courseId` as the new first argument to `createAuthoringLesson` / `updateAuthoringLesson`.

- [ ] **Step 6: Verify**

```bash
npx prettier --write packages/database/src/course-repository.ts apps/web/src/authoring/server/course-commands.ts "apps/web/src/app/api/course-studio/courses/[courseId]/chapters/route.ts" "apps/web/src/app/api/course-studio/courses/[courseId]/lessons/route.ts"
npm run typecheck
npm run lint
git diff --check
```

With the app running: confirm ordinary chapter/lesson editing on `/studio/<courseId>` still works exactly as before (rename a chapter, edit a lesson headline, reorder both). Then directly `curl` a `PATCH` to `.../courses/<real-course-A-id>/chapters` with a `chapterId` that actually belongs to a different course B, and confirm it now returns 404 instead of silently editing course B's chapter.

- [ ] **Step 7: Commit**

```bash
git add packages/database/src/course-repository.ts apps/web/src/authoring/server/course-commands.ts "apps/web/src/app/api/course-studio/courses/[courseId]/chapters/route.ts" "apps/web/src/app/api/course-studio/courses/[courseId]/lessons/route.ts"
git commit -m "fix: verify course ownership before mutating chapters and lessons"
```

---

### Task 7: Bind learner progress and quiz-grading endpoints to real relationships

**Files:**

- Modify: `apps/web/src/learning/server/progress-store.ts`
- Modify: `apps/web/src/app/api/progress/route.ts`
- Modify: `apps/web/src/learning/server/quiz-grading.ts`
- Modify: `apps/web/src/app/api/quiz/grade/route.ts`
- Modify: `apps/web/src/shared/contracts/api.ts` (make `ProgressRequestSchema`'s `courseId` required)
- Modify: `packages/contracts/src/quiz.ts` (make `SubmitQuizRequestSchema`'s `courseId` required)

**Interfaces:**

- Produces: `recordLessonView` / `recordHotspots` now require `courseId` (already optional in their input types — make it required) and verify the lesson actually belongs to that course before writing. `loadQuizAnswerKey` returns the quiz's real `courseId` alongside the existing shape so the route can compare it against the request's claimed `courseId`.

- [ ] **Step 1: Require and verify `courseId` in the progress store**

In `apps/web/src/learning/server/progress-store.ts`, change `RecordLessonViewInput` and `RecordHotspotsInput`'s `courseId` from optional to required:

```ts
type RecordLessonViewInput = {
  sessionId: string;
  lessonId: string;
  courseId: string;
};

type RecordHotspotsInput = {
  sessionId: string;
  lessonId: string;
  courseId: string;
  visitedHotspots?: string[];
  completed?: boolean;
  recordView?: boolean;
};
```

Add a verification helper and call it at the top of both `recordLessonView` and `recordHotspots`, before the `$transaction`:

```ts
export class LessonCourseMismatchError extends Error {
  constructor() {
    super('LESSON_COURSE_MISMATCH');
    this.name = 'LessonCourseMismatchError';
  }
}

async function verifyLessonBelongsToCourse(
  db: ProgressStoreDb,
  lessonId: string,
  courseId: string,
): Promise<void> {
  const lesson = await db.courseLesson.findUnique({
    where: { id: lessonId },
    select: { chapter: { select: { courseId: true } } },
  });
  if (!lesson || lesson.chapter.courseId !== courseId) throw new LessonCourseMismatchError();
}
```

Add `courseLesson: { findUnique(args: { where: { id: string }; select: { chapter: { select: { courseId: true } } } }): Promise<{ chapter: { courseId: string } } | null> }` to the `ProgressStoreDb` type (matching the existing narrow-typed-Prisma-subset pattern already used for `lessonProgress` and `hotspotVisit` in this file — the Prisma model is `CourseLesson`, so its client accessor is `prisma.courseLesson`, same as used elsewhere in `packages/database/src/course-repository.ts:57,303`), and call `await verifyLessonBelongsToCourse(db, input.lessonId, input.courseId)` as the first line inside `recordLessonView` and `recordHotspots`, before their existing `$transaction` calls.

- [ ] **Step 2: Require `courseId` at the route boundary and map the new error**

In `apps/web/src/app/api/progress/route.ts`, find the `ProgressRequestSchema` import and usage. Confirm (or update, in `apps/web/src/shared/contracts/api.ts`) that `ProgressRequestSchema`'s `courseId` field is required, not optional — if it's currently `.optional()`, make it required, since every lesson-view/hotspot payload variant already needs one. Then map the new error in the route's `POST` handler:

```ts
  try {
    if (body.type === 'lesson') {
      if (body.visitedHotspots !== undefined || body.completed !== undefined) {
        await recordHotspots(body);
      } else {
        await recordLessonView(body);
      }

      return NextResponse.json({ ok: true });
    }
```

Wrap with a catch for the new error class alongside whatever the existing catch block already does (read the rest of the file to place this correctly relative to the existing try/catch structure):

```ts
  } catch (error: unknown) {
    if (error instanceof LessonCourseMismatchError) {
      return jsonError('This lesson does not belong to the specified course', 400);
    }
    return unexpectedApiError('api/progress POST', error);
  }
```

Import `LessonCourseMismatchError` from `@/learning/server/progress-store` and `jsonError` from `@/shared/server/http` (add to the existing import if already partially imported).

- [ ] **Step 3: Verify quiz ownership before grading**

In `apps/web/src/learning/server/quiz-grading.ts`, find `loadQuizAnswerKey`'s course-quiz branch (around line 82-95):

```ts
const record = await prisma.courseQuiz.findUnique({
  where: { id: quizId },
  select: { payload: true },
});
if (!record) return null;
```

becomes:

```ts
const record = await prisma.courseQuiz.findUnique({
  where: { id: quizId },
  select: { payload: true, courseId: true },
});
if (!record) return null;
```

Change the function's return type to include `courseId` (add it to the `AnswerKey` interface above), and include it in both return branches (`source === 'ai'` returns a synthetic/no-owning-course answer key already — leave that branch's shape decision to whatever's simplest given the interface change, e.g. `courseId: null` for the AI-quiz branch since that path has no `CourseQuiz.courseId` to check against, and skip the ownership check in the route for that `source`).

`QuizGradeRequestSchema` (`packages/contracts/src/quiz.ts:54-72`) is a discriminated union on `action`: `GradeQuestionRequestSchema` (`action: 'question'`, single-question preview grading) has no `courseId` field at all; only `SubmitQuizRequestSchema` (`action: 'submit'`) has one, and it's currently `z.string().min(1).max(100).optional()`. Make it required:

```ts
export const SubmitQuizRequestSchema = z.object({
  action: z.literal('submit'),
  ...gradeIdentity,
  answers: z.array(z.number().int().min(0).max(7)).min(1).max(20),
  sessionId: z.string().uuid().optional(),
  courseId: z.string().min(1).max(100),
});
```

In `apps/web/src/app/api/quiz/grade/route.ts`, after `loadQuizAnswerKey` resolves and before grading:

```ts
const key = await loadQuizAnswerKey(body.source, body.quizId);
if (!key) {
  return jsonError('Quiz not found', 404);
}
```

becomes:

```ts
const key = await loadQuizAnswerKey(body.source, body.quizId);
if (!key) {
  return jsonError('Quiz not found', 404);
}
if (body.action === 'submit' && body.source === 'course' && key.courseId !== body.courseId) {
  return jsonError('This quiz does not belong to the specified course', 400);
}
```

**Scope note, not a gap to close silently:** the `question` action (single-question preview grading, used by the author-preview player) has no `courseId` in its schema and is therefore not covered by this check — it's unauthenticated and returns per-question correctness for any `quizId`/`questionIndex` regardless of course today, and continues to after this task. Closing that fully means either adding `courseId` to `GradeQuestionRequestSchema` (a wire-format change touching the author-preview player's call site too) or the signed learner-capability system this plan's spec explicitly excludes as a non-goal (there's no public learner delivery surface yet to justify building one for). Leaving it open here is a deliberate, stated scope boundary, not an oversight.

- [ ] **Step 4: Verify**

```bash
npx prettier --write apps/web/src/learning/server/progress-store.ts apps/web/src/app/api/progress/route.ts apps/web/src/learning/server/quiz-grading.ts apps/web/src/app/api/quiz/grade/route.ts
npm run typecheck
npm run lint
git diff --check
```

With the app running: open author preview for a course and confirm hotspot/lesson-view progress recording and quiz grading still work exactly as before (preview doesn't persist progress, but it exercises the same code paths for grading — confirm no console errors). Directly `curl` `/api/quiz/grade` with a real `quizId` but a `courseId` belonging to a _different_ course and confirm it now returns 400 instead of grading against the wrong course's answer key.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/learning/server/progress-store.ts apps/web/src/app/api/progress/route.ts apps/web/src/learning/server/quiz-grading.ts apps/web/src/app/api/quiz/grade/route.ts packages/contracts/src/quiz.ts apps/web/src/shared/contracts/api.ts
git commit -m "fix: verify course ownership before recording progress or grading quizzes"
```

---

### Task 8: Bound SCORM packaging memory use

**Files:**

- Modify: `packages/scorm-export/src/build-package.ts`
- Modify: `apps/job-worker/src/handlers.ts`

**Interfaces:**

- Produces: `buildScormPackage` throws a new `ExportTooLargeError` before downloading any asset if the total referenced-asset size exceeds a ceiling; its return shape (`{ buffer, byteSize, sha256 }`) is unchanged.

- [ ] **Step 1: Add a total-size guard before downloading assets**

In `packages/scorm-export/src/build-package.ts`, add near the top of the file, alongside the existing `AssetNotFoundError`:

```ts
const MAX_EXPORT_ASSET_BYTES = 500 * 1024 * 1024; // 500 MB, matches this app's course-media scale today

export class ExportTooLargeError extends Error {
  constructor(public readonly totalBytes: number) {
    super(
      `Course media totals ${totalBytes} bytes, exceeding the ${MAX_EXPORT_ASSET_BYTES}-byte export limit`,
    );
    this.name = 'ExportTooLargeError';
  }
}
```

In `buildScormPackage`, before the `for (const assetUrl of assetUrls)` download loop, add a size pre-check pass using each object's metadata (not its body) via a lightweight head-style call — check whether `@moto-ai/storage`'s `getObject` result exposes `ContentLength` without requiring the body to be read (it does, per `LocalStorageObject.ContentLength` in `packages/storage/src/local-client.ts`); since there's no separate head-only call, do the size accounting inline as part of the existing download loop instead of a separate pass, failing fast the moment the running total crosses the ceiling rather than after downloading everything:

```ts
const assetUrls = collectAssetRefs(input.content);
const urlMap = new Map<string, string>();
const assetFiles: Record<string, Buffer> = {};
let totalAssetBytes = 0;

for (const assetUrl of assetUrls) {
  const r2Key = r2KeyFor(assetUrl);
  if (!r2Key) continue;
  const relativePath = `assets/${r2Key.split('/').slice(1).join('/')}`;
  urlMap.set(assetUrl, relativePath);
  let object: Awaited<ReturnType<typeof getObject>>;
  try {
    object = await getObject(r2Key);
  } catch (error) {
    if (isNotFoundError(error)) throw new AssetNotFoundError(r2Key);
    throw error;
  }
  if (!object.Body) throw new AssetNotFoundError(r2Key);
  totalAssetBytes += object.ContentLength ?? 0;
  if (totalAssetBytes > MAX_EXPORT_ASSET_BYTES) throw new ExportTooLargeError(totalAssetBytes);
  assetFiles[relativePath] = await streamToBuffer(object.Body);
}
```

This fails as soon as the running total crosses the ceiling rather than continuing to download the rest of a huge course's media first — not a full pre-flight check, but it bounds the worst case to one ceiling's worth of already-downloaded bytes plus whatever single asset pushed it over, not the entire course.

- [ ] **Step 2: Stream the archive output to a temp file instead of buffering it**

In the same file, find the `archiver` promise (around line 92-108):

```ts
  return new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks: Buffer[] = [];
    archive.on('data', (chunk) => chunks.push(chunk));
    archive.on('warning', (warning) => {
      if (warning.code !== 'ENOENT') reject(warning);
    });
    archive.on('error', reject);
    archive.on('end', () => {
      const buffer = Buffer.concat(chunks);
      resolve({
        buffer,
        byteSize: buffer.byteLength,
        sha256: createHash('sha256').update(buffer).digest('hex'),
      });
    });
```

Replace with a temp-file-backed write stream, importing `createWriteStream`, `mkdtemp`, `readFile`, `rm` from `node:fs`/`node:fs/promises`, `tmpdir` from `node:os`, and `path` (already imported):

```ts
const tempDir = await mkdtemp(path.join(tmpdir(), 'scorm-export-'));
const tempZipPath = path.join(tempDir, 'package.zip');

try {
  await new Promise<void>((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const output = createWriteStream(tempZipPath);
    archive.pipe(output);
    archive.on('warning', (warning) => {
      if (warning.code !== 'ENOENT') reject(warning);
    });
    archive.on('error', reject);
    output.on('error', reject);
    output.on('close', resolve);

    archive.append(manifest, { name: 'imsmanifest.xml' });
    for (const filename of XSD_FILES) {
      archive.file(path.join(STATIC_DIR, filename), { name: filename });
    }
    for (const [relativePath, buffer] of Object.entries(input.playerBundle)) {
      archive.append(buffer, { name: relativePath });
    }
    for (const [relativePath, buffer] of Object.entries(assetFiles)) {
      archive.append(buffer, { name: relativePath });
    }
    archive.append(
      `<?xml version="1.0" encoding="utf-8"?><meta><project title="${input.title.replace(/[<>&"']/g, '')}" datepublished="${new Date().toISOString()}" /></meta>`,
      { name: 'meta.xml' },
    );
    archive.append(
      `<!doctype html>\n<html><head><meta charset="utf-8" /><title>${input.title.replace(/[<>&]/g, '')}</title><meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'"><link rel="stylesheet" href="player.css" /></head><body><div id="app"></div><script id="course-data" type="application/json">${coursePayload.replace(/</g, '\\u003c')}</script><script src="player.js"></script></body></html>\n`,
      { name: entryHref },
    );

    void archive.finalize();
  });

  const buffer = await readFile(tempZipPath);
  return {
    buffer,
    byteSize: buffer.byteLength,
    sha256: createHash('sha256').update(buffer).digest('hex'),
  };
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
```

This removes the `chunks: Buffer[]` accumulation and its `Buffer.concat` doubling at the moment of finalization — the archive is written straight to disk as it's built. The function still reads the finished ZIP back into one `Buffer` at the end, because its return contract (and `putObject`'s existing `bytes: Uint8Array` parameter in `apps/job-worker/src/handlers.ts`) is buffer-based; eliminating that final read would require changing `putObject`'s signature everywhere it's called, which is out of scope here. Per-asset streaming (never fully buffering `assetFiles` either) is the same kind of larger, cross-cutting change and is explicitly not attempted in this task.

- [ ] **Step 3: Map the new error to a clear job failure**

In `apps/job-worker/src/handlers.ts`, find the `scormExport` catch block that already handles `AssetNotFoundError` (around line 261-267):

```ts
  } catch (error: unknown) {
    if (error instanceof AssetNotFoundError) {
      throw new NonRetryableJobError(
        "One of this course's images or videos is missing from storage. Re-upload it, freeze a new revision, and export again.",
      );
    }
    throw error;
  }
```

becomes:

```ts
  } catch (error: unknown) {
    if (error instanceof AssetNotFoundError) {
      throw new NonRetryableJobError(
        "One of this course's images or videos is missing from storage. Re-upload it, freeze a new revision, and export again.",
      );
    }
    if (error instanceof ExportTooLargeError) {
      throw new NonRetryableJobError(
        'This course has too much media to export as a single SCORM package right now. Contact an administrator.',
      );
    }
    throw error;
  }
```

Import `ExportTooLargeError` alongside the existing `AssetNotFoundError` import from `@moto-ai/scorm-export`.

- [ ] **Step 4: Verify**

```bash
npx prettier --write packages/scorm-export/src/build-package.ts apps/job-worker/src/handlers.ts
npm run typecheck
npm run lint
npm run build --workspace=@moto-ai/scorm-export
git diff --check
```

With the worker running: export a real course's SCORM package end to end and confirm the downloaded ZIP is byte-identical in structure to before this change (same manifest, same files) — open it and spot-check. Confirm no leftover temp directories remain in `os.tmpdir()` after a successful export (the `finally` block should always clean up).

- [ ] **Step 5: Commit**

```bash
git add packages/scorm-export/src/build-package.ts apps/job-worker/src/handlers.ts
git commit -m "fix: bound SCORM export size and stream archive output to disk"
```

---

### Task 9: Sign session cookies with expiry and rate-limit both logins

**Files:**

- Create: `apps/web/src/server/auth/session-token.ts`
- Create: `apps/web/src/server/auth/rate-limit.ts`
- Modify: `apps/web/src/server/auth/course-studio.ts`
- Modify: `apps/web/src/analytics/server/analytics-auth.ts`
- Modify: `apps/web/src/app/api/course-studio/login/route.ts`
- Modify: `apps/web/src/app/api/analytics/login/route.ts`
- Modify: `apps/web/src/app/studio/actions.ts`
- Modify: `apps/web/src/app/studio/page.tsx`
- Modify: `apps/web/src/app/studio/[courseId]/page.tsx`
- Modify: `apps/web/src/proxy.ts`
- Modify: `.env.local.example`

**Interfaces:**

- Produces: `createSignedSessionToken(purpose, secret, ttlMs?)`, `verifySignedSessionToken(token, purpose, secret)`; `isCourseStudioSessionValid(): Promise<boolean>` (page-friendly, cookie-store-based, alongside the existing request-based `isCourseStudioAuthorized`); `checkRateLimit(key, limit, windowMs): boolean`.
- Consumes: new `AUTH_SESSION_SECRET` environment variable.

- [ ] **Step 1: Add the signed session-token primitive**

Create `apps/web/src/server/auth/session-token.ts`:

```ts
import { createHmac, timingSafeEqual } from 'node:crypto';

const DEFAULT_TTL_MS = 8 * 60 * 60 * 1000;

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export function createSignedSessionToken(
  purpose: string,
  secret: string,
  ttlMs: number = DEFAULT_TTL_MS,
): string {
  const expiresAt = Date.now() + ttlMs;
  const payload = `${purpose}.${expiresAt}`;
  return `${payload}.${sign(payload, secret)}`;
}

export function verifySignedSessionToken(
  token: string | undefined,
  purpose: string,
  secret: string,
): boolean {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [tokenPurpose, expiresAtRaw, signature] = parts;
  if (tokenPurpose !== purpose) return false;
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;
  const expected = sign(`${tokenPurpose}.${expiresAtRaw}`, secret);
  const expectedBytes = Buffer.from(expected, 'hex');
  let actualBytes: Buffer;
  try {
    actualBytes = Buffer.from(signature, 'hex');
  } catch {
    return false;
  }
  if (expectedBytes.length !== actualBytes.length) return false;
  return timingSafeEqual(expectedBytes, actualBytes);
}
```

- [ ] **Step 2: Add the in-memory rate limiter**

Create `apps/web/src/server/auth/rate-limit.ts`:

```ts
// Single-process, in-memory fixed-window limiter. Right-sized for this app's current
// single-instance local/dev deployment; swap for a distributed limiter (e.g. Upstash)
// if this ever runs as more than one process.
const windows = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const existing = windows.get(key);
  if (!existing || now >= existing.resetAt) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (existing.count >= limit) return false;
  existing.count += 1;
  return true;
}
```

- [ ] **Step 3: Rewrite Course Studio auth to use signed tokens**

In `apps/web/src/server/auth/course-studio.ts`:

```ts
import type { NextRequest } from 'next/server';

export const COURSE_STUDIO_COOKIE = 'course_studio_token';

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function courseStudioToken(): Promise<string | null> {
  const password = process.env.COURSE_STUDIO_PASSWORD;
  return password ? sha256(password) : null;
}

export async function isCourseStudioAuthorized(request: NextRequest): Promise<boolean> {
  const expected = await courseStudioToken();
  return !!expected && request.cookies.get(COURSE_STUDIO_COOKIE)?.value === expected;
}
```

becomes:

```ts
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { createSignedSessionToken, verifySignedSessionToken } from './session-token';

export const COURSE_STUDIO_COOKIE = 'course_studio_token';
const PURPOSE = 'course-studio';

export function verifyCourseStudioPassword(password: string): boolean {
  const expected = process.env.COURSE_STUDIO_PASSWORD;
  return !!expected && password === expected;
}

export function issueCourseStudioSessionToken(): string | null {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret || !process.env.COURSE_STUDIO_PASSWORD) return null;
  return createSignedSessionToken(PURPOSE, secret);
}

function verifyToken(token: string | undefined): boolean {
  const secret = process.env.AUTH_SESSION_SECRET;
  return !!secret && verifySignedSessionToken(token, PURPOSE, secret);
}

export async function isCourseStudioAuthorized(request: NextRequest): Promise<boolean> {
  return verifyToken(request.cookies.get(COURSE_STUDIO_COOKIE)?.value);
}

export async function isCourseStudioSessionValid(): Promise<boolean> {
  const store = await cookies();
  return verifyToken(store.get(COURSE_STUDIO_COOKIE)?.value);
}
```

- [ ] **Step 4: Update the Course Studio login route**

In `apps/web/src/app/api/course-studio/login/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { COURSE_STUDIO_COOKIE, courseStudioToken } from '@/server/auth/course-studio';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const formData = await request.formData();
  const submitted = formData.get('password');
  const expectedPassword = process.env.COURSE_STUDIO_PASSWORD;

  if (!expectedPassword || typeof submitted !== 'string' || submitted !== expectedPassword) {
    return NextResponse.redirect(new URL('/studio/login?error=1', request.url), { status: 303 });
  }

  const token = await courseStudioToken();
  if (!token) {
    return NextResponse.redirect(new URL('/studio/login?error=1', request.url), { status: 303 });
  }

  const response = NextResponse.redirect(new URL('/studio', request.url), { status: 303 });
  response.cookies.set(COURSE_STUDIO_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8,
  });
  return response;
}
```

becomes:

```ts
import { NextRequest, NextResponse } from 'next/server';
import {
  COURSE_STUDIO_COOKIE,
  issueCourseStudioSessionToken,
  verifyCourseStudioPassword,
} from '@/server/auth/course-studio';
import { checkRateLimit } from '@/server/auth/rate-limit';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const clientIp = request.headers.get('x-forwarded-for') ?? 'unknown';
  if (!checkRateLimit(`course-studio-login:${clientIp}`, 10, 60_000)) {
    return NextResponse.redirect(new URL('/studio/login?error=1', request.url), { status: 303 });
  }

  const formData = await request.formData();
  const submitted = formData.get('password');

  if (typeof submitted !== 'string' || !verifyCourseStudioPassword(submitted)) {
    return NextResponse.redirect(new URL('/studio/login?error=1', request.url), { status: 303 });
  }

  const token = issueCourseStudioSessionToken();
  if (!token) {
    return NextResponse.redirect(new URL('/studio/login?error=1', request.url), { status: 303 });
  }

  const response = NextResponse.redirect(new URL('/studio', request.url), { status: 303 });
  response.cookies.set(COURSE_STUDIO_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8,
  });
  return response;
}
```

- [ ] **Step 5: Apply the same pattern to analytics**

In `apps/web/src/analytics/server/analytics-auth.ts`, replace the whole file:

```ts
import { createSignedSessionToken, verifySignedSessionToken } from '@/server/auth/session-token';
import type { NextRequest } from 'next/server';

const PURPOSE = 'analytics';

export function isAnalyticsPasswordValid(submitted: FormDataEntryValue | null): boolean {
  const expected = process.env.ANALYTICS_PASSWORD;
  return !!expected && typeof submitted === 'string' && submitted === expected;
}

export function issueAnalyticsSessionToken(): string | null {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret || !process.env.ANALYTICS_PASSWORD) return null;
  return createSignedSessionToken(PURPOSE, secret);
}

function verifyToken(token: string | undefined): boolean {
  const secret = process.env.AUTH_SESSION_SECRET;
  return !!secret && verifySignedSessionToken(token, PURPOSE, secret);
}

export function isAnalyticsAuthorized(request: NextRequest): boolean {
  return verifyToken(request.cookies.get('analytics_token')?.value);
}

export async function isAnalyticsSessionValid(): Promise<boolean> {
  const { cookies } = await import('next/headers');
  const store = await cookies();
  return verifyToken(store.get('analytics_token')?.value);
}
```

`apps/web/src/proxy.ts` currently has no `runtime` export, which defaults it to the Edge runtime — `node:crypto`'s `createHmac`/`timingSafeEqual` aren't available there. This project's Next.js version (16.2.12, confirmed via this repo's own build output) supports opting middleware into the Node.js runtime. Update the whole file:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { verifySignedSessionToken } from '@/server/auth/session-token';

export const runtime = 'nodejs';

export function proxy(req: NextRequest): NextResponse {
  const secret = process.env.AUTH_SESSION_SECRET;
  const token = req.cookies.get('analytics_token')?.value;
  if (!secret || !verifySignedSessionToken(token, 'analytics', secret)) {
    const loginUrl = new URL('/analytics/login', req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/analytics', '/analytics/((?!login).*)'],
};
```

In `apps/web/src/app/api/analytics/login/route.ts`:

```ts
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { analyticsCookieValue, isAnalyticsPasswordValid } from '@/analytics/server/analytics-auth';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const formData = await req.formData();
  const submitted = formData.get('password');
  if (!isAnalyticsPasswordValid(submitted)) {
    const loginUrl = new URL('/analytics/login?error=1', req.url);
    return NextResponse.redirect(loginUrl, { status: 303 });
  }
  const cookieStore = await cookies();
  cookieStore.set('analytics_token', analyticsCookieValue()!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  return NextResponse.redirect(new URL('/analytics', req.url), { status: 303 });
}
```

becomes:

```ts
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import {
  isAnalyticsPasswordValid,
  issueAnalyticsSessionToken,
} from '@/analytics/server/analytics-auth';
import { checkRateLimit } from '@/server/auth/rate-limit';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const clientIp = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!checkRateLimit(`analytics-login:${clientIp}`, 10, 60_000)) {
    return NextResponse.redirect(new URL('/analytics/login?error=1', req.url), { status: 303 });
  }

  const formData = await req.formData();
  const submitted = formData.get('password');
  if (!isAnalyticsPasswordValid(submitted)) {
    const loginUrl = new URL('/analytics/login?error=1', req.url);
    return NextResponse.redirect(loginUrl, { status: 303 });
  }
  const token = issueAnalyticsSessionToken();
  if (!token) {
    return NextResponse.redirect(new URL('/analytics/login?error=1', req.url), { status: 303 });
  }
  const cookieStore = await cookies();
  cookieStore.set('analytics_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  return NextResponse.redirect(new URL('/analytics', req.url), { status: 303 });
}
```

- [ ] **Step 6: Collapse the three page-level checks to the new helper**

In each of `apps/web/src/app/studio/actions.ts`, `apps/web/src/app/studio/page.tsx`, and `apps/web/src/app/studio/[courseId]/page.tsx`, replace:

```ts
import { cookies } from 'next/headers';
...
import { COURSE_STUDIO_COOKIE, courseStudioToken } from '@/server/auth/course-studio';
...
  const expected = await courseStudioToken();
  const token = (await cookies()).get(COURSE_STUDIO_COOKIE)?.value;
  if (!expected || token !== expected) redirect('/studio/login');
```

with:

```ts
import { isCourseStudioSessionValid } from '@/server/auth/course-studio';
...
  if (!(await isCourseStudioSessionValid())) redirect('/studio/login');
```

removing the now-unused `cookies` import from each of these three files (confirm each file has no other use of `cookies()` before removing the import — none of the three do, per this task's research).

- [ ] **Step 7: Document the new required environment variable**

In `.env.local.example`, add after `PARSER_SERVICE_TOKEN`:

```env
# 32+ random bytes, e.g. `openssl rand -hex 32`. Signs Course Studio and analytics
# session cookies; rotating it invalidates every existing session.
AUTH_SESSION_SECRET="<random-signing-secret>"
```

- [ ] **Step 8: Verify**

```bash
npx prettier --write apps/web/src/server/auth/session-token.ts apps/web/src/server/auth/rate-limit.ts apps/web/src/server/auth/course-studio.ts apps/web/src/analytics/server/analytics-auth.ts apps/web/src/app/api/course-studio/login/route.ts apps/web/src/app/api/analytics/login/route.ts apps/web/src/app/studio/actions.ts apps/web/src/app/studio/page.tsx "apps/web/src/app/studio/[courseId]/page.tsx" apps/web/src/proxy.ts .env.local.example
npm run typecheck
npm run lint
npm run build
git diff --check
```

Add a real `AUTH_SESSION_SECRET` (e.g. via `openssl rand -hex 32`) to the actual local `.env.local` before testing. With the app running: log into `/studio/login` and `/analytics/login` and confirm both still work end to end, confirm the set cookie values are no longer a bare password hash/plaintext (inspect via browser devtools — the value should now be a `purpose.expiresAt.signature` triple), confirm a request 20+ times in a minute against either login route starts returning the rate-limited redirect, and confirm a manually-forged cookie value (e.g. `course-studio.9999999999999.deadbeef`) is rejected.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/server/auth/session-token.ts apps/web/src/server/auth/rate-limit.ts apps/web/src/server/auth/course-studio.ts apps/web/src/analytics/server/analytics-auth.ts apps/web/src/app/api/course-studio/login/route.ts apps/web/src/app/api/analytics/login/route.ts apps/web/src/app/studio/actions.ts apps/web/src/app/studio/page.tsx "apps/web/src/app/studio/[courseId]/page.tsx" apps/web/src/proxy.ts .env.local.example
git commit -m "fix: sign session cookies with expiry and rate-limit both logins"
```

---

### Task 10: Fail closed on parser source-chunk replacement failure

**Files:**

- Modify: `services/parser-service/src/moto_parser/retrieval.py`
- Create: `services/parser-service/tests/test_retrieval.py`

**Interfaces:**

- Produces: `replace_document_chunks(course_id, source_id, sha256, filename, chunks) -> int` — same signature, now propagates a delete failure instead of swallowing it.

- [ ] **Step 1: Write the failing test**

Create `services/parser-service/tests/test_retrieval.py`:

```python
"""Tests for atomic source-chunk replacement in the retrieval module."""

import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

SERVICE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_ROOT / "src"))

from moto_parser import retrieval  # noqa: E402


class ReplaceDocumentChunksTests(unittest.TestCase):
    def test_delete_failure_fails_closed(self) -> None:
        fake_vectorstore = MagicMock()
        fake_vectorstore._collection.delete.side_effect = RuntimeError("chroma unavailable")

        with patch.object(retrieval, "get_vectorstore", return_value=fake_vectorstore):
            with self.assertRaises(RuntimeError):
                retrieval.replace_document_chunks(
                    course_id="course-1",
                    source_id="source-1",
                    sha256="a" * 64,
                    filename="doc.pdf",
                    chunks=["chunk one", "chunk two"],
                )

        fake_vectorstore.add_texts.assert_not_called()

    def test_successful_delete_still_adds_new_chunks(self) -> None:
        fake_vectorstore = MagicMock()

        with patch.object(retrieval, "get_vectorstore", return_value=fake_vectorstore):
            count = retrieval.replace_document_chunks(
                course_id="course-1",
                source_id="source-1",
                sha256="b" * 64,
                filename="doc.pdf",
                chunks=["chunk one", "chunk two"],
            )

        self.assertEqual(count, 2)
        fake_vectorstore.add_texts.assert_called_once()


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run the test to confirm it fails as expected**

```bash
cd services/parser-service
source venv/bin/activate
python -m unittest tests.test_retrieval -v
```

Expected: `test_delete_failure_fails_closed` FAILS — the current implementation catches the `RuntimeError`, logs a warning, and proceeds to call `add_texts` anyway, so `assertRaises(RuntimeError)` never triggers and `add_texts.assert_not_called()` fails because it _was_ called. `test_successful_delete_still_adds_new_chunks` should already PASS (it describes today's non-failure behavior too).

- [ ] **Step 3: Fail closed instead of swallowing the delete error**

In `services/parser-service/src/moto_parser/retrieval.py`, find `replace_document_chunks` (around line 91-121):

```python
def replace_document_chunks(
    course_id: str,
    source_id: str,
    sha256: str,
    filename: str,
    chunks: list[str],
) -> int:
    vectorstore = get_vectorstore(course_id)
    try:
        vectorstore._collection.delete(  # noqa: SLF001
            where={
                "$and": [
                    {"course_id": course_id},
                    {"source_id": source_id},
                ]
            }
        )
    except Exception:
        logger.warning("Could not delete previous chunks for source %s", source_id, exc_info=True)
    vectorstore.add_texts(
```

becomes:

```python
def replace_document_chunks(
    course_id: str,
    source_id: str,
    sha256: str,
    filename: str,
    chunks: list[str],
) -> int:
    vectorstore = get_vectorstore(course_id)
    vectorstore._collection.delete(  # noqa: SLF001
        where={
            "$and": [
                {"course_id": course_id},
                {"source_id": source_id},
            ]
        }
    )
    vectorstore.add_texts(
```

A failed deletion now propagates as a real exception instead of silently proceeding to add new chunks on top of chunks that may not have actually been removed. The caller (the worker's document-indexing job handler) already has retry semantics for this job kind, so a transient Chroma failure here now correctly triggers a retry instead of silently corrupting the source's retrieval state.

- [ ] **Step 4: Run the test to confirm it passes**

```bash
python -m unittest tests.test_retrieval -v
```

Expected: both tests PASS.

- [ ] **Step 5: Run the full parser verification suite**

```bash
python -m unittest discover -s tests -v
ruff check .
ruff format --check .
mypy src
python -m compileall src
```

- [ ] **Step 6: Commit**

```bash
git add services/parser-service/src/moto_parser/retrieval.py services/parser-service/tests/test_retrieval.py
git commit -m "fix: fail closed when parser source-chunk deletion fails"
```

---

### Task 11: Dependency, formatting, and documentation drift cleanup

**Files:**

- Modify: `package.json`, `package-lock.json` (dependency versions)
- Modify: the 8 currently Prettier-drifted files (re-run to get the exact current list — see Step 2)
- Modify: `services/parser-service/pyproject.toml`
- Modify: `services/parser-service/.env.example`
- Create: `.github/workflows/validate.yml`

**Interfaces:** none — this task is entirely mechanical drift cleanup, no runtime behavior changes beyond the dependency version bumps.

- [ ] **Step 1: Controlled dependency update**

```bash
npm audit --omit=dev
```

Confirm the findings still match (`nanoid`, PostCSS via Next.js, `sharp`). Apply the specific version bumps the audit's dry-run identified rather than a blanket `npm audit fix --force` (which can pull in unrelated major-version bumps):

```bash
npm install next@^16.3.2 nanoid@^3.3.18
```

(`postcss` and `sharp` are transitive through `next`; re-run `npm audit --omit=dev` after the `next` bump to confirm whether they're already resolved or need an explicit `npm install postcss@^8.5.23 sharp@^0.35.3` on top.)

- [ ] **Step 2: Fix formatting drift**

```bash
npx prettier --check .
```

Run `npx prettier --write` on exactly the files this command lists as drifted (the list has shifted since the audit — some of the originally-reported files were fixed incidentally by later work, and two new untouched scripts appeared — use whatever the command reports right now, not the audit's stale list).

- [ ] **Step 3: Fix parser version mismatch and document `VECTORSTORE_CACHE_SIZE`**

In `services/parser-service/pyproject.toml`, change `version = "1.1.0"` to `version = "1.2.0"` to match what `services/parser-service/src/moto_parser/main.py`'s FastAPI app already reports.

In `services/parser-service/.env.example`, add:

```env
# In-process LRU cache size for per-course Chroma vectorstore wrappers. Optional; defaults to 50.
VECTORSTORE_CACHE_SIZE=50
```

- [ ] **Step 4: Add a CI workflow running this repo's own documented validation commands**

Create `.github/workflows/validate.yml`:

```yaml
name: Validate

on:
  push:
    branches: [main]
  pull_request:

jobs:
  node:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: moto_ai
          POSTGRES_PASSWORD: moto_ai
          POSTGRES_DB: moto_ai_ci
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    env:
      DATABASE_URL: postgresql://moto_ai:moto_ai@localhost:5432/moto_ai_ci
      DIRECT_URL: postgresql://moto_ai:moto_ai@localhost:5432/moto_ai_ci
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run build
      - run: npm run build --workspace=@moto-ai/scorm-export

  parser:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: services/parser-service
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - run: pip install -e '.[dev]'
      - run: ruff check .
      - run: ruff format --check .
      - run: mypy src
      - run: python -m compileall src
      - run: python -m unittest discover -s tests
```

`package.json`'s `build` script is `"npm run db:migrate && node scripts/run-workspace.mjs @moto-ai/web build"`, so it does need a reachable `DATABASE_URL` in CI — the `postgres` service container above provides one.

- [ ] **Step 5: Verify**

```bash
npm run typecheck
npm run lint
npm run build
npm run build --workspace=@moto-ai/scorm-export
npx prettier --check .
git diff --check
cd services/parser-service && source venv/bin/activate && python -m unittest discover -s tests && ruff check . && ruff format --check . && mypy src
```

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json services/parser-service/pyproject.toml services/parser-service/.env.example .github/workflows/validate.yml
git commit -m "chore: update vulnerable dependencies and add CI validation workflow"
git add -u
git commit -m "chore: fix formatting drift"
```

(Split into two commits so the dependency/CI change and the pure-formatting change are separately revertible.)

---

## Final handoff checklist

- [ ] Every task commit contains only its owned files.
- [ ] `npm run typecheck`, `npm run lint`, and `npm run build` are clean at the end of every task, not just at the end of the whole plan.
- [ ] No new automated JS/TS test files were added (Task 10's Python test is the sole, intentional exception).
- [ ] The 22 existing callers of `isCourseStudioAuthorized` were not touched by Task 9 (only the 3 page-level files that used the old bare-comparison pattern were).
- [ ] `AUTH_SESSION_SECRET` is documented in `.env.local.example` and set in the real local `.env.local` before Task 9's verification.
- [ ] Task 6 and Task 7's ownership checks were verified with a real cross-course/cross-quiz `curl` request, not just read through.
- [ ] SCORM export output is byte-structurally unchanged after Task 8 (same manifest, same files, just built via a temp file instead of an in-memory array).
