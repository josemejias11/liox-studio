# Free Local Extraction + Agent-Packaged Course Authoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a course freeze and export to SCORM using only free, local text
extraction (no billed embedding/chat API calls), and package the existing
local Claude-Code-driven `course-studio-content-engineer` agent behind a
repeatable `/create-course <folder-path> [brief]` entry point.

**Architecture:** Add a new `EXTRACTED` source-index status that a source
reaches via local-only markitdown extraction + chunking (no OpenAI call,
gated behind a new `EMBEDDINGS_ENABLED` setting defaulting to `false`); the
freeze gate accepts `EXTRACTED` or `INDEXED`, while AI-drafting features
(`generate-assistant-qa`, `generate-course`) keep requiring the stronger
`INDEXED` state and stay honestly unavailable without a real embedding
budget. Layer a new slash command + updated agent instructions on top so the
existing local agent can be pointed at a folder and build a course
end-to-end using hand-authored content from that free extraction.

**Tech Stack:** TypeScript (Next.js app, job-worker, Prisma) + Python
(FastAPI parser-service, markitdown, ChromaDB) + a Claude Code slash command
and agent-instructions file.

**Spec:** `docs/superpowers/specs/2026-09-12-free-local-extraction-and-agent-authoring-design.md`

## Global Constraints

- No billed API call may be added. `EMBEDDINGS_ENABLED` (new parser-service
  setting) must default to `false`.
- This repo has **no configured JS/TS test runner** — `npm run lint` and
  `npm run typecheck` are the only checks that exist (see root `CLAUDE.md`).
  Do not add Jest/Vitest/etc. TS task verification = typecheck + lint, not
  new unit test files.
- `@typescript-eslint/no-explicit-any` is a hard ESLint error — never
  introduce `any` to silence a type error.
- Prisma enum changes must be additive only (`ALTER TYPE ... ADD VALUE`) —
  never remove or reorder existing `CourseSourceIndexStatus` values.
- Python: `ruff check .` (line length 100, `E`/`F`/`I`/`UP`/`B` rules) and
  `mypy src` (`disallow_untyped_defs`, `warn_return_any` on) must pass from
  the activated `services/parser-service/venv`. Tests run via
  `python -m unittest discover -s tests` from that same venv.
- Follow the repo's existing commit convention (see `git log`): a short
  imperative subject with a `feat:`/`fix:`/`refactor:`/`docs:` prefix.
  Append whatever attribution footer your own session's instructions
  require.
- An empty `sourceIds` list must never expand to the whole course corpus —
  this existing scoping guarantee (`packages/contracts`) is untouched by
  this plan; don't go near it.

---

## Task 1: Add the `EXTRACTED` status to the type system

**Files:**
- Modify: `packages/database/prisma/schema.prisma:30-35`
- Modify: `packages/contracts/src/course-studio.ts:39`
- Modify: `packages/contracts/src/jobs.ts:29-33`

**Interfaces:**
- Produces: Prisma enum value `CourseSourceIndexStatus.EXTRACTED`; TS type
  `CourseSourceIndexStatus` (from `@lb-studio/contracts/course-studio`)
  including `'extracted'`; `DocumentIndexResultSchema` gains a `status:
  z.enum(['indexed', 'extracted'])` field alongside its existing `filename`/
  `chunksStored`.

- [ ] **Step 1: Add `EXTRACTED` to the Prisma enum**

In `packages/database/prisma/schema.prisma`, change:

```prisma
enum CourseSourceIndexStatus {
  PENDING
  INDEXED
  FAILED
  DELETING
}
```

to:

```prisma
enum CourseSourceIndexStatus {
  PENDING
  EXTRACTED
  INDEXED
  FAILED
  DELETING
}
```

- [ ] **Step 2: Create and apply the migration**

Run: `npm run db:migrate:dev -- --name add_extracted_source_status`

Expected: a new `packages/database/prisma/migrations/<timestamp>_add_extracted_source_status/migration.sql` containing `ALTER TYPE "CourseSourceIndexStatus" ADD VALUE 'EXTRACTED';`, applied to the local dev database with no errors.

- [ ] **Step 3: Regenerate the Prisma client**

Run: `npm run db:generate`

Expected: exits 0; `@prisma/client`'s generated `CourseSourceIndexStatus` enum now includes `EXTRACTED`.

- [ ] **Step 4: Add `'extracted'` to the contracts status list**

In `packages/contracts/src/course-studio.ts:39`, change:

```ts
export const COURSE_SOURCE_INDEX_STATUSES = ['pending', 'indexed', 'failed', 'deleting'] as const;
```

to:

```ts
export const COURSE_SOURCE_INDEX_STATUSES = [
  'pending',
  'extracted',
  'indexed',
  'failed',
  'deleting',
] as const;
```

- [ ] **Step 5: Add `status` to `DocumentIndexResultSchema`**

In `packages/contracts/src/jobs.ts:29-33`, change:

```ts
export const DocumentIndexResultSchema = z.object({
  filename: z.string().min(1).max(255),
  chunksStored: z.number().int().min(0),
});
```

to:

```ts
export const DocumentIndexResultSchema = z.object({
  filename: z.string().min(1).max(255),
  chunksStored: z.number().int().min(0),
  status: z.enum(['indexed', 'extracted']),
});
```

- [ ] **Step 6: Verify**

Run: `npm run typecheck` and `npm run lint`

Expected: both exit 0 (nothing references the old 4-value status list or the old 2-field `DocumentIndexResultSchema` shape yet, since no consumer has been touched — this task only widens types).

- [ ] **Step 7: Commit**

```bash
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations packages/contracts/src/course-studio.ts packages/contracts/src/jobs.ts
git commit -m "feat: add EXTRACTED source-index status to the type system"
```

---

## Task 2: Add `markSourceExtracted` to the database repository

**Files:**
- Modify: `packages/database/src/course-source-repository.ts:17-30,82-94`
- Modify: `packages/database/src/index.ts` (course-source-repository export block)

**Interfaces:**
- Consumes: Task 1's `CourseSourceIndexStatus.EXTRACTED` Prisma value.
- Produces: `markSourceExtracted(courseId: string, sourceId: string, chunksStored: number): Promise<CourseSourceFile>`, exported from `@lb-studio/database`.

- [ ] **Step 1: Widen the internal `SourceRecord` status union**

In `packages/database/src/course-source-repository.ts:25`, change:

