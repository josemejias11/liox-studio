# Repository Hardening Remediation Design

**Status:** Approved in conversation on 2026-08-23

## Context

A read-only third-party audit (`moto-ai-code-validation-report-2026-08-22.md`,
audited at commit `59cbfea`) found 7 high-priority and 6 medium-priority
issues plus a list of maintenance drift. This session re-verified every
finding against the current repository at commit `a3e9f36` (32 commits
later, including the full Course Studio Authoring Parity and Templates
plan). Three findings turned out to already be fixed as side effects of
that work; the rest are still present and were re-confirmed with current
file:line evidence. One further finding (`CourseAsset` has no lifecycle
ownership) was found to already have a working, documented manual cleanup
tool (`scripts/cleanup-orphaned-course-assets.ts`) that the original audit
missed or that was added after it — it needs no new task here.

This app is local-development-only right now: no public learner delivery
surface exists (`/course/[slug]` is not implemented), and the only
internet exposure is occasional, short-lived devtunnel sessions for
sharing a review link with a client. That materially changes prioritization
from a typical production-hardening pass: reliability bugs that can
silently corrupt state or crash the worker matter more right now than
internet-facing attack surface that isn't actually reachable today. Nothing
here is skipped because of that — it's why crash/data-integrity fixes are
sequenced ahead of pure-security hardening in the plan, not a reason to
drop the security items.

## Goals

- Fix every still-open finding from the audit that has real, verifiable
  impact against the current codebase, with accurate severity given this
  app's actual (local-only) exposure today.
- Prioritize fixes that can silently corrupt data or crash the background
  worker over pure-security hardening that isn't reachable without public
  exposure — without skipping the security work.
- Keep every fix scoped to what the finding actually requires. Don't build
  a general-purpose auth/session system, a full learner-capability model,
  or a generic file-scanning antivirus layer when a narrower fix closes the
  real gap.
