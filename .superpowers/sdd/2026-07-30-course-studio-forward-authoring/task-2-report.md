# Task 2 Report: Frozen-revision source grounding

## Objective

Make `CourseSourceFile` and `CourseRevisionSource` authoritative for source
upload, durable indexing, deletion, chat retrieval, and supplemental AI quiz
retrieval. No parser request may expand from an explicit frozen-revision source
set to the legacy course-wide corpus.

## Baseline

- The legacy Next.js `/api/upload` route authenticated with the analytics cookie,
  enqueued filename-based work, and deleted filename-based vector chunks.
- The worker wrote legacy JSON document metadata back to `Course.sourceFiles`
  instead of updating the new source record.
- Parser uploads, chunk IDs, metadata deletion, chat, and quiz retrieval were
  course/filename scoped.
- Chat and quiz requests did not identify a frozen revision.
- Task 1 had already introduced the pending/indexed/failed source lifecycle,
  immutable revision-source bindings, and `listFrozenRevisionSourceIds`.

## Implemented behavior

### Source upload and inventory

- Added an authenticated Course Studio source collection route:
  `GET/POST /api/course-studio/courses/:courseId/sources`.
- Accepts only the parser-service document extensions: PDF, PPTX, DOCX, and
  XLSX.
- Enforces a non-empty upload, a 255-character filename limit, and the existing
  50 MB cap.
- Normalizes the received filename, buffers the received bytes once, calculates
  lowercase SHA-256, and uploads the same bytes to an unguessable
  `courses/:courseId/sources/:uuid-*` R2 key.
- Persists a pending `CourseSourceFile`, then enqueues `document_index` with
  `{ sourceId, courseId, sha256, filename, contentType }` plus the same bytes as
  the durable job artifact.
- On persistence/enqueue failure, attempts cleanup of both the pending source
  row and R2 object.
- Generic Course Studio assets reject parser document extensions so source
  documents cannot bypass the source lifecycle.

### Authoritative indexing and deletion

- `DocumentIndexPayload` now has the exact source identity and digest contract.
- Job deduplication uses course ID, source ID, and SHA-256 rather than filename.
- The worker loads the exact source record, recomputes the artifact digest,
  checks filename/content type/digest consistency, passes `source_id` and
  `sha256` through the typed parser client, and marks that source indexed with
  the returned chunk count.
- Missing artifacts, identity mismatches, parser validation failures, and
  extraction failures become non-retryable safe source failures. Transient
  parser failures retain the queue retry policy.
- Removed legacy `Course.sourceFiles` JSON mutation.
- Added authenticated
  `DELETE /api/course-studio/courses/:courseId/sources/:sourceId`.
  `removeCourseSource` first rejects any source attached to a frozen revision;
  only the returned removable source proceeds to R2 and vector cleanup.

### Parser and Chroma boundary

- Parser uploads now require `course_id`, `source_id`, `sha256`, and the file.
- Chunk IDs are derived from course ID, source ID, SHA-256, and chunk index.
- Every Chroma chunk stores `source`, `course_id`, `source_id`, and `sha256`.
- Replacement/deletion filters use course ID plus source ID, never filename.
- `retrieve_course_documents(course_id, source_ids, query, k)` returns no
  documents for an empty allowed source set and otherwise sends
  `filter={"source_id": {"$in": source_ids}}` to Chroma.
- Chat and quiz generation both require and propagate `source_ids`; neither has
  a course-wide fallback.
- FastAPI descriptions and the parser-service README now document immutable
  sources, revision-bound retrieval, explicit source IDs, and local
  development-only Ollama.

### Frozen-revision resolution

- Course Studio revision responses now include the explicit source IDs frozen
  into each revision, and freezing reports a user-safe conflict while any
  source is not indexed.
- Chat and quiz accept exactly one `revisionId` or hashed `reviewToken`.
- A review token resolves to its immutable revision with `getReviewByToken`.
- An explicit revision resolves only through
  `listFrozenRevisionSourceIds(courseId, revisionId)`.
- Missing, invalid, expired, stale, or unrelated revision identities receive a
  user-safe 4xx response.
- Durable quiz jobs record the resolved revision ID and source IDs, so later
  worker execution does not re-resolve mutable course state.

### Legacy removal

- Deleted the browser-facing `/api/upload` route and its analytics-cookie
  authorization.
- Removed the obsolete browser upload response schema and stale analytics
  comment. No browser call sites to `/api/upload` remain.
- The parser service keeps its internal `/api/upload` endpoint behind
  `X-Internal-Token`; it is now source-ID/SHA-bound and is never browser-facing.

## Files changed

