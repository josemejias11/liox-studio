# Parser Service Architecture

## Responsibility map

| Module | Responsibility |
| --- | --- |
| `main.py` | Executable entrypoint and backwards-compatible `app` export. |
| `contracts.py` | Pydantic request/response and quiz validation models. |
| `documents.py` | Course/file validation, staging, MarkItDown extraction, indexing, and deletion. |
| `rag.py` | Ollama/Chroma runtime, cache, retrieval, chat, and quiz generation. |

## Request flow

```text
Next.js API route or job worker
  -> X-Internal-Token
  -> FastAPI route adapter
  -> document / chat / quiz use case
  -> ChromaDB and local Ollama
  -> contract-shaped response
```

`/health` is the only unauthenticated endpoint. The Node background worker uses
the same upload and quiz-generation contracts as the synchronous application
paths, so their payloads and status mappings are service boundaries.

## Public API

| Method | Path | Request | Response |
| --- | --- | --- |
| `POST` | `/api/upload` | multipart `course_id`, `file` | `UploadResponse` |
| `POST` | `/api/chat` | `ChatRequest` | `ChatResponse` |
| `POST` | `/api/generate-quiz` | `QuizRequest` | `QuizResponse` |
| `DELETE` | `/api/document` | `DeleteDocumentRequest` | deletion status and filename |
| `GET` | `/health` | none | readiness details |

See [operations](operations.md) for startup and deployment behavior.