```ts
  indexStatus: 'PENDING' | 'INDEXED' | 'FAILED' | 'DELETING';
```

to:

```ts
  indexStatus: 'PENDING' | 'EXTRACTED' | 'INDEXED' | 'FAILED' | 'DELETING';
```

- [ ] **Step 2: Add `markSourceExtracted`, mirroring `markSourceIndexed`**

Immediately after `markSourceIndexed` (`course-source-repository.ts:82-94`), add:

```ts
export async function markSourceExtracted(
  courseId: string,
  sourceId: string,
  chunksStored: number,
): Promise<CourseSourceFile> {
  const existing = await requireOwnedCourseSource(courseId, sourceId);
  if (existing.indexStatus === 'DELETING') throw new Error('COURSE_SOURCE_REMOVAL_IN_PROGRESS');
  const source = await prisma.courseSourceFile.update({
    where: { id: sourceId },
    data: { indexStatus: 'EXTRACTED', chunksStored, indexError: null },
  });
  return toCourseSourceFile(source);
}
```

- [ ] **Step 3: Export it from the package root**

In `packages/database/src/index.ts`, find:

```ts
export {
  beginCourseSourceRemoval,
  completeCourseSourceRemoval,
  createPendingSource,
  getCourseSource,
  listCourseSources,
  listFrozenRevisionSourceIds,
  listRevisionSources,
  markSourceFailed,
  markSourceIndexed,
  retryCourseSourceIndex,
} from './course-source-repository';
```

Change to:

```ts
export {
  beginCourseSourceRemoval,
  completeCourseSourceRemoval,
  createPendingSource,
  getCourseSource,
  listCourseSources,
  listFrozenRevisionSourceIds,
  listRevisionSources,
  markSourceExtracted,
  markSourceFailed,
  markSourceIndexed,
  retryCourseSourceIndex,
} from './course-source-repository';
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck` and `npm run lint`

Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
git add packages/database/src/course-source-repository.ts packages/database/src/index.ts
git commit -m "feat: add markSourceExtracted repository function"
```

---

## Task 3: Update the freeze gate to accept `EXTRACTED` sources

**Files:**
- Modify: `packages/database/src/course-review-repository.ts:133`

**Interfaces:**
- Consumes: Task 1's `EXTRACTED` status value (as a string literal — no function call needed from Task 2).

- [ ] **Step 1: Widen the gate condition**

In `packages/database/src/course-review-repository.ts:133`, change:

```ts
      if (sources.some((source) => source.indexStatus !== 'INDEXED')) {
        throw new Error('COURSE_SOURCES_NOT_INDEXED');
      }
```

to:

```ts
      if (
        sources.some(
          (source) => source.indexStatus !== 'INDEXED' && source.indexStatus !== 'EXTRACTED',
        )
      ) {
        throw new Error('COURSE_SOURCES_NOT_INDEXED');
      }
```

Do **not** touch `apps/web/src/authoring/server/assistant-commands.ts:18-21` — that gate stays strictly `'INDEXED'`, since Assistant Q&A generation genuinely needs embeddings.

- [ ] **Step 2: Verify**

Run: `npm run typecheck` and `npm run lint`

Expected: both exit 0. (Functional verification — that a course with only `EXTRACTED` sources can actually freeze — happens in Task 13's end-to-end run, since it requires the full upload→extract→freeze flow this plan builds across later tasks.)

- [ ] **Step 3: Commit**

```bash
git add packages/database/src/course-review-repository.ts
git commit -m "feat: let EXTRACTED sources satisfy the revision-freeze gate"
```

---

## Task 4: Add `EMBEDDINGS_ENABLED` and `EXTRACTED_DIR` settings

**Files:**
- Modify: `services/parser-service/src/lb_studio_parser/settings.py:22-25` (insert after the `CHROMA_DIR` block)
- Modify: `services/parser-service/tests/test_settings.py`

**Interfaces:**
- Produces: `EMBEDDINGS_ENABLED: bool` (default `False`), `EXTRACTED_DIR: str` (absolute path, default `<SERVICE_ROOT>/extracted_chunks`).

- [ ] **Step 1: Write the failing tests**

Append to `services/parser-service/tests/test_settings.py`, inside the existing `OpenAISettingsTests` class (before the final blank line / `if __name__ == "__main__":` block):

```python
    def test_embeddings_disabled_by_default(self) -> None:
        previous = os.environ.pop("EMBEDDINGS_ENABLED", None)
        try:
            sys.modules.pop("lb_studio_parser.settings", None)
            settings = importlib.import_module("lb_studio_parser.settings")
            self.assertFalse(settings.EMBEDDINGS_ENABLED)
        finally:
            if previous is not None:
                os.environ["EMBEDDINGS_ENABLED"] = previous

    def test_embeddings_enabled_when_flag_set_true(self) -> None:
        previous = os.environ.get("EMBEDDINGS_ENABLED")
        os.environ["EMBEDDINGS_ENABLED"] = "true"
        try:
            sys.modules.pop("lb_studio_parser.settings", None)
            settings = importlib.import_module("lb_studio_parser.settings")
            self.assertTrue(settings.EMBEDDINGS_ENABLED)
        finally:
            if previous is None:
                os.environ.pop("EMBEDDINGS_ENABLED", None)
            else:
                os.environ["EMBEDDINGS_ENABLED"] = previous
```

- [ ] **Step 2: Run to verify they fail**

Run (from the activated `services/parser-service/venv`): `python -m unittest tests.test_settings -v`

Expected: `test_embeddings_disabled_by_default` and `test_embeddings_enabled_when_flag_set_true` both FAIL with `AttributeError: module 'lb_studio_parser.settings' has no attribute 'EMBEDDINGS_ENABLED'`.

- [ ] **Step 3: Implement the settings**

In `services/parser-service/src/lb_studio_parser/settings.py`, immediately after the existing `CHROMA_DIR` block (after line 22, before `MAX_UPLOAD_BYTES = 50 * 1024 * 1024`), insert:

```python
EMBEDDINGS_ENABLED = os.environ.get("EMBEDDINGS_ENABLED", "false").strip().lower() == "true"
_configured_extracted_dir = Path(os.environ.get("EXTRACTED_DIR", "extracted_chunks"))
EXTRACTED_DIR = str(
    _configured_extracted_dir
    if _configured_extracted_dir.is_absolute()
    else SERVICE_ROOT / _configured_extracted_dir
)
```

- [ ] **Step 4: Run to verify they pass**

Run: `python -m unittest tests.test_settings -v`

Expected: all tests in `test_settings.py` PASS.

- [ ] **Step 5: Verify lint/types**

Run: `ruff check .` and `mypy src` (from the activated venv, in `services/parser-service`)

Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add services/parser-service/src/lb_studio_parser/settings.py services/parser-service/tests/test_settings.py
git commit -m "feat: add EMBEDDINGS_ENABLED and EXTRACTED_DIR settings"
```

