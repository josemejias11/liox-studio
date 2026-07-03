"""Vectorstore helpers: collection checks, caching, retrieval, chunking."""

import hashlib
import logging

from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

from settings import (
    CHUNK_OVERLAP,
    CHUNK_SIZE,
    RELEVANCE_THRESHOLD,
)
from runtime import runtime, _vectorstore_cache

logger = logging.getLogger(__name__)


def collection_exists(course_id: str) -> bool:
    try:
        assert runtime.chroma_client is not None
        runtime.chroma_client.get_collection(course_id)
        return True
    except Exception as e:
        err_str = str(e).lower()
        if "does not exist" in err_str or "invalidcollection" in type(e).__name__.lower():
            return False
        logger.error("ChromaDB error checking collection %s: %s", course_id, e)
        raise


def get_vectorstore(course_id: str) -> Chroma:
    """LRU-cached per-course Chroma vectorstore (creates the collection if needed)."""
    vs = _vectorstore_cache.get(course_id)
    if vs is None:
        assert runtime.chroma_client is not None
        assert runtime.embeddings is not None
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
        hashlib.sha256(f"{course_id}|{filename}|{i}".encode()).hexdigest()
        for i in range(count)
    ]


def retrieve_relevant(vs: Chroma, query: str, k: int) -> list[Document]:
    results = vs.similarity_search_with_relevance_scores(query, k=k)
    return [doc for doc, score in results if score >= RELEVANCE_THRESHOLD]


def format_context(docs: list[Document]) -> str:
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
