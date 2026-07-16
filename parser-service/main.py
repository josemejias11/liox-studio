"""Moto AI Parser Service HTTP application and executable entrypoint."""

import logging
import os
import secrets

import httpx
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile

from contracts import (
    ChatRequest,
    ChatResponse,
    DeleteDocumentRequest,
    QuizRequest,
    QuizResponse,
    UploadResponse,
)
from documents import (
    DocumentDeletionError,
    DocumentExtractionError,
    DocumentProcessingError,
    InvalidCourseIdError,
    InvalidUploadError,
    UploadTooLargeError,
    remove_course_document,
    store_course_document,
)
from rag import answer_question, generate_quiz, lifespan, runtime
from settings import CHROMA_DIR, EMBEDDING_MODEL, LLM_MODEL, OLLAMA_BASE_URL

logger = logging.getLogger(__name__)
app = FastAPI(
    title="Moto AI Parser Service",
    description="Internal microservice to parse course documents and chat using a local LLM",
    version="1.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)


def require_internal_token(
    x_internal_token: str | None = Header(default=None, alias="X-Internal-Token"),
) -> None:
    if not x_internal_token or not secrets.compare_digest(
        x_internal_token.encode(), runtime.token.encode()
    ):
        raise HTTPException(status_code=401, detail="Invalid or missing X-Internal-Token.")


@app.post(
    "/api/upload",
    response_model=UploadResponse,
    dependencies=[Depends(require_internal_token)],
    tags=["documents"],
)
def upload_file(course_id: str = Form(...), file: UploadFile = File(...)) -> UploadResponse:  # noqa: B008
    try:
        filename, chunks_stored = store_course_document(course_id, file.filename or "", file.file)
        return UploadResponse(status="success", filename=filename, chunks_stored=chunks_stored)
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
def chat(request: ChatRequest) -> ChatResponse:
    try:
        answer, sources = answer_question(request.course_id, request.query)
        return ChatResponse(answer=answer, sources=sources)
    except Exception as error:
        logger.exception("Error during chat generation for course %s", request.course_id)
        raise HTTPException(
            status_code=500, detail="Internal server error generating response."
        ) from error


@app.post(
    "/api/generate-quiz",
    response_model=QuizResponse,
    dependencies=[Depends(require_internal_token)],
    tags=["quiz"],
)
def generate_quiz_route(request: QuizRequest) -> QuizResponse:
    try:
        return QuizResponse.model_validate(
            {"questions": generate_quiz(request.course_id, request.weak_topics)}
        )
    except LookupError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error
    except Exception as error:
        logger.exception("Error during quiz generation for course %s", request.course_id)
        raise HTTPException(
            status_code=500, detail="Internal server error generating quiz."
        ) from error


@app.delete("/api/document", dependencies=[Depends(require_internal_token)], tags=["documents"])
def delete_document(request: DeleteDocumentRequest) -> dict[str, str]:
    try:
        return {
            "status": remove_course_document(request.course_id, request.filename),
            "filename": request.filename,
        }
    except DocumentDeletionError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error


@app.get("/health", tags=["ops"])
def health_check() -> dict[str, str | bool]:
    try:
        ollama_reachable = httpx.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=3.0).status_code == 200
    except httpx.HTTPError:
        ollama_reachable = False
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
        "status": "ok" if ollama_reachable and chroma_writable else "degraded",
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