---

## Task 5: Gate OpenAI client construction behind `EMBEDDINGS_ENABLED`

**Files:**
- Modify: `services/parser-service/src/lb_studio_parser/runtime.py`

**Interfaces:**
- Consumes: Task 4's `EMBEDDINGS_ENABLED: bool`.
- Produces: no interface change — `runtime.embeddings` and `runtime.generation_model` stay `OpenAIEmbeddings | None` / `ChatOpenAI | None` as already typed; they're just `None` more often now.

- [ ] **Step 1: Update the import list**

In `services/parser-service/src/lb_studio_parser/runtime.py:12-18`, change:

```python
from .settings import (
    CHROMA_DIR,
    OPENAI_API_KEY,
    OPENAI_CHAT_MODEL,
    OPENAI_EMBEDDING_MODEL,
    OPENAI_TIMEOUT_SECONDS,
)
```

to:

```python
from .settings import (
    CHROMA_DIR,
    EMBEDDINGS_ENABLED,
    OPENAI_API_KEY,
    OPENAI_CHAT_MODEL,
    OPENAI_EMBEDDING_MODEL,
    OPENAI_TIMEOUT_SECONDS,
)
```

- [ ] **Step 2: Gate the startup requirement and client construction**

In `services/parser-service/src/lb_studio_parser/runtime.py:34-59`, change:

```python
@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    logging.basicConfig(level=logging.INFO)
    token = os.environ.get("PARSER_SERVICE_TOKEN")
    if not token:
        raise RuntimeError("PARSER_SERVICE_TOKEN environment variable is not set.")
    if not OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY environment variable is not set.")
    runtime.token = token
    try:
        runtime.embeddings = OpenAIEmbeddings(
            model=OPENAI_EMBEDDING_MODEL,
            api_key=OPENAI_API_KEY,
            request_timeout=OPENAI_TIMEOUT_SECONDS,
        )
        runtime.generation_model = ChatOpenAI(
            model=OPENAI_CHAT_MODEL,
            api_key=OPENAI_API_KEY,
            timeout=OPENAI_TIMEOUT_SECONDS,
            model_kwargs={"response_format": {"type": "json_object"}},
        )
        os.makedirs(CHROMA_DIR, exist_ok=True)
        runtime.chroma_client = chromadb.PersistentClient(path=CHROMA_DIR)
    except Exception:
        logger.exception("Failed to initialize OpenAI clients or ChromaDB at %s.", CHROMA_DIR)
        raise
    yield
```

to:

```python
@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    logging.basicConfig(level=logging.INFO)
    token = os.environ.get("PARSER_SERVICE_TOKEN")
    if not token:
        raise RuntimeError("PARSER_SERVICE_TOKEN environment variable is not set.")
    if EMBEDDINGS_ENABLED and not OPENAI_API_KEY:
        raise RuntimeError(
            "OPENAI_API_KEY environment variable is not set but EMBEDDINGS_ENABLED is true."
        )
    runtime.token = token
    try:
        if OPENAI_API_KEY:
            runtime.embeddings = OpenAIEmbeddings(
                model=OPENAI_EMBEDDING_MODEL,
                api_key=OPENAI_API_KEY,
                request_timeout=OPENAI_TIMEOUT_SECONDS,
            )
            runtime.generation_model = ChatOpenAI(
                model=OPENAI_CHAT_MODEL,
                api_key=OPENAI_API_KEY,
                timeout=OPENAI_TIMEOUT_SECONDS,
                model_kwargs={"response_format": {"type": "json_object"}},
            )
        os.makedirs(CHROMA_DIR, exist_ok=True)
        runtime.chroma_client = chromadb.PersistentClient(path=CHROMA_DIR)
    except Exception:
        logger.exception("Failed to initialize OpenAI clients or ChromaDB at %s.", CHROMA_DIR)
        raise
    yield
```

Note: with `OPENAI_API_KEY` still set to today's placeholder value in
`services/parser-service/.env`, this is behavior-preserving for the current
dev setup (`if OPENAI_API_KEY:` is still true). It only changes behavior for
a fresh setup with no key at all and `EMBEDDINGS_ENABLED=false` — which now
boots cleanly instead of refusing to start.

- [ ] **Step 3: No new automated test for this step**

This file wires FastAPI's startup lifecycle, which this repo does not unit
test today (`services/parser-service`'s HTTP-adjacent startup wiring has no
test coverage, same documented gap as `main.py`'s routes — see root
`CLAUDE.md`). Verify manually as part of Task 13's end-to-end run: start the
service with `OPENAI_API_KEY` fully unset and `EMBEDDINGS_ENABLED` unset,
confirm `/health` returns 200 rather than the process refusing to start.

- [ ] **Step 4: Verify lint/types**

Run: `ruff check .` and `mypy src`

Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
git add services/parser-service/src/lb_studio_parser/runtime.py
git commit -m "feat: only require OPENAI_API_KEY when EMBEDDINGS_ENABLED is true"
```

---

## Task 6: Add local (no-embedding) chunk storage

**Files:**
- Create: `services/parser-service/src/lb_studio_parser/extraction_store.py`
- Create: `services/parser-service/tests/test_extraction_store.py`

**Interfaces:**
- Consumes: Task 4's `EXTRACTED_DIR: str`.
- Produces: `store_extracted_chunks(course_id: str, source_id: str, sha256: str, filename: str, chunks: list[str]) -> int`; `delete_extracted_chunks(course_id: str, source_id: str) -> bool`.

- [ ] **Step 1: Write the failing test**

Create `services/parser-service/tests/test_extraction_store.py`:

```python
"""Local, embedding-free chunk persistence."""

import importlib
import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

SERVICE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_ROOT / "src"))


class ExtractionStoreTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.mkdtemp(prefix="lb-studio-extracted-test-")
        self.addCleanup(shutil.rmtree, self.temp_dir, ignore_errors=True)
        import lb_studio_parser.settings as settings_module

        settings_module.EXTRACTED_DIR = self.temp_dir
        sys.modules.pop("lb_studio_parser.extraction_store", None)
        self.extraction_store = importlib.import_module("lb_studio_parser.extraction_store")

    def test_store_writes_a_json_file_with_the_chunks(self) -> None:
        count = self.extraction_store.store_extracted_chunks(
            "course-1", "source-1", "a" * 64, "brief.docx", ["chunk one", "chunk two"]
        )
        self.assertEqual(count, 2)
        stored_path = Path(self.temp_dir) / "course-1" / "source-1.json"
        self.assertTrue(stored_path.exists())
        payload = json.loads(stored_path.read_text())
        self.assertEqual(payload["chunks"], ["chunk one", "chunk two"])
        self.assertEqual(payload["filename"], "brief.docx")

    def test_delete_removes_an_existing_file_and_reports_it(self) -> None:
        self.extraction_store.store_extracted_chunks(
            "course-1", "source-1", "a" * 64, "brief.docx", ["chunk one"]
        )
        deleted = self.extraction_store.delete_extracted_chunks("course-1", "source-1")
        self.assertTrue(deleted)
        self.assertFalse((Path(self.temp_dir) / "course-1" / "source-1.json").exists())

    def test_delete_reports_false_when_nothing_to_delete(self) -> None:
        deleted = self.extraction_store.delete_extracted_chunks("course-1", "missing-source")
        self.assertFalse(deleted)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run to verify it fails**

Run: `python -m unittest tests.test_extraction_store -v`

Expected: FAIL with `ModuleNotFoundError: No module named 'lb_studio_parser.extraction_store'`.

- [ ] **Step 3: Implement the module**

Create `services/parser-service/src/lb_studio_parser/extraction_store.py`:

```python
"""Local, embedding-free persistence for extracted document chunks.

Used when EMBEDDINGS_ENABLED is false: proves a source is real and
parseable, and satisfies the freeze-readiness gate, without any billed API
call. Chunks are stored as plain JSON, keyed the same way Chroma chunks
are (course_id/source_id), so a future real-embedding pass can re-embed
them directly without re-extracting.
"""

import json
import logging
import os

from .settings import EXTRACTED_DIR

logger = logging.getLogger(__name__)


def _chunk_file_path(course_id: str, source_id: str) -> str:
    course_dir = os.path.join(EXTRACTED_DIR, course_id)
    os.makedirs(course_dir, exist_ok=True)
    return os.path.join(course_dir, f"{source_id}.json")


def store_extracted_chunks(
    course_id: str,
    source_id: str,
    sha256: str,
    filename: str,
    chunks: list[str],
) -> int:
    """Persist chunk text locally with no embedding call. Returns chunk count."""
    payload = {
        "course_id": course_id,
        "source_id": source_id,
        "sha256": sha256,
        "filename": filename,
        "chunks": chunks,
    }
    with open(_chunk_file_path(course_id, source_id), "w", encoding="utf-8") as handle:
        json.dump(payload, handle)
    logger.info(
        "Stored %d extracted chunks locally: course=%s source=%s",
        len(chunks),
        course_id,
        source_id,
    )
    return len(chunks)


def delete_extracted_chunks(course_id: str, source_id: str) -> bool:
    """Remove a locally stored chunk file, if present. Returns whether it existed."""
    path = _chunk_file_path(course_id, source_id)
    if not os.path.exists(path):
        return False
    os.remove(path)
    return True
```

- [ ] **Step 4: Run to verify it passes**

Run: `python -m unittest tests.test_extraction_store -v`

Expected: all three tests PASS.

- [ ] **Step 5: Verify lint/types**

Run: `ruff check .` and `mypy src`

Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add services/parser-service/src/lb_studio_parser/extraction_store.py services/parser-service/tests/test_extraction_store.py
git commit -m "feat: add local no-embedding chunk storage"
```

---

## Task 7: Branch `store_course_document` on `EMBEDDINGS_ENABLED`; surface status in the HTTP layer

**Files:**
- Modify: `services/parser-service/src/lb_studio_parser/documents.py`
- Modify: `services/parser-service/src/lb_studio_parser/main.py:81-108,149-168`
- Create: `services/parser-service/tests/test_documents.py`

**Interfaces:**
- Consumes: Task 4 (`EMBEDDINGS_ENABLED`), Task 6 (`store_extracted_chunks`, `delete_extracted_chunks`).
- Produces: `store_course_document(...) -> tuple[str, int, str]` (filename, chunks_stored, status), status being `"indexed"` or `"extracted"`; `UploadResponse.status` reflects the real mode; `/health` gains `embeddings_enabled: bool` and its `status`/`degraded` computation no longer requires `openai_configured` when `EMBEDDINGS_ENABLED` is false.

- [ ] **Step 1: Write the failing tests**

Create `services/parser-service/tests/test_documents.py`:

```python
"""Extraction-mode branching for store_course_document()."""

import hashlib
import importlib
import io
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

SERVICE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_ROOT / "src"))


class StoreCourseDocumentModeTests(unittest.TestCase):
    def _args(self) -> tuple[str, str, str, io.BytesIO]:
        content = b"fake docx bytes"
        return "course-test-123", "brief.docx", hashlib.sha256(content).hexdigest(), io.BytesIO(
            content
        )

    def test_extraction_only_mode_skips_embeddings(self) -> None:
        documents = importlib.import_module("lb_studio_parser.documents")
        course_id, filename, sha256, file_obj = self._args()
        with (
            patch.object(documents, "EMBEDDINGS_ENABLED", False),
            patch.object(documents, "extract_document_text", return_value="hello world"),
            patch.object(documents, "store_extracted_chunks", return_value=1) as store_extracted,
            patch.object(documents, "replace_document_chunks") as replace_chunks,
        ):
            returned_filename, chunks_stored, status = documents.store_course_document(
                course_id, "source-1", sha256, filename, file_obj
            )
        self.assertEqual(status, "extracted")
        self.assertEqual(chunks_stored, 1)
        self.assertEqual(returned_filename, filename)
        store_extracted.assert_called_once()
        replace_chunks.assert_not_called()

    def test_embeddings_enabled_mode_calls_chroma(self) -> None:
        documents = importlib.import_module("lb_studio_parser.documents")
        course_id, filename, sha256, file_obj = self._args()
        with (
            patch.object(documents, "EMBEDDINGS_ENABLED", True),
            patch.object(documents, "extract_document_text", return_value="hello world"),
            patch.object(documents, "store_extracted_chunks") as store_extracted,
            patch.object(documents, "replace_document_chunks", return_value=1) as replace_chunks,
        ):
            returned_filename, chunks_stored, status = documents.store_course_document(
                course_id, "source-1", sha256, filename, file_obj
            )
        self.assertEqual(status, "indexed")
        self.assertEqual(chunks_stored, 1)
        replace_chunks.assert_called_once()
        store_extracted.assert_not_called()


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run to verify they fail**

