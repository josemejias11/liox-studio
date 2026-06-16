"""Moto AI Parser Service.

Internal RAG microservice (server-to-server only; called by the Next.js
backend, never by the browser). Parses course documents, stores embeddings
in ChromaDB, and answers questions / generates quizzes via a local Ollama LLM.

All endpoints except GET /health require the X-Internal-Token header to match
the PARSER_SERVICE_TOKEN environment variable.
"""

import hashlib
import json
import logging
import os
import re
import secrets
import shutil
import tempfile
import uuid
from collections import OrderedDict
from contextlib import asynccontextmanager
from threading import Lock
from typing import Optional

import chromadb
import httpx
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from pydantic import BaseModel, Field, ValidationError, field_validator

from markitdown import MarkItDown
from langchain_chroma import Chroma
from langchain_ollama import OllamaEmbeddings, OllamaLLM
from langchain_text_splitters import RecursiveCharacterTextSplitter

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration (env vars with sane defaults; PARSER_SERVICE_TOKEN is required)
# ---------------------------------------------------------------------------

OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
CHROMA_DIR = os.environ.get("CHROMA_DIR", "./chroma_db")
LLM_MODEL = os.environ.get("LLM_MODEL", "llama3")
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "nomic-embed-text")
OLLAMA_TIMEOUT_SECONDS = float(os.environ.get("OLLAMA_TIMEOUT_SECONDS", "120"))

MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50MB hard cap, enforced while streaming
UPLOAD_CHUNK_BYTES = 1024 * 1024
ALLOWED_EXTENSIONS = {".pdf", ".pptx", ".docx", ".xlsx"}

# Must satisfy Chroma collection-name rules (3-63 chars, alnum at both ends).
COURSE_ID_PATTERN = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9._-]{1,61}[a-zA-Z0-9]$")

# Relevance cutoff for cosine-space collections (score in [0, 1], higher =
# more similar). Conservative: trims clearly off-topic hits without starving
# legitimate queries of context. With nomic-embed-text, on-topic queries
# measured ~0.55-0.70 and off-topic ~0.40-0.50; the strict prompt is the
# second line of defense for borderline hits.
RELEVANCE_THRESHOLD = float(os.environ.get("RELEVANCE_THRESHOLD", "0.45"))

RETRIEVAL_K_CHAT = int(os.environ.get("RETRIEVAL_K_CHAT", "5"))
RETRIEVAL_K_PER_TOPIC = 4
QUIZ_MAX_CONTEXT_DOCS = 12

# Document chunking, applied at upload time. Changing these only affects
# newly (re-)uploaded documents — existing chunks keep their original size.
# Tuned via the eval harness (see eval/).
CHUNK_SIZE = int(os.environ.get("CHUNK_SIZE", "1000"))
CHUNK_OVERLAP = int(os.environ.get("CHUNK_OVERLAP", "200"))

NO_MATERIALS_ANSWER = (
    "No materials have been uploaded for this course yet, "
    "so I cannot answer your question."
)
NO_CONTEXT_ANSWER = (
    "I do not have enough information to answer this question "
    "based on the course materials."
)

# ---------------------------------------------------------------------------
# Embeddings: nomic-embed-text requires task prefixes for best retrieval
# quality (search_document: for stored chunks, search_query: for queries).
# OllamaEmbeddings does not add them, so we do it here.
# ---------------------------------------------------------------------------


class TaskPrefixedOllamaEmbeddings(OllamaEmbeddings):
    """Adds nomic-style task prefixes when the model expects them."""

    def _wants_prefixes(self) -> bool:
        return self.model.startswith("nomic-embed")

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        if self._wants_prefixes():
            texts = [f"search_document: {t}" for t in texts]
        return super().embed_documents(texts)

    def embed_query(self, text: str) -> list[float]:
        if self._wants_prefixes():
            text = f"search_query: {text}"
        return super().embed_query(text)


# ---------------------------------------------------------------------------
# Runtime state (initialized in the lifespan handler; startup fails loudly
# if configuration or client construction is broken)
# ---------------------------------------------------------------------------


