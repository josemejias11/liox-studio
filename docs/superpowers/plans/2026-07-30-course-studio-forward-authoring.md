# Course Studio Forward Authoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Course Studio the app-owned Lionbridge master-authoring library, restore the essential authoring controls lost with Sanity, add revision-grounded AI course generation, and retire Sanity without building client delivery or an Insiders adapter.

**Architecture:** PostgreSQL owns durable course graphs, source-file metadata, immutable master review snapshots, generation records, and provenance; R2 owns bytes. The browser calls authenticated Next.js Course Studio APIs, which use the typed parser client; background jobs invoke the parser-service. Chroma retrieval is constrained by the exact source-file IDs frozen into a revision. Course visibility is not modeled: Studio is the authoring library, and the in-app player is preview/review only.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma/PostgreSQL, Cloudflare R2, Zod, durable PostgreSQL jobs, FastAPI parser-service, Chroma, local-development Ollama.

## Global Constraints

- Do not add, run, or create automated test files; use typecheck, lint, build/migration checks, targeted API inspection, and authenticated browser evidence.
- Preserve lesson IDs, lesson types, progress keys, native player controls, and unknown lesson-payload metadata.
- `canvas` remains a lesson type; do not restore `courseMode`.
- Course Studio is an authoring library, not a learner catalog. Do not implement course publishing, client delivery, Insiders formats, or an Insiders integration.
- A frozen revision is an immutable master review/delivery candidate, never a course visibility gate.
- AI-generated content is editable authoring material. It never silently overwrites content, publishes/delivers anything, or becomes authoritative without author action.
- Retrieval and generation use only source records explicitly captured by the relevant frozen revision. Keep Ollama behind parser-service and development-only.
- Do not migrate, export, archive, or provide a read-only fallback for Sanity content.
- Preserve unrelated dirty worktree changes.

---

## File map

| Area | Files | Responsibility |
| --- | --- | --- |
| Data model | `packages/database/prisma/schema.prisma`, new migration, `packages/database/src/course-repository.ts`, `course-review-repository.ts`, new `course-source-repository.ts`, new `course-generation-repository.ts` | Remove course publication state; own source records, revision bindings, immutable provenance, and generated-course persistence. |
| Shared contracts | `packages/contracts/src/course-studio.ts`, `packages/contracts/src/jobs.ts`, new `packages/contracts/src/course-generation.ts` | Define stable Studio source, revision, and generation input/result shapes. |
| Jobs and worker | `packages/jobs/src/queue.ts`, `apps/job-worker/src/handlers.ts` | Add indexed-source and course-generation job kinds with idempotent payloads. |
| Parser boundary | `packages/parser-client/src/index.ts`, `services/parser-service/src/moto_parser/contracts.py`, `main.py`, `rag.py`, new `generation.py` | Require source IDs for retrieval and generate a validated course graph. |
| Studio APIs | new source/generation routes under `apps/web/src/app/api/course-studio/`, revisions route, `studio-client.ts` | Enforce Studio auth and mediate all source/generation operations. |
| Studio UI | `CourseStudioWorkspace.tsx`, `CourseLibrary.tsx`, `RevisionPanel.tsx`, `LessonInspector.tsx`, new inspector/editor components | Show master-source state, spatial controls, rich text, assets, and generation status. |
| Retired surfaces | `apps/web/src/app/page.tsx`, `apps/web/src/app/course/[slug]/page.tsx`, old upload route, remaining Sanity references | Remove public-catalog semantics and every residual Sanity/legacy-corpus path. |