- Preserve this repository's established verification discipline: no new
  automated JS/TS test files (typecheck, lint, build, direct DB inspection,
  and browser acceptance instead — this repo has no configured JS/TS test
  runner and adding one is out of scope here); the Python parser service
  _does_ have an established `python -m unittest discover -s tests`
  convention (documented in this repo's `CLAUDE.md`) and TDD is used for
  its one fix in this plan.

## Non-goals

- No multi-tenant / per-course access control model. Course Studio remains
  single shared-password authorization; fixes to "course-scoping" bugs are
  about preventing accidental cross-course mutation from a client-side ID
  mix-up, not about building authorization boundaries between courses that
  don't otherwise exist in this product.
- No public learner-delivery capability system. `/api/progress` and
  `/api/quiz/grade` get defense-in-depth relationship checks (does this
  `quizId`/`lessonId` actually belong to this `courseId`), not a signed
  learner-session token — that belongs with the `/course/[slug]` work when
  it ships, not bolted onto endpoints with no real caller yet.
- No new `CourseAsset.courseId` migration. The existing
  `scripts/cleanup-orphaned-course-assets.ts` already solves the practical
  orphan-accumulation problem globally (cross-referencing every course,
  trash item, and revision) without needing a `courseId` column, and is
  already documented in `README.md`. Not touched by this plan.
- No production-grade distributed rate limiter (Upstash or similar). This
  is a single-process local dev server; a small in-memory fixed-window
  limiter is the right-sized fix, with the existing `.env.local` comment
  about optional Upstash left as the intended production swap-in.
- No CI pipeline design beyond "run the commands this repo's own
  `CLAUDE.md` already documents as the validation surface" — this plan
  adds one straightforward workflow file, not a CI/CD strategy.
- No refactor of the maintainability hotspots the audit listed
  (`SpecificationsField.tsx`, `queue.ts`, etc.). None of this plan's tasks
  touch those files for an unrelated reason, and unrequested restructuring
  is explicitly against this repo's working conventions.

## Findings addressed, by task

### Task 1 — Job retention FK crash + non-fatal cleanup

`cleanupExpiredJobs()` (`packages/jobs/src/queue.ts:612`) unconditionally
deletes succeeded/failed `BackgroundJob` rows older than the retention
window. `CourseGeneration.job` and `CourseScormExport.job` both have
`onDelete: Restrict` (`packages/database/prisma/schema.prisma:284,305`).
Once a retained generation or export's backing job ages past the retention
window, the delete fails on the FK constraint, and the call site in
`apps/job-worker/src/index.ts:63` is uncaught — it propagates to
`main().catch()` at the bottom of that file, which calls `process.exit(1)`.
One stale retained record silently kills the whole worker process on its
next hourly cleanup tick.

Fix: exclude jobs that are referenced by a `CourseGeneration` or
`CourseScormExport` row from the cleanup query, and make a cleanup failure
non-fatal (log and continue) regardless, as defense in depth.

### Task 2 — SCORM export completion idempotency

`scormExport()` (`apps/job-worker/src/handlers.ts:202-282`) uploads the
ZIP and then calls `prisma.courseScormExport.create()` — a plain create,
not an upsert — before the queue machinery marks the job succeeded. A
crash or lease loss after that create but before `completeJob()` commits
means the retry hits the unique `jobId` constraint on retry and the job
can end up marked failed even though the export actually succeeded and is
sitting in storage. This is the same failure shape Task 9 of the prior
plan already solved for `COURSE_DUPLICATE` (`findCourseCreatedByJob` /
`creationJobId`-based recovery) — this task ports that same idempotent-tail
pattern to SCORM export instead of inventing a new one.

### Task 3 — Authorization on job-status and analytics APIs

`GET /api/jobs/[id]` (`apps/web/src/app/api/jobs/[id]/route.ts`) and
`POST /api/analytics/weak-topics`
(`apps/web/src/app/api/analytics/weak-topics/route.ts`) have no
authorization check at all. `proxy.ts`'s matcher only covers `/analytics`
page routes, not `/api/analytics/*`. `isCourseStudioAuthorized()` already
exists and is the right guard for job-status (every job kind currently in
this system — document indexing, Q&A generation, course generation, SCORM
export, course duplication — is an authoring-side operation); an
equivalent `isAnalyticsAuthorized()` needs to be added for the analytics
API family, matching the existing `isCourseStudioAuthorized()` shape.
Worth flagging: `CourseDuplicationStatusPanel` (shipped in the prior
plan's Task 10) already depends on `/api/jobs/[id]`, so this fix must keep
that authenticated-browser flow working — the panel already runs inside
the authenticated `/studio` surface, so requiring Course Studio auth on
the endpoint it polls doesn't change its behavior for a real author.

### Task 4 — Course asset upload and delivery hardening

`POST /api/course-studio/assets` only rejects source-document extensions
(`.pdf/.pptx/.docx/.xlsx`); everything else — including HTML — is accepted
with the caller-provided MIME type stored as-is. `GET
/api/course-assets/[...key]` serves objects inline with that same stored
content-type and no `Content-Disposition` or extra security headers, from
the same origin the authenticated Course Studio session's cookie is valid
for. An uploaded HTML "image" opened by a logged-in author executes
same-origin script that can hit Course Studio APIs with that author's
cookie.

Fix: allowlist by real image/video/audio extension and re-derive the
content-type server-side from a small magic-byte signature check rather
than trusting the browser-supplied one (no new dependency — a short
signature table covers the small set of formats this app actually
accepts); serve delivery responses with `Content-Disposition: inline` only
for the allowlisted types plus `X-Content-Type-Options: nosniff` and a
scoped `Content-Security-Policy: sandbox` header so even a
signature-spoofed upload can't execute script when rendered.

### Task 5 — Freeze-time validation against the canonical player schema

`freezeCourseRevision()` now runs `validateCourseReadiness(graph)` (added
by the prior plan's Task 5) but that validator checks specific known rules
(lesson-type media requirements, assessment structure, template
checklist) — it was never meant to be a full structural parse of the
entire graph. A malformed shape outside those specific rules can still
freeze successfully and only surface later when review or SCORM export
tries to render it. Fix: also run the existing player-content schema
(`toPlayerCourseContent()` / its underlying Zod schema, already used by
`requestScormExport()` and the review path) inside the same freeze
transaction, before creating the revision, and surface a parse failure the
same way readiness issues are surfaced today.

### Task 6 — Course-scoping invariants on nested authoring mutations

`chapters/route.ts` `PATCH`/`DELETE` and `lessons/route.ts` `POST`/`PATCH`
never read the URL's `courseId` at all — `updateAuthoringChapter`,
`deleteAuthoringChapter`, `createAuthoringLesson`, and
`updateAuthoringLesson` all resolve the real owning course themselves from
the entity ID and ignore whatever `courseId` the client's URL claims.
`reorderCourseItem`'s lesson branch (`packages/database/src/course-repository.ts:372-394`)
has the same gap one layer down: it looks up the lesson by its global ID,
finds its real chapter, and reorders among real siblings, never checking
that chapter's course against the `courseId` parameter it was given.
Because this product has no per-course ACL (one shared Course Studio
password authorizes every course), this is not a privilege-escalation bug
— it's a defense-in-depth / client-bug-containment gap: a wrong ID from a
stale client tab or a copy-paste mistake silently mutates the real course
that ID belongs to while the response describes a course the URL never
named, which is exactly the kind of bug that produces a confusing "why did
my edit apply to the wrong course" report with no error anywhere. Fix:
every route that receives a `courseId` route param and an entity ID
verifies the entity actually belongs to that course before mutating, and
returns 404 on a mismatch instead of silently operating on the entity's
real course.

### Task 7 — Learner progress and quiz endpoint relationship checks

`/api/progress` and `/api/quiz/grade` accept client-generated identifiers
with no verification that a `lessonId`/`quizId` actually belongs to the
`courseId` in the request, or that `sessionId` has any prior relationship
to that course. Per the non-goals above, this task does not add a signed
learner-session capability (there is no public delivery surface yet to
protect) — it adds the relationship check that's cheap and correct
regardless: reject a grade/progress request whose `quizId`/`lessonId`
doesn't actually belong to the `courseId` it claims, the same shape of fix
as Task 6.

### Task 8 — SCORM packaging memory bound

`buildScormPackage()` buffers every downloaded asset in memory
(`assetFiles: Record<string, Buffer>`) and the entire ZIP output
(`chunks: Buffer[]` → `Buffer.concat`) before returning. Individual
uploads are capped at 50 MB, but nothing caps the sum across a course's
full asset list. Fix, right-sized for what's actually costly here: add a
total-size guard that fails fast with an actionable message before
downloading anything if the summed `ContentLength` of the course's
referenced assets exceeds a configurable ceiling, and stream the finished
archive to a temp file on disk (via `archiver`'s existing pipe support)
instead of accumulating the whole ZIP in `chunks: Buffer[]`. Per-asset
streaming (never fully buffering `assetFiles` at all) is a larger change
this task explicitly does not attempt — noted as a real follow-up if
course media libraries grow much larger than they are today, not silently
dropped.

### Task 9 — Session cookie hardening and login rate limiting

Course Studio's cookie is `sha256(COURSE_STUDIO_PASSWORD)` with no expiry;
analytics' cookie is the _literal plaintext_ `ANALYTICS_PASSWORD`. Neither
login endpoint has any rate limiting. Fix: sign both cookies with HMAC
using a server-only secret plus an embedded expiry, verified on every
authorized-request check instead of a bare string/hash compare; add a
small in-memory fixed-window limiter to both login POST routes.

### Task 10 — Parser source-replacement atomicity (Python)

`replace_document_chunks()` (`services/parser-service/src/moto_parser/retrieval.py:91-121`)
catches and logs, but does not re-raise, a failure deleting a source's
previous chunks, then proceeds to add the new ones regardless — a failed
delete plus a successful add leaves stale and current chunks coexisting
under the same `source_id`, silently weakening retrieval grounding. Fix:
fail closed (re-raise) when the delete fails, so a caller sees a clear
re-index failure instead of silently degraded grounding. This is the one
task in this plan written test-first, using this service's own established
`python -m unittest` convention.

### Task 11 — Dependency, formatting, and documentation drift

`npm audit --omit=dev` still reports the same 4 high-severity advisories
(`nanoid`, PostCSS via Next.js, `sharp`) the audit found. 8 tracked files
have Prettier drift (partially different file list than the audit's,
since some got reformatted incidentally by the prior plan's work and two
new untouched scripts were added since). The parser service's declared
version (`1.1.0`) doesn't match what its FastAPI app reports (`1.2.0`).
`VECTORSTORE_CACHE_SIZE` is read from the environment but absent from
`services/parser-service/.env.example`. There is no CI workflow running
any of this repository's own documented validation commands. Fix: a
controlled dependency bump (verified with a full typecheck/lint/build
pass, not a blind `npm audit fix --force`), a scoped `prettier --write`,
the two doc corrections, and one GitHub Actions workflow running the
commands `CLAUDE.md` already documents (`npm run lint`, `npm run
typecheck`, `npm run build`, the parser's `ruff check`/`ruff
format --check`/`mypy`/`compileall`).

## Verification and acceptance

Same discipline as the prior plan: no new automated JS/TS test files.
Each task's own section in the plan states its exact verification
(typecheck/lint/build, direct Prisma queries, or authenticated browser
acceptance as appropriate to what changed). Task 10 (parser) is the one
exception and uses this service's own `python -m unittest` convention with
a real failing-then-passing test, per `CLAUDE.md`'s documented Python test
workflow.