class _Runtime:
    token: str = ""
    embeddings: Optional[TaskPrefixedOllamaEmbeddings] = None
    llm: Optional[OllamaLLM] = None
    quiz_llm: Optional[OllamaLLM] = None
    chroma_client: Optional[chromadb.ClientAPI] = None


runtime = _Runtime()

_VECTORSTORE_CACHE_MAXSIZE = int(os.environ.get("VECTORSTORE_CACHE_SIZE", "50"))


class _LRUVectorstoreCache:
    """Thread-safe LRU cache for per-course Chroma vectorstore instances."""

    def __init__(self, maxsize: int = _VECTORSTORE_CACHE_MAXSIZE) -> None:
        self._cache: OrderedDict[str, Chroma] = OrderedDict()
        self._maxsize = maxsize
        self._lock = Lock()

    def get(self, key: str) -> Optional[Chroma]:
        with self._lock:
            if key not in self._cache:
                return None
            self._cache.move_to_end(key)
            return self._cache[key]

    def set(self, key: str, value: Chroma) -> None:
        with self._lock:
            if key in self._cache:
                self._cache.move_to_end(key)
            else:
                if len(self._cache) >= self._maxsize:
                    evicted = next(iter(self._cache))
                    del self._cache[evicted]
                    logger.debug("Evicted vectorstore cache entry: %s", evicted)
            self._cache[key] = value

    def pop(self, key: str) -> None:
        with self._lock:
            self._cache.pop(key, None)

    def clear(self) -> None:
        with self._lock:
            self._cache.clear()


_vectorstore_cache = _LRUVectorstoreCache()


@asynccontextmanager
async def lifespan(app: FastAPI):
    token = os.environ.get("PARSER_SERVICE_TOKEN")
    if not token:
        raise RuntimeError(
            "PARSER_SERVICE_TOKEN environment variable is not set. "
            "This service must not run without an internal auth token. "
            "Set PARSER_SERVICE_TOKEN to a strong shared secret and restart."
        )
    runtime.token = token

    try:
        runtime.embeddings = TaskPrefixedOllamaEmbeddings(
            model=EMBEDDING_MODEL,
            base_url=OLLAMA_BASE_URL,
            client_kwargs={"timeout": OLLAMA_TIMEOUT_SECONDS},
        )
        runtime.llm = OllamaLLM(
            model=LLM_MODEL,
            base_url=OLLAMA_BASE_URL,
            client_kwargs={"timeout": OLLAMA_TIMEOUT_SECONDS},
        )
        runtime.quiz_llm = OllamaLLM(
            model=LLM_MODEL,
            base_url=OLLAMA_BASE_URL,
            format="json",
            client_kwargs={"timeout": OLLAMA_TIMEOUT_SECONDS},
        )
        os.makedirs(CHROMA_DIR, exist_ok=True)
        runtime.chroma_client = chromadb.PersistentClient(path=CHROMA_DIR)
    except Exception:
        logger.exception(
            "Failed to initialize Ollama clients or ChromaDB at %s. "
            "Refusing to start.",
            CHROMA_DIR,
        )
        raise

    logger.info(
        "Parser service ready (ollama=%s, llm=%s, embeddings=%s, chroma=%s)",
        OLLAMA_BASE_URL,
        LLM_MODEL,
        EMBEDDING_MODEL,
        CHROMA_DIR,
    )
    yield