Run: `python -m unittest tests.test_documents -v`

Expected: both FAIL — `store_course_document` still returns a 2-tuple and always calls `replace_document_chunks`, so `status` is never `"extracted"` and `store_extracted`/`replace_chunks` assertions fail.

- [ ] **Step 3: Implement the branch**

In `services/parser-service/src/lb_studio_parser/documents.py:13-19`, change the imports:

```python
from .retrieval import build_text_splitter, delete_document_chunks, replace_document_chunks
from .settings import (
    ALLOWED_EXTENSIONS,
    MAX_UPLOAD_BYTES,
    UPLOAD_CHUNK_BYTES,
    validate_course_id,
)
```

to:

```python
from .extraction_store import delete_extracted_chunks, store_extracted_chunks
from .retrieval import build_text_splitter, delete_document_chunks, replace_document_chunks
from .settings import (
    ALLOWED_EXTENSIONS,
    EMBEDDINGS_ENABLED,
    MAX_UPLOAD_BYTES,
    UPLOAD_CHUNK_BYTES,
    validate_course_id,
)
```

Then change `store_course_document`'s signature and body
(`documents.py:90-144`). Replace:

```python
def store_course_document(
    course_id: str,
    source_id: str,
    sha256: str,
    filename: str,
    file_obj: BinaryIO,
) -> tuple[str, int]:
    """Validate, stage, parse, and index one course document."""
```

with:

```python
def store_course_document(
    course_id: str,
    source_id: str,
    sha256: str,
    filename: str,
    file_obj: BinaryIO,
) -> tuple[str, int, str]:
    """Validate, stage, parse, and index (or locally extract) one course document."""
```

And replace:

```python
    temp_dir: str | None = None
    try:
        temp_dir, temp_file_path = stream_upload_to_disk(file_obj, extension)
        chunks = build_text_splitter().split_text(extract_document_text(temp_file_path))
        return original_filename, replace_document_chunks(
            course_id,
            source_id,
            sha256,
            original_filename,
            chunks,
        )
    except ValueError as error:
```

with:

```python
    temp_dir: str | None = None
    try:
        temp_dir, temp_file_path = stream_upload_to_disk(file_obj, extension)
        chunks = build_text_splitter().split_text(extract_document_text(temp_file_path))
        if EMBEDDINGS_ENABLED:
            chunks_stored = replace_document_chunks(
                course_id, source_id, sha256, original_filename, chunks
            )
            return original_filename, chunks_stored, "indexed"
        chunks_stored = store_extracted_chunks(
            course_id, source_id, sha256, original_filename, chunks
        )
        return original_filename, chunks_stored, "extracted"
    except ValueError as error:
```

Then update `remove_course_document` (`documents.py:146-161`) to clean up
whichever storage backend a source actually used. Replace:

```python
def remove_course_document(course_id: str, source_id: str) -> str:
    """Remove one document's chunks and return the public deletion status."""
    logger.info("Source delete request: course=%s source=%s", course_id, source_id)
    try:
        deleted = delete_document_chunks(course_id, source_id)
    except Exception as error:
        logger.warning(
            "Could not delete chunks for source %s in course %s",
            source_id,
            course_id,
            exc_info=True,
        )
        raise DocumentDeletionError("Failed to delete document chunks.") from error
    if deleted:
        logger.info("Deleted chunks for source %s in course %s", source_id, course_id)
    return "deleted" if deleted else "not_found"
```

with:

```python
def remove_course_document(course_id: str, source_id: str) -> str:
    """Remove one document's chunks and return the public deletion status."""
    logger.info("Source delete request: course=%s source=%s", course_id, source_id)
    try:
        deleted_indexed = delete_document_chunks(course_id, source_id)
        deleted_extracted = delete_extracted_chunks(course_id, source_id)
    except Exception as error:
        logger.warning(
            "Could not delete chunks for source %s in course %s",
            source_id,
            course_id,
            exc_info=True,
        )
        raise DocumentDeletionError("Failed to delete document chunks.") from error
    deleted = deleted_indexed or deleted_extracted
    if deleted:
        logger.info("Deleted chunks for source %s in course %s", source_id, course_id)
    return "deleted" if deleted else "not_found"
```

- [ ] **Step 4: Run to verify the new tests pass**

Run: `python -m unittest tests.test_documents -v`

Expected: both PASS.

- [ ] **Step 5: Update `main.py`'s upload route**

In `services/parser-service/src/lb_studio_parser/main.py:81-108`, replace:

```python
def upload_file(  # noqa: B008
    course_id: str = Form(...),
    source_id: str = Form(..., min_length=1, max_length=100),
    sha256: str = Form(..., pattern=r"^[0-9a-f]{64}$"),
    file: UploadFile = File(...),  # noqa: B008
) -> UploadResponse:
    try:
        filename, chunks_stored = store_course_document(
            course_id,
            source_id,
            sha256,
            file.filename or "",
            file.file,
        )
        return UploadResponse(
            status="success",
            source_id=source_id,
            filename=filename,
            chunks_stored=chunks_stored,
        )
```

with:

```python
def upload_file(  # noqa: B008
    course_id: str = Form(...),
    source_id: str = Form(..., min_length=1, max_length=100),
    sha256: str = Form(..., pattern=r"^[0-9a-f]{64}$"),
    file: UploadFile = File(...),  # noqa: B008
) -> UploadResponse:
    try:
        filename, chunks_stored, status = store_course_document(
            course_id,
            source_id,
            sha256,
            file.filename or "",
            file.file,
        )
        return UploadResponse(
            status=status,
            source_id=source_id,
            filename=filename,
            chunks_stored=chunks_stored,
        )
```

(The `except` clauses below are unchanged — extraction/validation failures
still raise the same error classes regardless of `EMBEDDINGS_ENABLED`.)

