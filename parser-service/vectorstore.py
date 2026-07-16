"""Vectorstore helpers: collection checks, caching, retrieval, chunking."""

import hashlib
import logging

from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

from runtime import (
    cache_vectorstore,
    get_cached_vectorstore,
    invalidate_vectorstore_cache,
    runtime,
)
from settings import (
    CHUNK_OVERLAP,
    CHUNK_SIZE,
    RELEVANCE_THRESHOLD,
)

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
    vs = get_cached_vectorstore(course_id)
    if vs is None:
        assert runtime.chroma_client is not None
        assert runtime.embeddings is not None
        vs = Chroma(
            client=runtime.chroma_client,
            collection_name=course_id,
            embedding_function=runtime.embeddings,
            collection_metadata={"hnsw:space": "cosine"},
        )
        cache_vectorstore(course_id, vs)
    return vs


def chunk_ids(course_id: str, filename: str, count: int) -> list[str]:
    """Deterministic IDs so re-uploading a file replaces its chunks."""
    return [
        hashlib.sha256(f"{course_id}|{filename}|{i}".encode()).hexdigest()
        for i in range(count)
    ]


def replace_document_chunks(course_id: str, filename: str, chunks: list[str]) -> int:
    """Replace one document's chunks in a course collection."""
    logger.info("Storing %d chunks in ChromaDB (collection: %s)...", len(chunks), course_id)
    vectorstore = get_vectorstore(course_id)
    try:
        # noinspection PyProtectedMember
        vectorstore._collection.delete(where={"source": filename})
    except Exception:
        logger.warning("Could not delete previous chunks for %s", filename, exc_info=True)

    vectorstore.add_texts(
        texts=chunks,
        metadatas=[{"source": filename, "course_id": course_id} for _ in chunks],
        ids=chunk_ids(course_id, filename, len(chunks)),
    )
    logger.info("Upload and processing complete.")
    return len(chunks)


def delete_document_chunks(course_id: str, filename: str) -> bool:
    """Delete one document's chunks, returning false when its course is absent."""
    if not collection_exists(course_id):
        return False

    vectorstore = get_vectorstore(course_id)
    # noinspection PyProtectedMember
    vectorstore._collection.delete(where={"source": filename})
    invalidate_vectorstore_cache(course_id)
    return True


def retrieve_relevant(vs: Chroma, query: str, k: int) -> list[Document]:
    results = vs.similarity_search_with_relevance_scores(query, k=k)
    return [doc for doc, score in results if score >= RELEVANCE_THRESHOLD]


def retrieve_course_documents(course_id: str, query: str, k: int) -> list[Document]:
    """Retrieve relevant course documents, returning none when no collection exists."""
    if not collection_exists(course_id):
        return []
    return retrieve_relevant(get_vectorstore(course_id), query, k=k)


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
