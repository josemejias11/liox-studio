"""Source-scoped Chroma storage and retrieval for authoring use cases."""

import hashlib
import logging
import os
from collections import OrderedDict
from threading import Lock

from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

from .runtime import runtime
from .settings import CHUNK_OVERLAP, CHUNK_SIZE, RELEVANCE_THRESHOLD

logger = logging.getLogger(__name__)


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


_vectorstores = VectorstoreCache()


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
        document
        for document, score in get_vectorstore(course_id).similarity_search_with_relevance_scores(
            query, k=k, filter={"source_id": {"$in": source_ids}}
        )
        if score >= RELEVANCE_THRESHOLD
    ]


def format_context(documents: list[Document]) -> str:
    return "\n\n".join(
        f"--- Source: {document.metadata.get('source', 'Unknown')} ---\n{document.page_content}"
        for document in documents
    )
