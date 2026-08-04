"""OpenAI and Chroma runtime, retrieval, chat, and quiz behavior."""

import hashlib
import json
import logging
import os
from collections import OrderedDict
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from threading import Lock

import chromadb
from fastapi import FastAPI
from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pydantic import ValidationError

from .contracts import QuizPayload
from .settings import (
    CHROMA_DIR,
    CHUNK_OVERLAP,
    CHUNK_SIZE,
    NO_CONTEXT_ANSWER,
    NO_MATERIALS_ANSWER,
    OPENAI_API_KEY,
    OPENAI_CHAT_MODEL,
    OPENAI_EMBEDDING_MODEL,
    OPENAI_TIMEOUT_SECONDS,
    QUIZ_MAX_CONTEXT_DOCS,
    RELEVANCE_THRESHOLD,
    RETRIEVAL_K_CHAT,
    RETRIEVAL_K_PER_TOPIC,
)

logger = logging.getLogger(__name__)


class Runtime:
    token: str = ""
    embeddings: OpenAIEmbeddings | None = None
    llm: ChatOpenAI | None = None
    quiz_llm: ChatOpenAI | None = None
    chroma_client: chromadb.ClientAPI | None = None


class VectorstoreCache:
    """Bounded thread-safe cache for per-course Chroma wrappers."""

    def __init__(self) -> None:
        self._items: OrderedDict[str, Chroma] = OrderedDict()
        self._maxsize = int(os.environ.get("VECTORSTORE_CACHE_SIZE", "50"))
        self._lock = Lock()

    def get(self, key: str) -> Chroma | None:
        with self._lock:
            value = self._items.get(key)
            if value is not None:
                self._items.move_to_end(key)
            return value

    def set(self, key: str, value: Chroma) -> None:
        with self._lock:
            if key not in self._items and len(self._items) >= self._maxsize:
                evicted, _ = self._items.popitem(last=False)
                logger.debug("Evicted vectorstore cache entry: %s", evicted)
            self._items[key] = value
            self._items.move_to_end(key)

    def pop(self, key: str) -> None:
        with self._lock:
            self._items.pop(key, None)


runtime = Runtime()
_vectorstores = VectorstoreCache()


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
        runtime.llm = ChatOpenAI(
            model=OPENAI_CHAT_MODEL,
            api_key=OPENAI_API_KEY,
            timeout=OPENAI_TIMEOUT_SECONDS,
        )
        runtime.quiz_llm = ChatOpenAI(
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


def collection_exists(course_id: str) -> bool:
    try:
        assert runtime.chroma_client is not None
        runtime.chroma_client.get_collection(course_id)
        return True
    except Exception as error:
        if (
            "does not exist" in str(error).lower()
            or "invalidcollection" in type(error).__name__.lower()
        ):
            return False
        raise


def get_vectorstore(course_id: str) -> Chroma:
    vectorstore = _vectorstores.get(course_id)
    if vectorstore is None:
        assert runtime.chroma_client is not None and runtime.embeddings is not None
        vectorstore = Chroma(
            client=runtime.chroma_client,
            collection_name=course_id,
            embedding_function=runtime.embeddings,
            collection_metadata={"hnsw:space": "cosine"},
        )
        _vectorstores.set(course_id, vectorstore)
    return vectorstore


def chunk_ids(course_id: str, source_id: str, sha256: str, count: int) -> list[str]:
    return [
        hashlib.sha256(f"{course_id}|{source_id}|{sha256}|{index}".encode()).hexdigest()
        for index in range(count)
    ]


def build_text_splitter() -> RecursiveCharacterTextSplitter:
    return RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP, separators=["\n\n", "\n", " ", ""]
    )


def replace_document_chunks(
    course_id: str,
    source_id: str,
    sha256: str,
    filename: str,
    chunks: list[str],
) -> int:
    vectorstore = get_vectorstore(course_id)
    try:
        vectorstore._collection.delete(  # noqa: SLF001
            where={
                "$and": [
                    {"course_id": course_id},
                    {"source_id": source_id},
                ]
            }
        )
    except Exception:
        logger.warning("Could not delete previous chunks for source %s", source_id, exc_info=True)
    vectorstore.add_texts(
        texts=chunks,
        metadatas=[
            {
                "source": filename,
                "course_id": course_id,
                "source_id": source_id,
                "sha256": sha256,
            }
            for _ in chunks
        ],
        ids=chunk_ids(course_id, source_id, sha256, len(chunks)),
    )
    return len(chunks)


