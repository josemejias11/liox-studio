"""Local, embedding-free persistence for extracted document chunks.

Used when EMBEDDINGS_ENABLED is false: proves a source is real and
parseable, and satisfies the freeze-readiness gate, without any billed API
call. Chunks are stored as plain JSON, keyed the same way Chroma chunks
are (course_id/source_id), so a future real-embedding pass can re-embed
them directly without re-extracting.
"""

import json
import logging
import os

from .settings import EXTRACTED_DIR

logger = logging.getLogger(__name__)


def _chunk_file_path(course_id: str, source_id: str) -> str:
    course_dir = os.path.join(EXTRACTED_DIR, course_id)
    os.makedirs(course_dir, exist_ok=True)
    return os.path.join(course_dir, f"{source_id}.json")


def store_extracted_chunks(
    course_id: str,
    source_id: str,
    sha256: str,
    filename: str,
    chunks: list[str],
) -> int:
    """Persist chunk text locally with no embedding call. Returns chunk count."""
    payload = {
        "course_id": course_id,
        "source_id": source_id,
        "sha256": sha256,
        "filename": filename,
        "chunks": chunks,
    }
    with open(_chunk_file_path(course_id, source_id), "w", encoding="utf-8") as handle:
        json.dump(payload, handle)
    logger.info(
        "Stored %d extracted chunks locally: course=%s source=%s",
        len(chunks),
        course_id,
        source_id,
    )
    return len(chunks)


def delete_extracted_chunks(course_id: str, source_id: str) -> bool:
    """Remove a locally stored chunk file, if present. Returns whether it existed."""
    path = _chunk_file_path(course_id, source_id)
    if not os.path.exists(path):
        return False
    os.remove(path)
    return True