- `packages/contracts/src/jobs.ts`
- `packages/jobs/src/queue.ts`
- `apps/job-worker/src/handlers.ts`
- `packages/parser-client/src/index.ts`
- `services/parser-service/src/moto_parser/contracts.py`
- `services/parser-service/src/moto_parser/main.py`
- `services/parser-service/src/moto_parser/rag.py`
- `services/parser-service/src/moto_parser/documents.py`
- `services/parser-service/README.md`
- `apps/web/src/app/api/course-studio/assets/route.ts`
- `apps/web/src/app/api/course-studio/courses/[courseId]/sources/route.ts`
- `apps/web/src/app/api/course-studio/courses/[courseId]/sources/[sourceId]/route.ts`
- `apps/web/src/app/api/course-studio/courses/[courseId]/revisions/route.ts`
- `apps/web/src/app/api/chat/route.ts`
- `apps/web/src/app/api/quiz/route.ts`
- Deleted `apps/web/src/app/api/upload/route.ts`
- `apps/web/src/lib/contracts/api.ts`
- `apps/web/src/app/analytics/page.tsx`

## Verification evidence

No automated test files were created and no automated tests were run, per the
repository constraint.

| Command | Observed result |
| --- | --- |
| `npm run typecheck` | Reached all workspaces. Task 2 workspaces compiled; root exited 2 only for downstream Task 5 public-catalog imports missing from `@moto-ai/database`: `getPublishedCourseBySlug`, `listPublishedCourseSummaries`, and the resulting implicit `record` type. |
| `npm run typecheck --workspace=@moto-ai/job-worker --workspace=@moto-ai/contracts --workspace=@moto-ai/jobs --workspace=@moto-ai/parser-client` | Exit 0. |
| `npm run lint` | Exit 0 with one pre-existing/downstream warning in `packages/database/src/course-repository.ts` for unused `CourseGraphChapter`; no Task 2 lint errors. |
| `services/parser-service/venv/bin/ruff check services/parser-service/src` | Exit 0, all checks passed. |
| `services/parser-service/venv/bin/ruff format --check services/parser-service/src` | Exit 0, seven files already formatted. |
| `services/parser-service/venv/bin/mypy services/parser-service/src` | Exit 0, no issues in seven source files. |
| `services/parser-service/venv/bin/python -m compileall -q services/parser-service/src` | Exit 0. |
| `./node_modules/.bin/prettier --check <Task 2 TypeScript and README files>` | Exit 0, all matched files use Prettier style. |
| `git diff --check` | Exit 0. |
| `pg_isready -h localhost -p 5432` | `localhost:5432 - no response`. |
| Source scan for parser retrieval calls | The only similarity retrieval call is `retrieve_course_documents`, which stops on an empty source set and applies the Chroma `$in` source-ID filter. |

The stale generated `.next` cache was removed before the second typecheck so it
no longer referenced the intentionally deleted legacy upload route.

## Evaluation, latency, and cost

- Static contract evaluation covered the browser-to-Next-to-typed-client-to-
  FastAPI boundary and found no unfiltered parser retrieval call.
- No online quality, retrieval relevance, latency, or cost measurements were
  collected because PostgreSQL was unavailable and the authenticated durable
  flow could not start.
- No LLM call was made. This task adds no provider cost. Local Ollama remains
  behind parser-service and is described as development-only.
- Source upload intentionally stores bytes in both R2 and the job artifact until
  terminal processing. This is the durability tradeoff; job retention cleanup
  remains responsible for terminal artifacts.

## Self-review

- Confirmed the upload job artifact is created from the same `Buffer` used for
  SHA-256 and R2 upload.
- Confirmed the worker trusts neither queued metadata nor artifact bytes without
  matching them to the persisted source record.
- Confirmed no filename-only Chroma chunk ID, delete filter, or retrieval path
  remains.
- Confirmed empty `source_ids` yields no chat context and cannot generate a
  quiz.
- Confirmed revision IDs are course-related through the database lookup and
  review tokens are hashed/resolved through the existing review repository.
- Confirmed frozen source deletion returns 409 before external data is removed.
- Confirmed unrelated dirty workspace changes are not included in Task 2 scope.

## Unresolved risks and monitoring

- PostgreSQL unavailability blocked migration-backed upload, queued-to-indexed
  status, frozen revision row/hash inspection, authenticated browser evidence,
  and a real review-context retrieval. None of those runtime outcomes are
  claimed.
- The full root typecheck remains red until downstream Task 5 publishes its
  public-catalog database exports. Task 2-owned workspaces are green.
- If R2 or parser cleanup fails after `removeCourseSource` has atomically
  confirmed/removes an unfrozen record, the route returns 502 and logs the
  external cleanup failure, but an orphaned object/chunk may require operational
  cleanup. This ordering prevents any frozen revision source from being removed.
- Monitor `CourseSourceFile.indexStatus/indexError/chunksStored`,
  `BackgroundJob.status/attempts/errorMessage`, parser 4xx/5xx responses, source
  identity mismatch logs, and source cleanup failures.
- Once PostgreSQL and authenticated local services are available, the remaining
  acceptance run is: upload one source, observe queued to indexed, freeze a
  revision, inspect its source IDs/hashes, then make a review-token chat request
  and verify the reported source set contains only that frozen source.

## Review round 1 fixes

The first independent review found three integration/security gaps in commit
`4677bd1`. They were corrected without adding a course-wide or public learner
fallback:

