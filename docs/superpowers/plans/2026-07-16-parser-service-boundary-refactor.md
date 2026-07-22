# Parser-Service Boundary Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate parser-service HTTP, document processing, Chroma storage, and LLM concerns without changing its public API contracts.

**Architecture:** `main.py` remains an HTTP adapter. New contracts and document-text modules isolate Pydantic schemas and MarkItDown extraction; `vectorstore.py` owns every Chroma mutation and cache invalidation; use-case modules compose these focused interfaces.

**Tech Stack:** Python 3.11, FastAPI 0.136, Pydantic 2, MarkItDown, LangChain Chroma/Ollama.

## Global Constraints

- Preserve `/api/upload`, `/api/document`, `/api/chat`, `/api/generate-quiz`, status mappings, and wire shapes.
- Preserve `store_course_document()`, `remove_course_document()`, `answer_question()`, and `generate_quiz()` call signatures.
- Do not add Pytest, Vitest, or another test runner.
- Use `./venv/bin/python` and `./venv/bin/ruff` for parser-service verification.

---

### Task 1: Extract API and quiz contracts

**Files:**
- Create: `parser-service/contracts.py`
- Modify: `parser-service/main.py`
- Modify: `parser-service/quiz_generation.py`

**Interfaces:**
- Produces `UploadResponse`, `ChatRequest`, `ChatResponse`, `QuizRequest`, `QuizQuestion`, `QuizResponse`, `DeleteDocumentRequest`, `QuizQuestionPayload`, and `QuizPayload`.

- [ ] Move the Pydantic route schemas from `main.py` to `contracts.py` and retain the existing validators and response fields.
- [ ] Move quiz output validation models to module scope in `quiz_generation.py`.
- [ ] Run `./venv/bin/python -m compileall -f contracts.py main.py quiz_generation.py`.

### Task 2: Separate document extraction from vector storage

**Files:**
- Create: `parser-service/document_text.py`
- Modify: `parser-service/documents.py`
- Modify: `parser-service/vectorstore.py`
- Modify: `parser-service/service_operations.py`

**Interfaces:**
- Produces `extract_document_text(path) -> str`, `replace_document_chunks(course_id, filename, chunks) -> int`, and `delete_document_chunks(course_id, filename) -> bool`.

- [ ] Keep upload validation and temporary-file streaming in `documents.py`.
- [ ] Move MarkItDown extraction to `document_text.py`, preserving the empty-text error message.
- [ ] Move all direct Chroma collection deletion/addition and cache invalidation into public `vectorstore.py` functions.
- [ ] Compose validation, staging, extraction, and indexing in `store_course_document()` without changing its public return value or exceptions.

### Task 3: Simplify retrieval and runtime boundaries

**Files:**
- Modify: `parser-service/runtime.py`
- Modify: `parser-service/vectorstore.py`
- Modify: `parser-service/rag_chat.py`
- Modify: `parser-service/quiz_generation.py`

**Interfaces:**
- Produces `invalidate_vectorstore(course_id) -> None` and `retrieve_course_documents(course_id, query, k) -> list[Document]`.

- [ ] Keep the runtime lifespan as the sole initialization point for Ollama and Chroma.
- [ ] Remove direct cache access from document code.
- [ ] Use shared course retrieval in chat and quiz generation while keeping their prompt text and public fallback/error behavior unchanged.

### Task 4: Verify and document the module boundaries

**Files:**
- Modify: `parser-service/README.md`

- [ ] Document the new module ownership and worker-compatible API behavior.
- [ ] Run `./venv/bin/ruff check main.py contracts.py runtime.py vectorstore.py documents.py document_text.py service_operations.py rag_chat.py quiz_generation.py settings.py`.
- [ ] Run `./venv/bin/python -m compileall -f` over the same module list.
- [ ] Run `./venv/bin/mypy main.py contracts.py runtime.py vectorstore.py documents.py document_text.py service_operations.py rag_chat.py quiz_generation.py settings.py` and report any third-party-stub limitations separately.