app = FastAPI(
    title="Moto AI Parser Service",
    description="Internal microservice to parse course documents and chat using a local LLM",
    version="1.1.0",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# Auth dependency
# ---------------------------------------------------------------------------


def require_internal_token(
    x_internal_token: Optional[str] = Header(default=None, alias="X-Internal-Token"),
) -> None:
    if not x_internal_token or not secrets.compare_digest(
        x_internal_token.encode("utf-8"), runtime.token.encode("utf-8")
    ):
        raise HTTPException(status_code=401, detail="Invalid or missing X-Internal-Token.")


# ---------------------------------------------------------------------------
# Request / response models (the cross-service contract)
# ---------------------------------------------------------------------------


def _validate_course_id(value: str) -> str:
    if not COURSE_ID_PATTERN.fullmatch(value):
        raise ValueError(
            "course_id must be 3-63 characters, alphanumeric at both ends, "
            "and contain only letters, digits, '.', '_' or '-'."
        )
    return value


class UploadResponse(BaseModel):
    status: str
    filename: str
    chunks_stored: int


class ChatRequest(BaseModel):
    course_id: str
    query: str = Field(max_length=2000)

    _check_course_id = field_validator("course_id")(_validate_course_id)


class ChatResponse(BaseModel):
    answer: str
    sources: list[str]


class QuizRequest(BaseModel):
    course_id: str
    weak_topics: list[str] = Field(min_length=1)

    _check_course_id = field_validator("course_id")(_validate_course_id)


class QuizQuestion(BaseModel):
    question: str
    options: list[str] = Field(min_length=4, max_length=4)
    correct_answer_index: int = Field(ge=0, le=3)


class QuizResponse(BaseModel):
    questions: list[QuizQuestion] = Field(min_length=5, max_length=5)


# ---------------------------------------------------------------------------
# Vector store helpers
# ---------------------------------------------------------------------------


def collection_exists(course_id: str) -> bool:
    try:
        runtime.chroma_client.get_collection(course_id)
        return True
    except Exception as e:
        # Swallow only "collection not found" errors; re-raise storage/config failures
        # so callers see a real 500 rather than a misleading "no documents" response.
        err_str = str(e).lower()
        if "does not exist" in err_str or "invalidcollection" in type(e).__name__.lower():
            return False
        logger.error("ChromaDB error checking collection %s: %s", course_id, e)
        raise


def get_vectorstore(course_id: str) -> Chroma:
    """LRU-cached per-course Chroma vectorstore (creates the collection if needed)."""
    vs = _vectorstore_cache.get(course_id)
    if vs is None:
        vs = Chroma(
            client=runtime.chroma_client,
            collection_name=course_id,
            embedding_function=runtime.embeddings,
            collection_metadata={"hnsw:space": "cosine"},
        )
        _vectorstore_cache.set(course_id, vs)
    return vs


def chunk_ids(course_id: str, filename: str, count: int) -> list[str]:
    """Deterministic IDs so re-uploading a file replaces its chunks."""
    return [
        hashlib.sha256(f"{course_id}|{filename}|{i}".encode("utf-8")).hexdigest()
        for i in range(count)
    ]


def retrieve_relevant(vs: Chroma, query: str, k: int) -> list:
    results = vs.similarity_search_with_relevance_scores(query, k=k)
    return [doc for doc, score in results if score >= RELEVANCE_THRESHOLD]


def format_context(docs: list) -> str:
    return "\n\n".join(
        f"--- Source: {doc.metadata.get('source', 'Unknown')} ---\n{doc.page_content}"
        for doc in docs
    )


def build_text_splitter() -> RecursiveCharacterTextSplitter:
    return RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        separators=["\n\n", "\n", " ", ""],
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.post(
    "/api/upload",
    response_model=UploadResponse,
    dependencies=[Depends(require_internal_token)],
)
def upload_file(course_id: str = Form(...), file: UploadFile = File(...)):
    """Parse a course document and store its chunk embeddings in ChromaDB.

    Re-uploading a file with the same name replaces its previous chunks.
    """
    try:
        _validate_course_id(course_id)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    original_filename = os.path.basename(file.filename or "")
    ext = os.path.splitext(original_filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Allowed types: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    logger.info("Upload request: course=%s file=%s", course_id, original_filename)

    # Server-generated temp path: the client filename is never used on the
    # filesystem (path-traversal defense); it is kept only as metadata.
    temp_dir = tempfile.mkdtemp(prefix="moto-upload-")
    temp_file_path = os.path.join(temp_dir, uuid.uuid4().hex + ext)

    try:
        # Stream to disk with a hard size cap (do not trust Content-Length).
        bytes_written = 0
        with open(temp_file_path, "wb") as buffer:
            while True:
                chunk = file.file.read(UPLOAD_CHUNK_BYTES)
                if not chunk:
                    break
                bytes_written += len(chunk)
                if bytes_written > MAX_UPLOAD_BYTES:
                    raise HTTPException(
                        status_code=413,
                        detail=f"File exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)}MB upload limit.",
                    )
                buffer.write(chunk)

        logger.info("Parsing file with MarkItDown...")
        md = MarkItDown()
        result = md.convert(temp_file_path)
        text_content = result.text_content

        if not text_content or not text_content.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from the file.")

        text_splitter = build_text_splitter()
        chunks = text_splitter.split_text(text_content)

        logger.info("Storing %d chunks in ChromaDB (collection: %s)...", len(chunks), course_id)
        vectorstore = get_vectorstore(course_id)

        # Replace any previous chunks for this file, then add with
        # deterministic IDs so re-uploads never duplicate.
        try:
            vectorstore._collection.delete(where={"source": original_filename})
        except Exception:
            logger.warning("Could not delete previous chunks for %s", original_filename, exc_info=True)

        metadatas = [{"source": original_filename, "course_id": course_id} for _ in chunks]
        vectorstore.add_texts(
            texts=chunks,
            metadatas=metadatas,
            ids=chunk_ids(course_id, original_filename, len(chunks)),
        )

        logger.info("Upload and processing complete.")
        return UploadResponse(
            status="success",
            filename=original_filename,
            chunks_stored=len(chunks),
        )

    except HTTPException:
        raise
    except Exception:
        logger.exception("Error processing upload for course %s", course_id)
        raise HTTPException(status_code=500, detail="Internal server error processing file.")
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


@app.post(
    "/api/chat",
    response_model=ChatResponse,
    dependencies=[Depends(require_internal_token)],
)
def chat(request: ChatRequest):
    """Answer a question strictly from the course materials."""
    logger.info("Chat query for course: %s", request.course_id)

    try:
        # Unknown course: do not create an empty collection as a side effect.
        if not collection_exists(request.course_id):
            return ChatResponse(answer=NO_MATERIALS_ANSWER, sources=[])

        vectorstore = get_vectorstore(request.course_id)
        docs = retrieve_relevant(vectorstore, request.query, k=RETRIEVAL_K_CHAT)

        if not docs:
            # Empty collection or nothing above the relevance threshold:
            # return the standard no-context answer instead of noise.
            return ChatResponse(answer=NO_CONTEXT_ANSWER, sources=[])

        context_str = format_context(docs)

        prompt = f"""You are an expert AI teaching assistant for a specific course.
Your task is to answer the user's question based strictly on the provided context below.

Rules:
1. Only use the provided context to answer the question.
2. If the context does not contain enough information to answer the question, output EXACTLY: "{NO_CONTEXT_ANSWER}"
3. Do NOT hallucinate. Do NOT use outside knowledge.
4. Be extremely concise and precise. Provide the answer in 1-3 short sentences maximum. Avoid long-winded explanations or filler.
5. Do NOT include any conversational filler, meta-text, or introductions like "Here is an answer". Output ONLY the direct answer.

Context:
{context_str}

Question:
{request.query}

Answer:"""

        logger.info("Generating response with local LLM...")
        answer = runtime.llm.invoke(prompt).strip()

        # If the model refused for lack of context, do not cite sources.
        if NO_CONTEXT_ANSWER in answer:
            return ChatResponse(answer=NO_CONTEXT_ANSWER, sources=[])

        return ChatResponse(
            answer=answer,
            sources=sorted({doc.metadata.get("source", "Unknown") for doc in docs}),
        )

    except HTTPException:
        raise
    except Exception:
        logger.exception("Error during chat generation for course %s", request.course_id)
        raise HTTPException(status_code=500, detail="Internal server error generating response.")


@app.post(
    "/api/generate-quiz",
    response_model=QuizResponse,
    dependencies=[Depends(require_internal_token)],
)
def generate_quiz(request: QuizRequest):
    """Generate a 5-question multiple-choice quiz targeting the weak topics."""
    logger.info(
        "Quiz generation request: course=%s topics=%s", request.course_id, request.weak_topics
    )

    try:
        if not collection_exists(request.course_id):
            raise HTTPException(
                status_code=404, detail="No materials found for this course to generate a quiz."
            )

        vectorstore = get_vectorstore(request.course_id)

        # Retrieve per weak topic, then merge and dedupe.
        docs = []
        seen: set[str] = set()
        for topic in request.weak_topics:
            for doc in retrieve_relevant(vectorstore, topic, k=RETRIEVAL_K_PER_TOPIC):
                key = hashlib.sha256(doc.page_content.encode("utf-8")).hexdigest()
                if key not in seen:
                    seen.add(key)
                    docs.append(doc)
        docs = docs[:QUIZ_MAX_CONTEXT_DOCS]

        if not docs:
            raise HTTPException(
                status_code=404,
                detail="No relevant course materials found for the requested topics.",
            )

        context_str = format_context(docs)

        prompt = f"""You are an expert AI teaching assistant.
Your task is to generate a 5-question multiple-choice quiz based strictly on the provided context below. The quiz should focus on these weak topics: {', '.join(request.weak_topics)}.

Rules:
1. Only use the provided context to create the questions.
2. Generate exactly 5 questions.
3. Each question must have exactly 4 options.
4. Each question must specify the index (0, 1, 2, or 3) of the correct answer.
5. Output ONLY a JSON object matching this exact schema:

{{
  "questions": [
    {{
      "question": "The text of the question?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer_index": 0
    }}
  ]
}}

Context:
{context_str}

Output the JSON object now:"""

        # Ollama JSON mode guarantees syntactically valid JSON; Pydantic
        # enforces the contract shape. Retry once before giving up.
        last_error: Optional[Exception] = None
        for attempt in range(2):
            logger.info("Generating quiz with local LLM (attempt %d)...", attempt + 1)
            response = runtime.quiz_llm.invoke(prompt)
            try:
                parsed = json.loads(response)
                questions = parsed.get("questions") if isinstance(parsed, dict) else None
                if isinstance(questions, list) and len(questions) > 5:
                    questions = questions[:5]
                return QuizResponse.model_validate({"questions": questions})
            except (json.JSONDecodeError, ValidationError, AttributeError) as e:
                last_error = e
                logger.warning("Quiz output failed validation on attempt %d: %s", attempt + 1, e)

        logger.error("Quiz generation failed after retry: %s", last_error)
        raise HTTPException(
            status_code=502,
            detail="The language model did not return a valid quiz. Please try again.",
        )

    except HTTPException:
        raise
    except Exception:
        logger.exception("Error during quiz generation for course %s", request.course_id)
        raise HTTPException(status_code=500, detail="Internal server error generating quiz.")


class DeleteDocumentRequest(BaseModel):
    course_id: str
    filename: str

    _check_course_id = field_validator("course_id")(_validate_course_id)


@app.delete(
    "/api/document",
    dependencies=[Depends(require_internal_token)],
)
def delete_document(request: DeleteDocumentRequest):
    """Remove all ChromaDB chunks for a specific file within a course."""
    logger.info("Delete request: course=%s file=%s", request.course_id, request.filename)

    if not collection_exists(request.course_id):
        return {"status": "not_found", "filename": request.filename}

    vs = get_vectorstore(request.course_id)
    try:
        vs._collection.delete(where={"source": request.filename})
    except Exception:
        logger.warning(
            "Could not delete chunks for %s in course %s",
            request.filename,
            request.course_id,
            exc_info=True,
        )
        raise HTTPException(status_code=500, detail="Failed to delete document chunks.")

    _vectorstore_cache.pop(request.course_id)

    logger.info("Deleted chunks for %s in course %s", request.filename, request.course_id)
    return {"status": "deleted", "filename": request.filename}


@app.get("/health")
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
        probe_path = os.path.join(CHROMA_DIR, f".probe-{uuid.uuid4().hex}")
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

    _port = int(os.environ.get("PORT", "8000"))
    if _port < 1024:
        import sys
        print(
            f"ERROR: PORT={_port} is a privileged port (< 1024). "
            "Set PORT to 1024 or higher, or leave it unset to use the default 8000.",
            file=sys.stderr,
        )
        sys.exit(1)

    uvicorn.run("main:app", host="127.0.0.1", port=_port, reload=True)