- [ ] **Step 6: Update `main.py`'s health check**

In `services/parser-service/src/lb_studio_parser/main.py`, add `EMBEDDINGS_ENABLED` to the import from `.settings` (`main.py:30`):

```python
from .settings import CHROMA_DIR, OPENAI_API_KEY, OPENAI_CHAT_MODEL, OPENAI_EMBEDDING_MODEL
```

becomes:

```python
from .settings import (
    CHROMA_DIR,
    EMBEDDINGS_ENABLED,
    OPENAI_API_KEY,
    OPENAI_CHAT_MODEL,
    OPENAI_EMBEDDING_MODEL,
)
```

Then replace `health_check()` (`main.py:149-168`):

```python
@app.get("/health", tags=["ops"])
def health_check() -> dict[str, str | bool]:
    openai_configured = bool(OPENAI_API_KEY)
    try:
        os.makedirs(CHROMA_DIR, exist_ok=True)
        probe = os.path.join(CHROMA_DIR, f".probe-{secrets.token_hex(16)}")
        with open(probe, "w") as handle:
            handle.write("ok")
        os.remove(probe)
        chroma_writable = True
    except OSError:
        chroma_writable = False
    return {
        "status": "ok" if openai_configured and chroma_writable else "degraded",
        "service": "lb-studio-parser",
        "openai_configured": openai_configured,
        "chroma_dir_writable": chroma_writable,
        "llm_model": OPENAI_CHAT_MODEL,
        "embedding_model": OPENAI_EMBEDDING_MODEL,
    }
```

with:

```python
@app.get("/health", tags=["ops"])
def health_check() -> dict[str, str | bool]:
    openai_configured = bool(OPENAI_API_KEY)
    try:
        os.makedirs(CHROMA_DIR, exist_ok=True)
        probe = os.path.join(CHROMA_DIR, f".probe-{secrets.token_hex(16)}")
        with open(probe, "w") as handle:
            handle.write("ok")
        os.remove(probe)
        chroma_writable = True
    except OSError:
        chroma_writable = False
    ready = chroma_writable and (openai_configured if EMBEDDINGS_ENABLED else True)
    return {
        "status": "ok" if ready else "degraded",
        "service": "lb-studio-parser",
        "embeddings_enabled": EMBEDDINGS_ENABLED,
        "openai_configured": openai_configured,
        "chroma_dir_writable": chroma_writable,
        "llm_model": OPENAI_CHAT_MODEL,
        "embedding_model": OPENAI_EMBEDDING_MODEL,
    }
```

- [ ] **Step 7: Verify lint/types**

Run: `ruff check .` and `mypy src`

Expected: both exit 0.

- [ ] **Step 8: Commit**

```bash
git add services/parser-service/src/lb_studio_parser/documents.py services/parser-service/src/lb_studio_parser/main.py services/parser-service/tests/test_documents.py
git commit -m "feat: branch document upload on EMBEDDINGS_ENABLED and surface status"
```

---

## Task 8: Update `parser-client`'s response types

**Files:**
- Modify: `packages/parser-client/src/index.ts:89-94,101-106`

**Interfaces:**
- Consumes: Task 7's `UploadResponse.status` values (`"indexed" | "extracted"`).
- Produces: `RagUploadResponse.status: 'indexed' | 'extracted'`.

- [ ] **Step 1: Narrow the Zod schema**

In `packages/parser-client/src/index.ts:89-94`, change:

```ts
const ParserUploadResponseSchema = z.object({
  status: z.string(),
  source_id: z.string(),
  filename: z.string(),
  chunks_stored: z.number().int().min(0),
});
```

to:

```ts
const ParserUploadResponseSchema = z.object({
  status: z.enum(['indexed', 'extracted']),
  source_id: z.string(),
  filename: z.string(),
  chunks_stored: z.number().int().min(0),
});
```

- [ ] **Step 2: Narrow the TS interface**

In `packages/parser-client/src/index.ts:101-106`, change:

```ts
export interface RagUploadResponse {
  status: string;
  sourceId: string;
  filename: string;
  chunksStored: number;
}
```

to:

```ts
export interface RagUploadResponse {
  status: 'indexed' | 'extracted';
  sourceId: string;
  filename: string;
  chunksStored: number;
}
```

`uploadCourseDocument`'s body (`packages/parser-client/src/index.ts:197-202`) already does `status: parsed.data.status` — no change needed there, it now just carries the narrower type through.

- [ ] **Step 3: Verify**

Run: `npm run typecheck` and `npm run lint`

Expected: both exit 0.

- [ ] **Step 4: Commit**

```bash
git add packages/parser-client/src/index.ts
git commit -m "feat: type parser-client upload status as indexed|extracted"
```

---

## Task 9: Branch the job-worker on upload status

**Files:**
- Modify: `apps/job-worker/src/handlers.ts:16-28,84-96`

**Interfaces:**
- Consumes: Task 2's `markSourceExtracted`, Task 8's `RagUploadResponse.status`, Task 1's `DocumentIndexResultSchema.status`.

- [ ] **Step 1: Import `markSourceExtracted`**

In `apps/job-worker/src/handlers.ts:16-28`, change:

```ts
import {
  getCourseGeneration,
  getCourseSource,
  findCourseCreatedByJob,
  markCourseGenerationFailed,
  markCourseGenerationRunning,
  markSourceFailed,
  markSourceIndexed,
  persistGeneratedCourse,
  persistDuplicatedCourse,
  prisma,
  replaceCourseAssistantQaDrafts,
} from '@lb-studio/database';
```

to:

```ts
import {
  getCourseGeneration,
  getCourseSource,
  findCourseCreatedByJob,
  markCourseGenerationFailed,
  markCourseGenerationRunning,
  markSourceExtracted,
  markSourceFailed,
  markSourceIndexed,
  persistGeneratedCourse,
  persistDuplicatedCourse,
  prisma,
  replaceCourseAssistantQaDrafts,
} from '@lb-studio/database';
```

- [ ] **Step 2: Branch on `result.status`**

In `apps/job-worker/src/handlers.ts:84-96` (inside `indexDocument`), change:

```ts
  const file = new File([new Uint8Array(job.artifact.bytes)], job.artifact.filename, {
    type: job.artifact.contentType ?? 'application/octet-stream',
  });
  try {
    const result = await uploadCourseDocument(courseId, sourceId, sha256, file);
    if (result.sourceId !== sourceId || result.filename !== filename) {
      throw new NonRetryableJobError(
        'The indexing service returned a mismatched source. Upload it again to retry.',
      );
    }
    await markSourceIndexed(courseId, sourceId, result.chunksStored);
    return { filename: result.filename, chunksStored: result.chunksStored };
  } catch (error: unknown) {
```

