"""Lionbridge Course Studio Parser Service HTTP application and executable entrypoint."""

import logging
import os
import secrets
from typing import cast

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile

from .contracts import (
    AssistantQaRequest,
    AssistantQaResponse,
    CourseGenerationRequest,
    CourseGenerationResponse,
    DeleteDocumentRequest,
    QuizRequest,
    QuizResponse,
    UploadResponse,
)
from .documents import (
    DocumentDeletionError,
    DocumentExtractionError,
    DocumentProcessingError,
    InvalidCourseIdError,
    InvalidUploadError,
    UploadTooLargeError,
    remove_course_document,
    store_course_document,
)
from .generation import generate_course
from .rag import generate_assistant_qa, generate_quiz
from .runtime import lifespan, runtime
from .settings import CHROMA_DIR, OPENAI_API_KEY, OPENAI_CHAT_MODEL, OPENAI_EMBEDDING_MODEL

logger = logging.getLogger(__name__)
app = FastAPI(
    title="Lionbridge Course Studio Parser Service",
    description=(
        "Internal development service that indexes immutable Course Studio sources and "
        "retrieves only the source IDs attached to a frozen revision using OpenAI."
    ),
    version="1.2.0",
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
    "/api/generate-assistant-qa",
    response_model=AssistantQaResponse,
    dependencies=[Depends(require_internal_token)],
    tags=["authoring"],
)
def generate_assistant_qa_route(request: AssistantQaRequest) -> AssistantQaResponse:
    try:
        return AssistantQaResponse(
            drafts=generate_assistant_qa(request.course_id, request.source_ids)
        )
    except LookupError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except Exception as error:
        logger.exception("Error generating assistant Q&A for course %s", request.course_id)
        raise HTTPException(
            status_code=500, detail="Internal server error generating assistant Q&A."
        ) from error


@app.post(
    "/api/upload",
    response_model=UploadResponse,
    dependencies=[Depends(require_internal_token)],
    tags=["documents"],
)
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
    except InvalidCourseIdError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except UploadTooLargeError as error:
        raise HTTPException(status_code=413, detail=str(error)) from error
    except (InvalidUploadError, DocumentExtractionError) as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except DocumentProcessingError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error


@app.post(
    "/api/generate-quiz",
    response_model=QuizResponse,
    dependencies=[Depends(require_internal_token)],
    tags=["quiz"],
)
def generate_quiz_route(request: QuizRequest) -> QuizResponse:
    try:
        return cast(
            QuizResponse,
            QuizResponse.model_validate(
                {
                    "questions": generate_quiz(
                        request.course_id,
                        request.source_ids,
                        request.weak_topics,
                    )
                }
            ),
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


@app.post(
    "/api/generate-course",
    response_model=CourseGenerationResponse,
    dependencies=[Depends(require_internal_token)],
    tags=["generation"],
)
def generate_course_route(request: CourseGenerationRequest) -> CourseGenerationResponse:
    try:
        return generate_course(
            request.course_id,
            request.source_ids,
            request.brief,
            request.prompt_template_version,
        )
    except LookupError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error
    except Exception as error:
        logger.exception("Error generating course for source course %s", request.course_id)
        raise HTTPException(
            status_code=500, detail="Internal server error generating course."
        ) from error


@app.delete("/api/document", dependencies=[Depends(require_internal_token)], tags=["documents"])
def delete_document(request: DeleteDocumentRequest) -> dict[str, str]:
    try:
        return {
            "status": remove_course_document(request.course_id, request.source_id),
            "source_id": request.source_id,
        }
    except DocumentDeletionError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error


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


def run() -> None:
    """Run the local development server with reload enabled."""
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

    uvicorn.run("lb_studio_parser.main:app", host="127.0.0.1", port=_port, reload=True)


if __name__ == "__main__":
    run()