## Task 1: Make the database model authoring-library and revision-source aware

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/20260730120000_forward_course_studio/migration.sql`
- Modify: `packages/database/src/course-repository.ts`
- Modify: `packages/database/src/course-review-repository.ts`
- Create: `packages/database/src/course-source-repository.ts`
- Create: `packages/database/src/course-generation-repository.ts`
- Modify: `packages/database/src/index.ts`
- Modify: `packages/contracts/src/course-studio.ts`

**Interfaces:**
- Produces `CourseSourceFile`, `CourseRevisionSource`, and `CourseGeneration` persistence with `sourceId`, SHA-256, index state, R2 key, and generation provenance.
- Produces `freezeCourseRevision(courseId, notes): CourseRevisionSummary`, which snapshots the graph and its currently attached, successfully indexed sources atomically.
- Removes `CoursePublicationStatus`, `Course.status`, and publication-filter repository exports.

- [ ] **Step 1: Replace course publication state with explicit source records.**

  Remove `CoursePublicationStatus`, `Course.status`, and its index. Replace `Course.sourceFiles Json?` with a `CourseSourceFile` relation containing `id`, `courseId`, `r2Key`, `filename`, `contentType`, `byteSize`, `sha256`, `indexStatus`, `chunksStored`, `indexError`, and timestamps. Add `CourseRevisionSource` as the immutable join from a frozen revision to a source file, copying the frozen content hash and filename.

  ```prisma
  model CourseRevisionSource {
    revisionId String
    sourceFileId String
    sha256 String
    filename String
    revision CourseRevision @relation(fields: [revisionId], references: [id], onDelete: Cascade)
    sourceFile CourseSourceFile @relation(fields: [sourceFileId], references: [id], onDelete: Restrict)
    @@id([revisionId, sourceFileId])
  }
  ```

- [ ] **Step 2: Add a durable generation record without creating a half-course.**

  Add `CourseGeneration` keyed by the queued job, with brief, prompt-template version, requested source IDs/hashes, model identifier, status/result/error, and nullable `createdCourseId`. It represents work in progress; it is not a `Course` and therefore cannot appear in the authoring library until the generated graph validates.

- [ ] **Step 3: Write a non-destructive migration.**

  Drop only the course publication column/index/type and obsolete JSON source-file column after creating normalized source tables. Do not delete Course, CourseChapter, CourseLesson, CourseRevision, review, progress, asset, or job data. Generate Prisma client after the migration exists.

- [ ] **Step 4: Replace repository contracts.**

  Keep `listAuthoringCourses()` and `getAuthoringCourse()` as the only course-library reads. Remove `listPublishedCourseSummaries()` and `getPublishedCourseBySlug()`. Add source lifecycle operations (`createPendingSource`, `markSourceIndexed`, `markSourceFailed`, `listCourseSources`, `removeCourseSource`) and an atomic revision-freeze operation that refuses pending/failed selected sources.

- [ ] **Step 5: Validate static and schema contracts.**

  Run `npm run db:generate`, `npm run typecheck`, and inspect the generated migration SQL. If PostgreSQL is available, run `npm run db:migrate`; otherwise report the database blocker and do not claim migration application.

- [ ] **Step 6: Commit the isolated data-model change.**

  ```bash
  git add packages/database packages/contracts
  git commit -m "feat: model Studio sources and master provenance"
  ```

## Task 2: Bind source upload, indexing, and retrieval to frozen revisions

**Files:**
- Modify: `packages/contracts/src/jobs.ts`
- Modify: `packages/jobs/src/queue.ts`
- Modify: `apps/job-worker/src/handlers.ts`
- Modify: `packages/parser-client/src/index.ts`
- Modify: `services/parser-service/src/moto_parser/contracts.py`
- Modify: `services/parser-service/src/moto_parser/main.py`
- Modify: `services/parser-service/src/moto_parser/rag.py`
- Modify: `apps/web/src/app/api/course-studio/assets/route.ts`
- Create: `apps/web/src/app/api/course-studio/courses/[courseId]/sources/route.ts`
- Create: `apps/web/src/app/api/course-studio/courses/[courseId]/sources/[sourceId]/route.ts`
- Modify: `apps/web/src/app/api/course-studio/courses/[courseId]/revisions/route.ts`
- Delete: `apps/web/src/app/api/upload/route.ts`
- Modify: `apps/web/src/app/api/chat/route.ts`
- Modify: `apps/web/src/app/api/quiz/route.ts`

**Interfaces:**
- `DocumentIndexPayload` becomes `{ sourceId, courseId, sha256, filename, contentType }`.
- Parser requests accept `{ course_id, source_ids, query }`; Chroma documents persist `source_id` metadata and retrieval filters to it.
- `POST /api/course-studio/courses/:courseId/sources` returns `{ source, job }` and requires Course Studio authorization.

- [ ] **Step 1: Store source bytes in R2 before enqueueing work.**

  Implement the authenticated source route with the existing 50 MB guard and parser-service document extensions. Upload to an unguessable course/source R2 key, calculate SHA-256 from the received bytes, persist a pending source record, then enqueue a `document_index` job whose artifact is the same bytes. On enqueue failure, delete the R2 object and pending source row.

- [ ] **Step 2: Make the worker source-record authoritative.**

  Change `indexDocument` to parse `sourceId`, load the source record, call the parser client with `source_id`, then mark that exact source indexed with chunk count. On non-retryable extraction/validation errors, mark the source failed with a safe message. Delete R2 and vector chunks only through `removeCourseSource` after confirming the source is not attached to any frozen revision.

- [ ] **Step 3: Constrain Chroma at the metadata boundary.**

  Replace filename-only chunk IDs and delete filters with `{ course_id, source_id, sha256 }` metadata. Update `retrieve_course_documents` to require `source_ids` and use Chroma metadata filtering. Return no context when the allowed source set is empty; never fall back to the legacy course-wide corpus.

  ```python
  def retrieve_course_documents(course_id: str, source_ids: list[str], query: str, k: int) -> list[Document]:
      return vectorstore.similarity_search(query, k=k, filter={"source_id": {"$in": source_ids}})
  ```

- [ ] **Step 4: Resolve allowed sources from a frozen revision in Next.js.**

  Add a database lookup that returns only `CourseRevisionSource` IDs for a requested revision. Chat and AI quiz APIs must receive/resolve a revision ID and pass its source IDs to the parser client. The review route derives the revision from its hashed token; Studio preview may select an existing frozen revision. Reject missing, stale, or unrelated revision IDs with a user-safe 4xx response.

- [ ] **Step 5: Remove the legacy upload surface and corpus behavior.**

  Delete `/api/upload`, its analytics-cookie authorization, legacy document metadata mutation in `apps/job-worker/src/handlers.ts`, and all call sites. Update parser-service README and API descriptions to describe source IDs and revision-bound calls.

- [ ] **Step 6: Verify source-to-revision evidence.**

  Run `npm run typecheck`, `npm run lint`, and parser-service static checks. With authenticated browser and local services available: upload one source, observe queued-to-indexed status, freeze a revision, inspect its source IDs/hashes in PostgreSQL, and make one review-context request that reports only that source. Do not claim browser or persistence evidence if services are unavailable.

- [ ] **Step 7: Commit the source-grounding delivery.**

  ```bash
  git add apps/job-worker apps/web/src/app/api packages/contracts packages/database packages/jobs packages/parser-client services/parser-service
  git commit -m "feat: ground Studio AI in frozen revision sources"
  ```

## Task 3: Restore guided visual, rich-text, and per-item asset authoring

**Files:**
- Create: `apps/web/src/course-studio/inspectors/lesson/HotspotCanvas.tsx`
- Create: `apps/web/src/course-studio/inspectors/lesson/TextOverlayCanvas.tsx`
- Create: `apps/web/src/course-studio/inspectors/lesson/RichTextField.tsx`
- Create: `apps/web/src/course-studio/inspectors/lesson/AssetCollectionField.tsx`
- Modify: `apps/web/src/course-studio/inspectors/LessonInspector.tsx`
- Modify: `apps/web/src/course-studio/inspectors/lesson/HotspotsField.tsx`
- Modify: `apps/web/src/course-studio/inspectors/lesson/VariantsField.tsx`
- Modify: `apps/web/src/course-studio/inspectors/lesson/QuizQuestionsField.tsx`
- Modify: `apps/web/src/course-studio/inspectors/lesson/ScrollChaptersField.tsx`
- Modify: `apps/web/src/lib/contracts/lesson-studio.ts`
- Modify: `apps/web/src/course-studio/inspectors/lesson/lesson-serializer.ts`
- Modify: `apps/web/src/lib/portable-text-components.tsx`

**Interfaces:**
- `RichTextField` consumes `TextDraft` and produces the existing serialized rich-text payload, preserving untouched original blocks.
- `HotspotCanvas` consumes a primary `LessonImageDraft` and `HotspotDraft[]`, and emits exactly the existing numeric `x`/`y` values.
- `AssetCollectionField` receives `{ courseId, accept, value, onChange }` and writes existing nested asset-reference payloads.

- [ ] **Step 1: Make rich-text a constrained, typed Studio control.**

  Replace plain body textareas with a small rich-text editor that supports the currently rendered emphasis/list marks and a `layerLink` learning cue. The cue picker must list only hotspot labels and covered-feature labels from the current lesson; validation rejects a cue whose target no longer exists. Store the same Portable Text-compatible structure consumed by the player, not HTML.

- [ ] **Step 2: Implement accessible visual spatial editors.**

  Add the hotspot canvas over the selected primary media with click-to-add, pointer drag, selected-item focus, Delete removal, arrow-key adjustment, and numeric fallback. Add the text-overlay canvas with drag position and fixed width choices `small`, `medium`, `large`, and `full`. Keep pointer behavior and keyboard focus within the inspector, and retain numeric fields for exact entry/accessibility.

- [ ] **Step 3: Expose media fields already preserved by the serializer.**

  Use `AssetCollectionField` for hotspot photo galleries/video, quiz-question images, colour-variant images, and scroll-story chapter images. Use the existing authenticated R2 asset API, MIME/size checks, upload progress, and displayed upload errors. Do not introduce an asset-library product or a new media payload shape.

- [ ] **Step 4: Tighten draft creation and serialization.**

  Extend `createLessonDraft`, validation, and serializer only for editor-owned fields. Preserve unknown payload keys and original rich-text blocks when not edited. Ensure changing one hotspot, asset, or rich-text segment cannot erase sibling payload data.

- [ ] **Step 5: Verify authoring and preview behavior.**

  Run `npm run typecheck` and `npm run lint`. With Studio running and authenticated, use the browser to place and keyboard-adjust a hotspot, move an overlay, add/remove each restored media type, save rich text with a valid learning cue, reload, and confirm the embedded author preview renders the saved graph. Record any unavailable runtime dependency as a limitation.

- [ ] **Step 6: Commit the editor-parity delivery.**

  ```bash
  git add apps/web/src/course-studio apps/web/src/lib
  git commit -m "feat: restore guided Studio authoring controls"
  ```

## Task 4: Generate a complete editable course through the typed AI boundary

**Files:**
- Create: `packages/contracts/src/course-generation.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/contracts/src/jobs.ts`
- Modify: `packages/jobs/src/queue.ts`
- Modify: `apps/job-worker/src/handlers.ts`
- Modify: `packages/parser-client/src/index.ts`
- Create: `services/parser-service/src/moto_parser/generation.py`
- Modify: `services/parser-service/src/moto_parser/contracts.py`
- Modify: `services/parser-service/src/moto_parser/main.py`
- Create: `apps/web/src/app/api/course-studio/generations/route.ts`
- Create: `apps/web/src/app/api/course-studio/generations/[generationId]/route.ts`
- Create: `apps/web/src/course-studio/CreateWithAiDialog.tsx`
- Create: `apps/web/src/course-studio/GenerationStatusPanel.tsx`
- Modify: `apps/web/src/course-studio/CourseLibrary.tsx`
- Modify: `apps/web/src/app/studio/page.tsx`

**Interfaces:**
- `CourseGenerationRequest = { brief: string; sourceRevisionId: string }`.
- `GeneratedCourseGraph` is a Zod-validated subset of `CourseGraph` with no database IDs; the database assigns stable IDs when persisting.
- `enqueueCourseGenerationJob({ generationId }): JobAcceptedResponse` is idempotent per generation.

- [ ] **Step 1: Define the generated-graph contract before calling a model.**

  Create a strict Zod contract for title, objectives, chapters, supported lesson types, lesson copy, interaction drafts, asset placeholders, and quiz suggestions. Enforce the existing ten lesson types, non-empty titles/headlines, bounded chapter/lesson counts, and no client-supplied IDs. Add a parser response contract for the same shape.

- [ ] **Step 2: Create an author-controlled generation request.**

  In the authoring library, require an author brief and a frozen revision to act as the approved source set. Persist a `CourseGeneration` request and enqueue its durable job. Display queued/running/succeeded/failed states and allow retry only by creating a fresh request with a new provenance record.

- [ ] **Step 3: Generate only from the frozen revision’s allowed sources.**

  Add parser-service `POST /api/generate-course`, receiving the brief and source IDs. Retrieve only those IDs, build a strict JSON-only prompt, validate and retry malformed model output once, and return the validated generated graph plus model/version metadata. Do not expose Ollama, prompts, or parser-service directly to the browser.

- [ ] **Step 4: Persist only a complete generated course.**

  The worker loads the generation and frozen source set, calls the typed parser client, validates the response again, then uses one database transaction to create the Course, chapters, lessons, copied source records/bindings, and generation provenance. Set `createdCourseId` only after that transaction succeeds. A failure records a safe error and leaves no Course row.

- [ ] **Step 5: Make the result reviewable and editable.**

  On success, show the created course in the authoring library with a provenance panel linking it to the generation request and source revision. Opening it uses the normal editor; no generated text, quiz suggestion, or source can be auto-frozen, published, or delivered.

- [ ] **Step 6: Verify the durable job and provenance flow.**

  Run `npm run typecheck`, `npm run lint`, and parser-service static checks. With local worker/parser/Studio services available, submit one generation, inspect the job and generation rows, confirm no Course exists while it is pending, confirm the completed Course has stable IDs and provenance after success, and confirm its source IDs exactly match the selected frozen revision.

- [ ] **Step 7: Commit the AI-draft delivery.**

  ```bash
  git add apps/job-worker apps/web/src/course-studio apps/web/src/app/api packages/contracts packages/database packages/jobs packages/parser-client services/parser-service
  git commit -m "feat: generate revision-grounded course drafts"
  ```

## Task 5: Remove public-catalog semantics while retaining author preview and review

**Files:**
- Modify: `apps/web/src/app/page.tsx`
- Delete: `apps/web/src/app/course/[slug]/page.tsx`
- Modify: `apps/web/src/app/studio/page.tsx`
- Modify: `apps/web/src/course-studio/CourseLibrary.tsx`
- Modify: `apps/web/src/course-studio/RevisionPanel.tsx`
- Modify: `apps/web/src/app/api/reviews/[token]/feedback/route.ts`
- Modify: `apps/web/src/player/MotoViewer.tsx` only if copy/props still name learner publication

**Interfaces:**
- `/` redirects to `/studio`; it does not enumerate courses.
- The embedded `AuthoringPreview` is the normal author preview.
- A review token continues to expose one frozen master snapshot and feedback endpoint, independent of course visibility.

- [ ] **Step 1: Delete the public course catalog route.**

  Replace the home page course-card catalog with a redirect to `/studio`. Delete `/course/[slug]` and remove all imports/repository calls that treat it as a client learner entrypoint. Do not replace it with another public course listing.

- [ ] **Step 2: Use precise master-review wording.**

  Change Studio and review copy from “publish,” “learner catalog,” and client-delivery wording to “author preview,” “frozen master revision,” and “review link.” Retain the existing immutable-snapshot and feedback behavior.

- [ ] **Step 3: Verify route and review boundaries.**

  Run `npm run typecheck` and `npm run lint`. With an authenticated browser, verify `/` redirects to Studio, Studio library opens the embedded preview, and a review link renders its immutable snapshot without exposing the authoring library or an edit API.

- [ ] **Step 4: Commit the product-boundary delivery.**

  ```bash
  git add apps/web/src/app apps/web/src/course-studio apps/web/src/player packages/database
  git commit -m "refactor: make Course Studio authoring-only"
  ```

## Task 6: Retire Sanity and the legacy unbound corpus completely

**Files:**
- Modify: `apps/web/package.json`
- Modify: root `package-lock.json`
- Delete: any remaining `apps/web/sanity.config.ts`, `sanity.cli.ts`, `apps/web/src/sanity/`, embedded Studio routes, Sanity image loader, Sanity contracts/adapters, and Sanity quiz/player branches
- Modify: `.env.example` and relevant docs/README files
- Modify: `services/parser-service/README.md`

**Interfaces:**
- `rg -n -i 'sanity|next-sanity|@sanity|SANITY_' --glob '!docs/superpowers/specs/*' --glob '!docs/superpowers/plans/*'` returns no runtime/configuration references.
- No parser request can retrieve by course ID without a resolved frozen revision source set.

- [ ] **Step 1: Audit residual runtime references after the replacements land.**

  Search manifests, lockfile, app routes, player imports, worker handlers, environment examples, and documentation. Classify each hit as removable runtime code, generated lockfile data, or historical design documentation. Do not delete unrelated Next.js/runtime infrastructure.

- [ ] **Step 2: Remove dependencies and code paths together.**

  Uninstall direct Sanity dependencies from `apps/web`, regenerate the lockfile through npm, delete the embedded Studio/config/schema/query files, and remove Sanity-specific player/adapters/quiz paths. Delete the old unbound upload route only after Task 2’s source flow is working.

- [ ] **Step 3: Remove configuration and operational instructions.**

  Remove `SANITY_*` environment names from examples and docs; update parser-service docs to describe revision-bound source retrieval; update Course Studio copy to describe authoring masters and future downstream delivery without specifying an Insiders format.

- [ ] **Step 4: Verify removal without broad regressions.**

  Run `npm ci --dry-run --ignore-scripts`, `npm run typecheck`, `npm run lint`, and `npm run build`. Inspect the final Sanity search, excluding only historical planning/spec documents. If build migration fails with Prisma `P1001`, report PostgreSQL availability separately from code correctness.

- [ ] **Step 5: Commit the retirement.**

  ```bash
  git add apps/web package.json package-lock.json services/parser-service .env.example README.md
  git commit -m "refactor: retire Sanity authoring infrastructure"
  ```

## Task 7: Perform the end-to-end master-authoring acceptance pass

**Files:**
- Modify only if evidence reveals a scoped defect in the relevant task files.
- Create no automated test files.

- [ ] **Step 1: Verify static contracts.**

  Run `npm run typecheck`, `npm run lint`, and `npm run build`; confirm the applied migration status with `npm run db:migrate` when PostgreSQL is available. Re-run `rg` checks for Sanity, course publication state, `courseMode`, and legacy unbound corpus calls.

- [ ] **Step 2: Verify authenticated authoring in the browser.**

  Sign in to Studio; create a course; upload/index a source; freeze a master; exercise rich text, visual hotspot/overlay editing, restored assets, embedded preview, review link, and source removal protection for frozen material. Capture console/network errors and failed 5xx responses.

- [ ] **Step 3: Verify AI provenance in the browser and database.**

  Start a course-generation job from a frozen revision, observe progress and retry behavior, open the completed generated course, and inspect its saved generation/source provenance. Confirm the request never creates an Insiders delivery, a public catalog listing, or a partially generated course.

- [ ] **Step 4: Record any unavailable evidence honestly.**

  If a local database, R2, parser-service, Ollama, worker, or browser session is unavailable, report the exact unavailable dependency and completed static checks. Do not claim persistence, grounding, visual behavior, or delivery readiness without observed evidence.

## Plan self-review

- Coverage: Task 1 removes publication state and establishes records; Task 2 implements revision-bound sources; Task 3 restores editor parity; Task 4 provides AI course generation; Task 5 corrects authoring-only routing; Task 6 removes Sanity; Task 7 verifies the complete master-authoring flow.
- No placeholders: every planned file path, interface, verification command, and commit scope is explicit. The acceptance task does not prescribe a speculative fix or commit.
- Type consistency: `CourseSourceFile`/`CourseRevisionSource` are produced in Task 1 and consumed by Tasks 2 and 4; `sourceRevisionId` is the sole generation grounding input; generated graphs have no database IDs until Task 4 persists them.