to:

```ts
  const file = new File([new Uint8Array(job.artifact.bytes)], job.artifact.filename, {
    type: job.artifact.contentType ?? 'application/octet-stream',
  });
  try {
    const result = await uploadCourseDocument(courseId, sourceId, sha256, file);
    if (result.sourceId !== sourceId || result.filename !== filename) {
      throw new NonRetryableJobError(
        'The indexing service returned a mismatched source. Upload it again to retry.',
      );
    }
    if (result.status === 'extracted') {
      await markSourceExtracted(courseId, sourceId, result.chunksStored);
    } else {
      await markSourceIndexed(courseId, sourceId, result.chunksStored);
    }
    return { filename: result.filename, chunksStored: result.chunksStored, status: result.status };
  } catch (error: unknown) {
```

Also update `indexDocument`'s declared return type at its top
(`apps/job-worker/src/handlers.ts:52`) from:

```ts
async function indexDocument(job: ClaimedJob): Promise<{ filename: string; chunksStored: number }> {
```

to:

```ts
async function indexDocument(
  job: ClaimedJob,
): Promise<{ filename: string; chunksStored: number; status: 'indexed' | 'extracted' }> {
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck` and `npm run lint`

Expected: both exit 0.

- [ ] **Step 4: Commit**

```bash
git add apps/job-worker/src/handlers.ts
git commit -m "feat: mark sources EXTRACTED when the parser skipped embeddings"
```

---

## Task 10: Show the `extracted` state in the Source panel

**Files:**
- Modify: `apps/web/src/authoring/SourcePanel.tsx:25-32`

**Interfaces:**
- Consumes: Task 1's `CourseSourceIndexStatus` including `'extracted'`.

- [ ] **Step 1: Add the `extracted` branch**

In `apps/web/src/authoring/SourcePanel.tsx:25-32`, change:

```ts
function statusLabel(source: CourseSourceFile): string {
  if (source.indexStatus === 'indexed') {
    return `${source.chunksStored ?? 0} indexed chunk${source.chunksStored === 1 ? '' : 's'}`;
  }
  if (source.indexStatus === 'pending') return 'Indexing queued';
  if (source.indexStatus === 'deleting') return 'Cleanup needs completion';
  return 'Indexing failed';
}
```

to:

```ts
function statusLabel(source: CourseSourceFile): string {
  if (source.indexStatus === 'indexed') {
    return `${source.chunksStored ?? 0} indexed chunk${source.chunksStored === 1 ? '' : 's'} · AI drafting ready`;
  }
  if (source.indexStatus === 'extracted') {
    const count = source.chunksStored ?? 0;
    return `${count} extracted chunk${count === 1 ? '' : 's'} · ready to freeze, not searchable by AI drafting`;
  }
  if (source.indexStatus === 'pending') return 'Indexing queued';
  if (source.indexStatus === 'deleting') return 'Cleanup needs completion';
  return 'Indexing failed';
}
```

- [ ] **Step 2: Verify**

Run: `npm run typecheck` and `npm run lint`

Expected: both exit 0. Visual confirmation happens in Task 13's end-to-end run (`npm run dev`, upload a source, watch it reach "extracted").

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/authoring/SourcePanel.tsx
git commit -m "feat: show extracted-chunk status in the Source panel"
```

---

## Task 11: Add the `/create-course` slash command

**Files:**
- Create: `.claude/commands/create-course.md`

**Interfaces:**
- Consumes: nothing from earlier tasks (pure Claude Code configuration, no app code).

- [ ] **Step 1: Create the command file**

Create `.claude/commands/create-course.md`:

```markdown
---
description: Build a course in Course Studio from a folder of local source/media files, using the course-studio-content-engineer agent.
argument-hint: <folder-path> [brief]
---

## Task

Dispatch the `course-studio-content-engineer` subagent to build a course
end-to-end from a local folder of files.

Arguments: `$ARGUMENTS`

The first argument is a folder path on this machine. Everything after it
(if present) is the author brief — audience, learning goals, tone. If no
brief is given, ask the user for one before dispatching (per the agent's
own "confirm scope with the user before building" rule) rather than
inventing one.

Dispatch the `course-studio-content-engineer` subagent (not
`general-purpose`) with a task that includes:

- The folder path, with instructions to inventory it per the agent's
  "Authoring operating procedure" step 1 — classify each file as an
  AI/citation source (PDF/PPTX/DOCX/XLSX, ≤50MB), lesson media
  (images/video), or irrelevant.
- The author brief.
- A reminder that AI drafting is expected to be unavailable right now (no
  embedding budget — sources will reach `EXTRACTED`, not `INDEXED`) and
  hand-authoring from the extracted source text is the normal path, not a
  fallback.
```

- [ ] **Step 2: Verify**

Run `/create-course` (no arguments) in this Claude Code session and confirm
it appears in the command list and asks for a folder path rather than
erroring.

- [ ] **Step 3: Commit**

```bash
git add .claude/commands/create-course.md
git commit -m "feat: add /create-course slash command"
```

---

## Task 12: Update the `course-studio-content-engineer` agent's instructions

**Files:**
- Modify: `.claude/agents/course-studio-content-engineer.md`

**Interfaces:**
- Consumes: Task 7's `embeddings_enabled` health-check field name, Task 3's freeze-gate behavior — referenced only in prose, no code interface.

- [ ] **Step 1: Rewrite rule #2 (AI-drafting-unavailable is now the default)**

Find:

```
2. **AI only assists; a human (or you, standing in for the author) must
   review before anything is treated as final.** Nothing goes into a
   frozen revision without an editorial pass. If AI drafting is unavailable
   (e.g. no valid `OPENAI_API_KEY`), you may hand-author copy directly from
   source material as a substitute, but you must flag that substitution and
   still do a self-review pass rather than treating first-draft prose as
   final.
