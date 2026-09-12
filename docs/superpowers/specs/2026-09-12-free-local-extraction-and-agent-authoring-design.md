# Free local extraction + agent-packaged course authoring

Status: approved design, pending implementation plan
Date: 2026-09-12
Related prior investigation: this session diagnosed that all `DOCUMENT_INDEX`
jobs for course `course.4bbaedc0-7002-4a1f-a203-5f840bf4e1e4` ("Motorola
Signature 27") failed — first because the parser service wasn't running,
then, once it was, because `services/parser-service/.env`'s `OPENAI_API_KEY`
is a placeholder and no real OpenAI or Anthropic API key exists anywhere in
this repo's environment.

## Purpose

This project has no confirmed budget or company go-ahead yet and may be
abandoned. The author (this repo's maintainer) does not want to take on
billed API risk (OpenAI embeddings/chat, or a fresh metered Anthropic API
key) for a project that might not ship. At the same time, the product's
freeze/export pipeline is hard-gated on successful *embedding-based*
source indexing, which blocks SCORM export entirely if indexing can never
succeed.

Separately, the maintainer already has a working, unpaid tool for
AI-assisted authoring: the local `course-studio-content-engineer` Claude
Code subagent, driven through this session's existing Claude Code
plan — no separate per-call billing. Today it's invoked ad hoc with a
custom prompt each time; the maintainer wants it "feature-ized" into a
clean, repeatable, discoverable entry point that can be pointed at a
folder of source/media files on disk.

This spec covers the smallest change that unblocks both: a free,
local-only text-extraction path that satisfies the freeze gate without any
billed API call, plus a packaged entry point for the existing local agent
to consume a folder of files and author a course end-to-end.

## Out of scope (deliberately deferred)

- Swapping generation calls (Assistant Q&A drafting, AI course-generation)
  to Anthropic. Not attempted now: with `EMBEDDINGS_ENABLED=false` (see
  below), there is no indexed/embedded source corpus for retrieval to draw
  from anyway, so wiring a new model provider into `generation.py`/`rag.py`
  right now would have nothing to retrieve against. Revisit once there's a
  green light and a real budget decision (OpenAI embeddings + Claude
  generation, or a full Voyage AI move, or Microsoft Copilot if Lionbridge
  provides access — all explicitly future work, not decided here).
- Any server-side or browser-side ("File System Access API") folder-access
  feature. The maintainer confirmed the agent stays local and Claude
  Code-driven; it already has real filesystem access via its existing
  `Bash`/`mcp__filesystem__*` tools, so no new product surface is needed
  for "folder access."
- Any change to `generateAssistantQaDrafts` / `generateCourseDraft`'s
  strict `indexStatus: 'INDEXED'` requirement
  (`apps/web/src/authoring/server/assistant-commands.ts:18-21`). Those
  features genuinely need real embeddings and should stay honestly
  unavailable rather than silently degrade.

## Architecture

```
Folder of files (local disk)
  -> /create-course slash command (new)
       -> course-studio-content-engineer agent (existing, updated instructions)
            -> classifies each file: AI/citation source vs lesson media vs irrelevant
            -> drives the real Studio UI (Playwright/chrome-devtools file-upload)
                 -> POST /api/course-studio/courses/{courseId}/sources (existing route, unchanged)
                      -> DOCUMENT_INDEX job (existing, unchanged shape)
                           -> job-worker indexDocument() (apps/job-worker/src/handlers.ts:52)
                                -> parser-client uploadCourseDocument() (packages/parser-client/src/index.ts:170)
                                     -> parser-service POST /api/upload (services/parser-service/src/lb_studio_parser/main.py:81)
                                          -> store_course_document() (documents.py)
                                               if EMBEDDINGS_ENABLED: extract, chunk, embed (OpenAI), store in Chroma
                                                 -> status: "indexed"   [renamed from "success"]
                                               else: extract, chunk, store chunk text under EXTRACTED_DIR
                                                 -> status: "extracted"   [NEW]
            -> hand-authors chapters/lessons/assessments from the extracted text (existing capability, now the default path)
            -> resolves readiness gates, freezes revision, requests SCORM export
```

## Components

### 1. `packages/database` — schema

`prisma/schema.prisma:30-35`, `CourseSourceIndexStatus` enum gains a new
value:

```prisma
enum CourseSourceIndexStatus {
  PENDING
  EXTRACTED   // NEW — text extracted locally, no embeddings generated
  INDEXED
  FAILED
  DELETING
}
```

Migration: additive `ALTER TYPE "CourseSourceIndexStatus" ADD VALUE
'EXTRACTED'` via `npm run db:migrate:dev`. Non-breaking; existing rows are
unaffected.

### 2. `packages/database/src/course-source-repository.ts` — new mutator

Add `markSourceExtracted(courseId, sourceId, chunksStored)`, mirroring
`markSourceIndexed` (`course-source-repository.ts:82-94`) exactly except
it sets `indexStatus: 'EXTRACTED'` instead of `'INDEXED'`. Export it from
`packages/database/src/index.ts` alongside the existing `markSourceIndexed`
/ `markSourceFailed` exports (`index.ts:93-94`).

### 3. `services/parser-service` — extraction-only mode

New setting in `settings.py`: `EMBEDDINGS_ENABLED = os.environ.get(
"EMBEDDINGS_ENABLED", "false").lower() == "true"`. Explicit opt-in,
defaulting to `false` — deliberately **not** inferred from whether
`OPENAI_API_KEY` merely looks present, since that inference is exactly
what produced the misleading `openai_configured: true` reading on a
placeholder key earlier this session. Even if a real key ends up in the
environment for unrelated testing, embeddings stay off unless this flag
is explicitly set to `true`.

In `documents.py`'s `store_course_document()`: extraction and chunking
happen unconditionally (this is the existing markitdown-based step,
already free/local — it's what proves the file is real and parseable,
catching corrupt/unreadable uploads exactly as today). The branch:

- `EMBEDDINGS_ENABLED == true`: same existing behavior — call
  `replace_document_chunks()` (`retrieval.py:107`), which embeds via
  OpenAI and stores vectors in Chroma. Response status renamed from
  `"success"` to `"indexed"` (see contract change below — this is the
  only change on this branch, a rename for a clean two-value enum, not a
  behavior change).
- `EMBEDDINGS_ENABLED == false`: skip embedding entirely. Persist the
  chunk texts as a JSON file under a new `EXTRACTED_DIR` setting
  (default `./extracted_chunks`, same pattern as the existing
  `CHROMA_DIR` setting in `settings.py` — a plain local directory this
  Python process owns directly, not a cross-language call into the
  Node-only `packages/storage` client), keyed the same way Chroma chunks
  are today (`course_id`/`source_id`/`sha256`) so a future real-embedding
  pass can re-embed those exact chunks without re-extracting. Response
  `status: "extracted"`.

`/api/health` gets one more field, `embeddings_enabled: bool`, so this is
observable without reading `.env` — closes the exact ambiguity that cost
time earlier (`openai_configured: true` looking like "ready" when it
wasn't).

### 4. `packages/parser-client` / `packages/contracts` — response shape

`ParserUploadResponseSchema` (`packages/parser-client/src/index.ts:89-94`)
already has a generic `status: z.string()` field, unused meaningfully by
callers today — repurpose it. `DocumentIndexResultSchema`
(`packages/contracts/src/jobs.ts:29-33`) gains a `status:
z.enum(['indexed', 'extracted'])` field alongside the existing `filename`/
`chunksStored`.

### 5. `apps/job-worker/src/handlers.ts` — branch on status

`indexDocument()` (`handlers.ts:52-109`): after a successful
`uploadCourseDocument()` call, branch on `result.status`:
`'extracted'` → `markSourceExtracted(...)`; `'indexed'` (today's
`'success'`, renamed for clarity) → `markSourceIndexed(...)` — unchanged
behavior on that branch. Failure handling (`markSourceFailed`, retry
logic) is untouched; extraction failures (corrupt file, unsupported
content) surface exactly as today, independent of the embedding step.

### 6. `packages/database/src/course-review-repository.ts` — freeze gate

Line 133's check becomes:

```ts
if (sources.some((source) => source.indexStatus !== 'INDEXED' && source.indexStatus !== 'EXTRACTED')) {
  throw new Error('COURSE_SOURCES_NOT_INDEXED');
}
```

Everything downstream of the gate (readiness validation, graph shape
check, assistant-Q&A snapshotting) is unchanged — freezing with
`EXTRACTED`-only sources produces a normal `CourseRevision`, and SCORM
export (keyed only by `revisionId`,
`apps/web/src/app/api/course-studio/revisions/[revisionId]/scorm-export/route.ts`)
works exactly as it does today once a revision exists.

### 7. `apps/web/src/authoring/SourcePanel.tsx` — status display

`statusLabel()` (`SourcePanel.tsx:25-32`) gains an `'extracted'` branch:
distinct copy from `'indexed'`, e.g. "Extracted — ready to freeze, not
searchable by AI drafting" vs. "N indexed chunks". The empty-state and
upload-confirmation copy referencing "indexed" stays accurate for both
states without further changes (freeze-readiness copy already says
"every owned source is indexed" generically enough to cover both, but
worth a one-line addendum clarifying AI drafting needs the stronger
`INDEXED` state specifically).

### 8. `.claude/commands/create-course.md` — new slash command

New project-scoped slash command, `/create-course <folder-path>
[brief]`. Body: a short dispatch prompt that hands the folder path and
brief to the `course-studio-content-engineer` subagent as a structured
task. This is the actual "feature" surface — replacing "write a custom
dispatch prompt from scratch each time" with one named, repeatable,
documented command.

### 9. `.claude/agents/course-studio-content-engineer.md` — updated agent

- **Operating procedure step 1** ("Inventory the source dump"): extended
  to start from a folder path when given one — walk it, classify each
  file as (a) an AI/citation source (PDF/PPTX/DOCX/XLSX, ≤50MB → Source
  panel), (b) lesson media (images/video → attached per-lesson, never the
  Source panel — this classification already exists as rule #5, just now
  applied to an arbitrary folder instead of a manually-enumerated dump),
  or (c) irrelevant.
- **Uploads stay browser-driven**: for each classified source file, the
  agent still drives the real Source panel file input via
  Playwright/chrome-devtools' file-upload capability
  (`setInputFiles`/`mcp__chrome-devtools__upload_file`, both accept a real
  local path without a native OS dialog) — same code path and validation
  a human uses. No direct API/curl shortcut; this preserves rule #1
  ("content authored through the Studio UI, never bypassed").
- **Rule #2 rewritten**: "AI drafting unavailable" stops being an
  edge-case aside and becomes the expected default — hand-authoring from
  extracted source text is the normal path now, not a fallback, given no
  embedding budget. Still requires the same self-review pass and the same
  explicit flagging of substituted judgment in the final report.
- **"Standing up the environment" checklist**: updated to check
  `embeddings_enabled` on `/health` and expect it to read `false` — stop
  treating a missing/placeholder `OPENAI_API_KEY` as a bug to fix; it's
  the intended state until there's a budget decision. Still flags a
  genuinely *unreachable* parser service (network error) as a real
  blocker to fix, same as before.
- **Freeze-gate awareness**: note that `EXTRACTED` (not just `INDEXED`)
  satisfies freeze readiness, so the agent doesn't misdiagnose an
  `EXTRACTED`-only course as blocked.

## Data flow / status lifecycle

```
PENDING --(parser extracts+chunks OK, EMBEDDINGS_ENABLED=false)--> EXTRACTED --(freeze-eligible)
PENDING --(parser extracts+chunks+embeds OK, EMBEDDINGS_ENABLED=true)--> INDEXED --(freeze-eligible, AI-drafting-eligible)
PENDING --(extraction fails, or embedding call fails after 3 attempts)--> FAILED --(retryable via existing retry endpoint)
any --(removal requested)--> DELETING
```

`EXTRACTED` and `INDEXED` are both terminal-success states from the job
worker's perspective; `EXTRACTED` sources can later be re-embedded (by
retrying with `EMBEDDINGS_ENABLED=true`) to reach `INDEXED` — the retry
endpoint (`retryAuthoringSourceIndex`,
`apps/web/src/authoring/server/source-commands.ts:109`) needs no change
for this, since it already just re-enqueues the same `DOCUMENT_INDEX`
job, which will pick up whatever `EMBEDDINGS_ENABLED` is set to at retry
time.

## Error handling

Unchanged failure paths: corrupt/unreadable files, oversized uploads, and
service-unreachable errors all fail exactly as today (`documents.py`'s
existing exception hierarchy — `InvalidUploadError`,
`DocumentExtractionError`, `UploadTooLargeError` — is untouched; only the
success path branches). No new error states are introduced by this
change; `EXTRACTED` is a success state, not an error state.

## Testing

- New `services/parser-service` unit test (`tests/`, `python -m unittest
  discover -s tests`) covering `store_course_document()` with
  `EMBEDDINGS_ENABLED=false`: asserts no OpenAI call is made (mock/spy the
  embeddings client to fail the test if invoked), a chunk-text artifact is
  written under `EXTRACTED_DIR`, and the returned status is `"extracted"`.
- `npm run typecheck` and `npm run lint` across the touched TS
  packages/apps (`packages/database`, `packages/parser-client`,
  `packages/contracts`, `apps/job-worker`, `apps/web`).
- `ruff check .` / `mypy src` for `services/parser-service`.
- End-to-end dry run: `/create-course` pointed at a small sample folder
  (a handful of representative PDF/DOCX/PPTX/XLSX files and a couple of
  images) through extraction → hand-authoring → readiness gates → freeze
  → SCORM export, confirmed against a running `npm run dev` + `npm run
  jobs:worker`. Not assumed to already exist on disk — assembled as part
  of this test.

## Rollout / future work (explicitly not part of this implementation)

- If Lionbridge greenlights the project and provides budget/Copilot
  access: revisit `EMBEDDINGS_ENABLED` defaults, decide the real
  generation-model provider (OpenAI, Anthropic, Copilot), and re-embed
  any `EXTRACTED` sources already sitting in courses built under this
  mode.
- No migration path is needed for existing `FAILED` sources from before
  this change — they retry through the existing retry endpoint and pick
  up the new extraction-only behavior automatically.
