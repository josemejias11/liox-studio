# Parser Service Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the parser service internally modular while preserving its private, authoring-only API behavior.

**Architecture:** Keep FastAPI routes in `main.py` and the TypeScript caller contract in `packages/parser-client`. Extract provider lifecycle and source-scoped Chroma retrieval from `rag.py`; document the supported authoring operations and leave the currently uncalled quiz endpoint stable.

**Tech Stack:** Python 3.11+, FastAPI, Pydantic, LangChain OpenAI, ChromaDB, MarkItDown, TypeScript, Zod.

**Spec:** `docs/superpowers/specs/2026-08-22-parser-service-refactor-design.md`

## Global Constraints

- Do not add test files or a test runner.
- Do not change HTTP routes, request/response fields, status mappings, prompts, or provider settings.
- Do not add a browser caller, learner-facing model call, local-model provider, or quiz workflow.
- Keep `packages/parser-client` as the only TypeScript integration boundary.
- Preserve the user's uncommitted `README.md` and `services/parser-service/README.md` policy edits.

---

### Task 1: Stabilize the documented and linted surface

**Files:**

- Modify: `services/parser-service/README.md`
- Modify: `services/parser-service/src/moto_parser/rag.py`

**Interfaces:**

- Consumes: Existing public FastAPI routes in `main.py`.
- Produces: Accurate parser-service operation guidance and a clean Ruff baseline.

- [ ] **Step 1: Replace dead parser-local documentation links**

Point the README to existing repository documentation only. Do not recreate the deleted `services/parser-service/docs/` tree.

- [ ] **Step 2: Remove the three unused settings imports from `rag.py`**

Remove `NO_CONTEXT_ANSWER`, `NO_MATERIALS_ANSWER`, and `RETRIEVAL_K_CHAT` from the settings import. No other behavior changes occur in this task.

- [ ] **Step 3: Verify the baseline**

Run: `services/parser-service/venv/bin/python -m ruff check services/parser-service/src services/parser-service/tests`

Run: `services/parser-service/venv/bin/python -m compileall -q services/parser-service/src`

Expected: zero Ruff findings and exit status 0.

### Task 2: Extract runtime and retrieval ownership

**Files:**

- Create: `services/parser-service/src/moto_parser/runtime.py`
- Create: `services/parser-service/src/moto_parser/retrieval.py`
- Modify: `services/parser-service/src/moto_parser/rag.py`
- Modify: `services/parser-service/src/moto_parser/documents.py`
- Modify: `services/parser-service/src/moto_parser/generation.py`
- Modify: `services/parser-service/src/moto_parser/main.py`

**Interfaces:**

- Consumes: `settings.py` configuration and existing Chroma metadata fields.
- Produces: `lifespan`, a runtime state object, retrieval operations, and unchanged existing use-case functions.

- [ ] **Step 1: Move runtime lifecycle ownership**

`runtime.py` owns the OpenAI embeddings/chat clients, Chroma persistent client, token initialization, and FastAPI lifespan. It exposes the same initialized state required by route authentication and use cases.

- [ ] **Step 2: Move source-scoped retrieval ownership**

`retrieval.py` owns Chroma collection existence checks, vectorstore caching, chunk IDs, text splitter construction, document replacement/deletion, revision-scoped similarity search, and context formatting. Retain metadata filters for both `course_id` and selected `source_id` values.

- [ ] **Step 3: Limit `rag.py` to authoring drafts**

Retain `generate_assistant_qa`, `generate_quiz`, and `response_text` there. Import the runtime and retrieval interfaces rather than owning caches or provider construction.

- [ ] **Step 4: Rewire document, generation, and HTTP adapters**

Change imports only: documents uses retrieval operations; generation uses retrieval and runtime; main uses runtime lifespan/token. Keep route functions and payload mapping identical.

- [ ] **Step 5: Verify structural compatibility**

Run Ruff, Mypy, Python compilation, `npm run typecheck`, and compare `main.py` routes with `packages/parser-client/src/index.ts`. Confirm no code/config references Ollama or a localhost model endpoint.

### Task 3: Reconcile cross-language contract ownership

**Files:**

- Modify: `packages/contracts/src/course-generation.ts`
- Modify: `services/parser-service/src/moto_parser/contracts.py`
- Modify: `packages/parser-client/src/index.ts`
- Modify: `services/parser-service/README.md`

**Interfaces:**

- Consumes: Existing course-generation JSON fields and the parser-client response validator.
- Produces: Explicit ownership and matched validation limits without changing payload shapes.

- [ ] **Step 1: Make the parser response contract explicit in documentation**

Document that Pydantic owns FastAPI validation and the parser-client independently validates untrusted HTTP responses. The two layers must retain matching field names and bounds.

- [ ] **Step 2: Compare every generated-course constraint**

Align only observed mismatches between the Pydantic and Zod course-generation graphs. Do not widen payloads or add fields.

- [ ] **Step 3: Verify contracts without a new test suite**

Run Python compilation, Ruff, Mypy, and root TypeScript typecheck. Manually inspect the Pydantic aliases and Zod field names before reporting the result.

### Task 4: Final integration review

**Files:**

- Modify: files changed by Tasks 1-3 only.

**Interfaces:**

- Consumes: the completed parser module boundaries and existing job-worker/parser-client calls.
- Produces: a behavior-preserving parser refactor ready for a scoped commit.

- [ ] **Step 1: Trace all callers**

Confirm indexing, Assistant Q&A, and course generation remain worker calls; source deletion is the only synchronous server call; quiz generation has no caller.

- [ ] **Step 2: Run fresh verification**

Run `git diff --check`, parser Ruff, parser Mypy, parser compilation, `npm run typecheck`, and `npm run lint`. Do not run the root formatter because it writes unrelated files.

- [ ] **Step 3: Review change scope**

Inspect `git diff --name-only` and ensure changes are limited to parser source, parser client/contracts only if constraints differed, and parser documentation. Preserve unrelated worktree files.