- `ChatRequestSchema` and `RevisionBoundQuizRequestSchema` are now strict unions
  that accept exactly one identity: `revisionId` or `reviewToken`. Supplying
  both, neither, or unknown fields fails before the browser makes a request.
- `chat-client.ts` serializes only the successfully validated shared request.
  A legacy caller that has only a course ID is stopped client-side instead of
  sending an under-scoped request.
- `CourseQuiz.tsx` accepts Studio revision or review-token identity, validates
  the same strict shared contract, and serializes the validated payload. Its
  existing course-only contexts cannot enqueue AI generation.
- Chat and quiz route handlers require a valid Course Studio session before
  resolving any raw `revisionId`. The alternative `reviewToken` path continues
  to resolve only through `getReviewByToken`, which hashes the token and rejects
  missing/expired reviews.
- Retryable parser/network errors keep their intermediate queue retries. When
  `job.attempts >= job.maxAttempts`, the worker now marks that exact
  `CourseSourceFile` failed with a safe retry message before the queue records
  its terminal failure.

Focused static evidence after the fixes:

| Command | Observed result |
| --- | --- |
| `npm run typecheck --workspace=@moto-ai/web --workspace=@moto-ai/job-worker` | Job worker passed. Web reported only the same downstream Task 5 public-catalog exports/type error; no Task 2 diagnostic remained. |
| `npm run lint` | Exit 0 with the same unrelated unused `CourseGraphChapter` warning and no Task 2 error. |
| `./node_modules/.bin/prettier --check <review-fix files>` | All review-fix files matched Prettier style after formatting the affected route/client files. |
| Source scan of `/api/chat` and `/api/quiz` callers | Network bodies are built only from strict validated requests; the old course-only JSON payloads are absent. |
| Source scan of chat/quiz route authorization | Both routes check `isCourseStudioAuthorized` on the `revisionId` branch before database source resolution; review-token branches still use `getReviewByToken`. |
| Source scan of terminal indexing behavior | `markSourceFailed` runs for non-retryable errors and for retryable errors on the claimed job's final attempt; intermediate retryable attempts remain pending. |

## Browser revision-identity propagation

The second review prerequisite was to carry the already-enforced revision
identity from its trusted browser origin through every Course AI request
component:

- Added a shared exclusive `RevisionIdentity` browser type. Chat surfaces now
  require either a Studio `revisionId` or a review `reviewToken`; neither
  `CourseChat` nor `CourseAIFab` accepts a course-only invocation.
- The authenticated Studio page resolves the newest existing frozen revision
  (revision lists are version-descending) and supplies its ID to both authoring
  preview layouts. If the course has no frozen revision, no identity is
  invented and the assistant remains unavailable.
- The external review player supplies its existing URL review token. That token
  remains the only browser credential sent by the review path and is resolved
  server-side to its immutable revision.
- `AuthoringPreview`, `MotoViewer`, `CoursePhaseScreen`, `LessonRenderer`, and
  `QuizLesson` preserve the exclusive identity through assistant and
  supplemental-quiz call sites.
- `PlayerOverlays` renders the assistant only when an explicit revision
  identity exists. The public course-only player receives no identity, does not
  render the assistant, and does not fall back to mutable course-wide
  retrieval.
- `useChatConversation` rejects missing or ambiguous identity before invoking
  `askCourseChat`; its network payload contains exactly the propagated
  revision ID or review token.

Additional files changed for this propagation:

- `apps/web/src/app/studio/[courseId]/page.tsx`
- `apps/web/src/components/CourseAIFab.tsx`
- `apps/web/src/components/course-ai/CourseChat.tsx`
- `apps/web/src/components/course-ai/useChatConversation.ts`
- `apps/web/src/course-studio/AuthoringPreview.tsx`
- `apps/web/src/course-studio/CourseStudioWorkspace.tsx`
- `apps/web/src/player/CoursePhaseScreen.tsx`
- `apps/web/src/player/LessonRenderer.tsx`
- `apps/web/src/player/MotoViewer.tsx`
- `apps/web/src/player/PlayerOverlays.tsx`
- `apps/web/src/player/lesson-types/QuizLesson.tsx`
- `apps/web/src/review/ReviewPlayer.tsx`

Focused verification after browser propagation:

| Command | Observed result |
| --- | --- |
| `npm run lint` | Exit 0 with only the same unrelated unused `CourseGraphChapter` warning; no Task 2 lint error. |
| `npm run typecheck --workspace=@moto-ai/web` | Exit 2 only for the same downstream Task 5 missing public-catalog exports and resulting implicit `record` type; no browser propagation diagnostic. |
| `npx prettier --check <browser propagation files>` | Exit 0; all matched files use Prettier style. |
| `git diff --check` | Exit 0. |
| Browser call-site scan | Studio authoring preview originates a revision ID, external review originates its review token, and the public course page supplies neither. Assistant rendering requires the propagated identity. |

Runtime browser proof remains blocked by the same unavailable local PostgreSQL
prerequisite. No authenticated preview or review request is claimed as executed.