def delete_document_chunks(course_id: str, source_id: str) -> bool:
    if not collection_exists(course_id):
        return False
    get_vectorstore(course_id)._collection.delete(  # noqa: SLF001
        where={
            "$and": [
                {"course_id": course_id},
                {"source_id": source_id},
            ]
        }
    )
    _vectorstores.pop(course_id)
    return True


def retrieve_course_documents(
    course_id: str, source_ids: list[str], query: str, k: int
) -> list[Document]:
    if not source_ids or not collection_exists(course_id):
        return []
    return [
        doc
        for doc, score in get_vectorstore(course_id).similarity_search_with_relevance_scores(
            query, k=k, filter={"source_id": {"$in": source_ids}}
        )
        if score >= RELEVANCE_THRESHOLD
    ]


def format_context(documents: list[Document]) -> str:
    return "\n\n".join(
        f"--- Source: {doc.metadata.get('source', 'Unknown')} ---\n{doc.page_content}"
        for doc in documents
    )


def response_text(response: object) -> str:
    """Return text content from a LangChain chat-model response."""
    content = getattr(response, "content", response)
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(
            item if isinstance(item, str) else str(item.get("text", ""))
            for item in content
        )
    return str(content)


def answer_question(course_id: str, source_ids: list[str], query: str) -> tuple[str, list[str]]:
    logger.info("Revision-bound chat query for course: %s", course_id)
    if not source_ids:
        return NO_CONTEXT_ANSWER, []
    if not collection_exists(course_id):
        return NO_MATERIALS_ANSWER, []
    documents = retrieve_course_documents(course_id, source_ids, query, RETRIEVAL_K_CHAT)
    if not documents:
        return NO_CONTEXT_ANSWER, []
    context_str = format_context(documents)
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
{query}

Answer:"""
    logger.info("Generating response with OpenAI...")
    assert runtime.llm is not None
    answer = response_text(runtime.llm.invoke(prompt)).strip()
    if NO_CONTEXT_ANSWER in answer:
        return NO_CONTEXT_ANSWER, []
    return answer, sorted({document.metadata.get("source", "Unknown") for document in documents})


def generate_quiz(course_id: str, source_ids: list[str], weak_topics: list[str]) -> list[dict]:
    logger.info("Revision-bound quiz request: course=%s topics=%s", course_id, weak_topics)
    if not source_ids:
        raise LookupError("No revision sources are available to generate a quiz.")
    if not collection_exists(course_id):
        raise LookupError("No materials found for this course to generate a quiz.")
    documents: list[Document] = []
    seen: set[str] = set()
    for topic in weak_topics:
        for document in retrieve_course_documents(
            course_id, source_ids, topic, RETRIEVAL_K_PER_TOPIC
        ):
            key = hashlib.sha256(document.page_content.encode()).hexdigest()
            if key not in seen:
                seen.add(key)
                documents.append(document)
    documents = documents[:QUIZ_MAX_CONTEXT_DOCS]
    if not documents:
        raise LookupError("No relevant course materials found for the requested topics.")
    context_str = format_context(documents)
    prompt = f"""You are an expert AI teaching assistant.
Your task is to generate a 5-question multiple-choice quiz based strictly on the provided context below. The quiz should focus on these weak topics: {', '.join(weak_topics)}.

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
    last_error: Exception | None = None
    for attempt in range(2):
        logger.info("Generating quiz with OpenAI (attempt %d)...", attempt + 1)
        assert runtime.quiz_llm is not None
        try:
            parsed = json.loads(response_text(runtime.quiz_llm.invoke(prompt)))
            questions = parsed.get("questions") if isinstance(parsed, dict) else None
            if isinstance(questions, list) and len(questions) > 5:
                questions = questions[:5]
            return [
                question.model_dump()
                for question in QuizPayload.model_validate({"questions": questions}).questions
            ]
        except (ValueError, ValidationError, AttributeError) as error:
            last_error = error
            logger.warning("Quiz output failed validation on attempt %d: %s", attempt + 1, error)
    logger.error("Quiz generation failed after retry: %s", last_error)
    raise RuntimeError(
        "The language model did not return a valid quiz. Please try again."
    ) from last_error
