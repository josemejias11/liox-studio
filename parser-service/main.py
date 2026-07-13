"""Moto AI Parser Service.

Internal RAG microservice (server-to-server only; called by the Next.js
backend, never by the browser). Parses course documents, stores embeddings
in ChromaDB, and answers questions / generates quizzes via a local Ollama LLM.

All endpoints except GET /health require the X-Internal-Token header to match
the PARSER_SERVICE_TOKEN environment variable.
"""

import logging
import os
import secrets

import httpx
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from pydantic import BaseModel, Field, field_validator

from documents import _validate_course_id
from quiz_generation import generate_quiz
from rag_chat import answer_question
from runtime import lifespan, runtime
from service_operations import (
    DocumentDeletionError,
    DocumentExtractionError,
    DocumentProcessingError,
    InvalidCourseIdError,
    InvalidUploadError,
    UploadTooLargeError,
    remove_course_document,
    store_course_document,
)
from settings import (
    CHROMA_DIR,
    EMBEDDING_MODEL,
    LLM_MODEL,
    OLLAMA_BASE_URL,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

_is_production = os.environ.get("ENV") == "production"
app = FastAPI(
    title="Moto AI Parser Service",
    description="Internal microservice to parse course documents and chat using a local LLM",
    version="1.1.0",
    lifespan=lifespan,
    docs_url=None if _is_production else "/docs",
    redoc_url=None if _is_production else "/redoc",
)


# ---------------------------------------------------------------------------
# Auth dependency
# ---------------------------------------------------------------------------


def require_internal_token(
    x_internal_token: str | None = Header(default=None, alias="X-Internal-Token"),
) -> None:
    if not x_internal_token or not secrets.compare_digest(
        x_internal_token.encode("utf-8"), runtime.token.encode("utf-8")
    ):
        raise HTTPException(status_code=401, detail="Invalid or missing X-Internal-Token.")


# ---------------------------------------------------------------------------
# Request / response models (the cross-service contract)
# ---------------------------------------------------------------------------


class UploadResponse(BaseModel):
    status: str
    filename: str
    chunks_stored: int


class ChatRequest(BaseModel):
    course_id: str
    query: str = Field(max_length=2000)

    @field_validator("course_id")
    @classmethod
    def validate_course_id(cls, v: str) -> str:
        return _validate_course_id(v)


class ChatResponse(BaseModel):
    answer: str
    sources: list[str]


class QuizRequest(BaseModel):
    course_id: str
    weak_topics: list[str] = Field(min_length=1)

    @field_validator("course_id")
    @classmethod
    def validate_course_id(cls, v: str) -> str:
        return _validate_course_id(v)


class QuizQuestion(BaseModel):
    question: str
    options: list[str] = Field(min_length=4, max_length=4)
    correct_answer_index: int = Field(ge=0, le=3)  # type: ignore[arg-type]


class QuizResponse(BaseModel):
    questions: list[QuizQuestion] = Field(min_length=5, max_length=5)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.post(
    "/api/upload",
    response_model=UploadResponse,
    dependencies=[Depends(require_internal_token)],
    tags=["documents"],
)
def upload_file(course_id: str = Form(...), file: UploadFile = File(...)):  # noqa: B008
    """Parse a course document and store its chunk embeddings in ChromaDB."""
    try:
        original_filename, chunks_stored = store_course_document(
            course_id,
            file.filename or "",
            file.file,  # type: ignore[arg-type]
        )
        return UploadResponse(
            status="success",
            filename=original_filename,
            chunks_stored=chunks_stored,
        )
    except InvalidCourseIdError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except UploadTooLargeError as error:
        raise HTTPException(status_code=413, detail=str(error)) from error
    except (InvalidUploadError, DocumentExtractionError) as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except DocumentProcessingError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error


@app.post(
    "/api/chat",
    response_model=ChatResponse,
    dependencies=[Depends(require_internal_token)],
    tags=["chat"],
)
def chat(request: ChatRequest):
    """Answer a question strictly from the course materials."""
    try:
        answer, sources = answer_question(request.course_id, request.query)
        return ChatResponse(answer=answer, sources=sources)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error during chat generation for course %s", request.course_id)
        raise HTTPException(status_code=500, detail="Internal server error generating response.") from e


@app.post(
    "/api/generate-quiz",
    response_model=QuizResponse,
    dependencies=[Depends(require_internal_token)],
    tags=["quiz"],
)
def generate_quiz_route(request: QuizRequest):
    """Generate a 5-question multiple-choice quiz targeting the weak topics."""
    try:
        questions = generate_quiz(request.course_id, request.weak_topics)
        return QuizResponse.model_validate({"questions": questions})
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error during quiz generation for course %s", request.course_id)
        raise HTTPException(status_code=500, detail="Internal server error generating quiz.") from e


class DeleteDocumentRequest(BaseModel):
    course_id: str
    filename: str

    @field_validator("course_id")
    @classmethod
    def validate_course_id(cls, v: str) -> str:
        return _validate_course_id(v)


@app.delete(
    "/api/document",
    dependencies=[Depends(require_internal_token)],
    tags=["documents"],
)
def delete_document(request: DeleteDocumentRequest):
    """Remove all ChromaDB chunks for a specific file within a course."""
    try:
        status = remove_course_document(request.course_id, request.filename)
        return {"status": status, "filename": request.filename}
    except DocumentDeletionError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error


@app.get("/health", tags=["ops"])
def health_check():
    """Readiness check: Ollama reachability and ChromaDB directory writability."""
    ollama_reachable = False
    try:
        resp = httpx.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=3.0)
        ollama_reachable = resp.status_code == 200
    except httpx.HTTPError:
        pass

    chroma_writable = False
    try:
        os.makedirs(CHROMA_DIR, exist_ok=True)
        probe_path = os.path.join(CHROMA_DIR, f".probe-{secrets.token_hex(16)}")
        with open(probe_path, "w") as probe:
            probe.write("ok")
        os.remove(probe_path)
        chroma_writable = True
    except OSError:
        pass

    ready = ollama_reachable and chroma_writable
    return {
        "status": "ok" if ready else "degraded",
        "service": "moto-ai-parser",
        "ollama_reachable": ollama_reachable,
        "chroma_dir_writable": chroma_writable,
        "llm_model": LLM_MODEL,
        "embedding_model": EMBEDDING_MODEL,
    }


if __name__ == "__main__":
    import uvicorn

    _port = int(os.environ.get("PARSER_PORT", "8000"))
    if _port < 1024:
        import sys
        print(
            f"ERROR: PARSER_PORT={_port} is a privileged port (< 1024). "
            "Set PARSER_PORT to 1024 or higher, or leave it unset to use the default 8000.",
            file=sys.stderr,
        )
        sys.exit(1)

    uvicorn.run("main:app", host="127.0.0.1", port=_port, reload=True)