```

Replace with:

```
2. **AI only assists; a human (or you, standing in for the author) must
   review before anything is treated as final.** Nothing goes into a
   frozen revision without an editorial pass. **AI drafting is expected to
   be unavailable right now** — this project runs with
   `EMBEDDINGS_ENABLED=false` (no embedding budget), so sources reach
   `EXTRACTED`, not `INDEXED`, and `generate-assistant-qa`/
   `generate-course` stay unavailable by design, not by accident.
   Hand-authoring directly from source material is the normal path, not a
   fallback — still flag every place you did it in your final report, and
   still do a full self-review pass rather than treating first-draft prose
   as final.
```

- [ ] **Step 2: Update the parser-service environment-checklist bullet**

Find:

```
- Parser service: `cd services/parser-service && source venv/bin/activate &&
  python -m lb_studio_parser` (create the venv per `CLAUDE.md` if it
  doesn't exist yet). Confirm `/health` returns `openai_configured: true` —
  but treat that flag as "a value is present," not "the value is valid."
  A short/placeholder `OPENAI_API_KEY` will pass this check and still fail
  every real embedding call with a 401 the first time a source is indexed.
  If indexing fails, verify key length/shape directly (never print the
  actual key) before concluding it's a real-key problem vs. a service
  problem.
```

Replace with:

```
- Parser service: `cd services/parser-service && source venv/bin/activate &&
  python -m lb_studio_parser` (create the venv per `CLAUDE.md` if it
  doesn't exist yet), or `npm run dev` from repo root (boots it alongside
  the web app). Confirm `/health` returns `embeddings_enabled: false` —
  that's the expected, intended state right now (no embedding budget), not
  a bug to fix. Sources will reach `EXTRACTED`, not `INDEXED`; freezing
  still works (the readiness gate accepts either status), but
  `generate-assistant-qa`/`generate-course` stay unavailable by design. If
  `/health` instead shows `embeddings_enabled: true`, don't disable it
  yourself — that's a deliberate operator choice, flag it and ask before
  assuming it's a mistake.
```

- [ ] **Step 3: Extend operating-procedure step 1 for folder-path mode**

Find:

```
1. **Inventory the source dump.** For every file: format, size, whether it
   fits the Source panel limit as-is, whether it's an AI source or lesson
   media (images/video/renders belong to lessons directly). Note internal
   codenames vs. public product names up front.
```

Replace with:

```
1. **Inventory the source dump.** Whether given a folder path directly
   (e.g. via `/create-course <folder-path>`) or a manually-described set
   of files, walk every file in scope and classify it: format, size,
   whether it fits the Source panel limit as-is, and whether it's an AI
   source (PDF/PPTX/DOCX/XLSX → Source panel) or lesson media
   (images/video/renders → attached directly to lessons, never the Source
   panel) or irrelevant to this course. Note internal codenames vs. public
   product names up front.
```

- [ ] **Step 4: Note freeze-gate awareness in rule #6**

Find:

```
6. **Readiness gates are the spec, not an obstacle.** Freeze/review-link
   creation/SCORM export are blocked until sources finish indexing, all
   required media is attached, assessments are valid, and template
   placeholders are resolved. There is no separate "check readiness"
   button — the blocking action itself is the check. Don't look for a way
   around a gate; resolve the underlying issue.
```

Replace with:

```
6. **Readiness gates are the spec, not an obstacle.** Freeze/review-link
   creation/SCORM export are blocked until sources finish indexing (either
   `EXTRACTED` or `INDEXED` — both satisfy this gate; only AI drafting
   requires the stronger `INDEXED` state), all required media is attached,
   assessments are valid, and template placeholders are resolved. There is
   no separate "check readiness" button — the blocking action itself is
   the check. Don't look for a way around a gate; resolve the underlying
   issue.
```

- [ ] **Step 5: Commit**

```bash
git add .claude/agents/course-studio-content-engineer.md
git commit -m "docs: update course-studio-content-engineer for free local extraction"
```

---

## Task 13: End-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Fresh-boot check (no OpenAI key at all)**

Temporarily rename `services/parser-service/.env` aside, start the service
with `EMBEDDINGS_ENABLED` and `OPENAI_API_KEY` both unset:

```bash
cd services/parser-service
mv .env .env.bak
EMBEDDINGS_ENABLED= OPENAI_API_KEY= venv/bin/python -m lb_studio_parser &
sleep 2
curl -s http://127.0.0.1:8000/health
mv .env.bak .env
```

Expected: `/health` returns HTTP 200 with `"status": "ok"`,
`"embeddings_enabled": false`, `"openai_configured": false` — the process
does **not** crash on startup. Stop the background process afterward.

- [ ] **Step 2: Boot the real stack**

```bash
npm run dev        # web + parser service
npm run jobs:worker
```

Confirm (`brew services list | grep postgresql`) Postgres is running first.

- [ ] **Step 3: Upload a source and watch it reach `EXTRACTED`**

In the browser, log into Course Studio, open (or create) a course, and
upload one small PDF/DOCX/PPTX/XLSX file via the Source panel.

Expected: the source reaches "N extracted chunks · ready to freeze, not
searchable by AI drafting" (Task 10's copy) within a few seconds — not
"Indexing failed."

- [ ] **Step 4: Confirm the freeze gate accepts it**

With at least one `EXTRACTED` source and a readiness-complete course graph
(the readiness validation from `packages/database/src/course-review-repository.ts`
unrelated to this plan — use an existing template course to satisfy it
quickly), freeze a revision from the Studio UI.

Expected: freeze succeeds — no `COURSE_SOURCES_NOT_INDEXED` error.

- [ ] **Step 5: Confirm SCORM export works from that revision**

Trigger a SCORM export for the frozen revision from the Studio UI.

Expected: export job succeeds and produces a downloadable `.zip`.

- [ ] **Step 6: Dry-run `/create-course`**

Assemble a small local folder (a couple of small PDF/DOCX files and one
image) and run `/create-course <folder-path> "Audience: new hires. Goal:
product overview."` in this Claude Code session.

Expected: the `course-studio-content-engineer` subagent inventories the
folder, uploads the eligible files through the real Source panel (browser
file-upload, not a curl shortcut), watches them reach `EXTRACTED`,
hand-authors the course content, resolves readiness gates, freezes a
revision, and reports what it built — including flagging every place it
hand-authored instead of using AI drafting.

- [ ] **Step 7: Full check suite**

```bash
npm run typecheck
npm run lint
cd services/parser-service && source venv/bin/activate && ruff check . && mypy src && python -m unittest discover -s tests
```

Expected: everything exits 0 / all tests pass.

No commit for this task — it's verification of Tasks 1-12's already-committed work.
