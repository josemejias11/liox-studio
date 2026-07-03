"""Document parsing and upload logic."""

import logging
import os
import secrets
import shutil
import tempfile

from markitdown import MarkItDown

from settings import (
    ALLOWED_EXTENSIONS,
    CHUNK_OVERLAP,
    CHUNK_SIZE,
    COURSE_ID_PATTERN,
    MAX_UPLOAD_BYTES,
    UPLOAD_CHUNK_BYTES,
)
from vectorstore import build_text_splitter, chunk_ids, get_vectorstore

logger = logging.getLogger(__name__)


def _validate_course_id(value: str) -> str:
    if not COURSE_ID_PATTERN.fullmatch(value):
        raise ValueError(
            "course_id must be 3-63 characters, alphanumeric at both ends, "
            "and contain only letters, digits, '.', '_' or '-'."
        )
    return value


def parse_and_store(course_id: str, original_filename: str, temp_file_path: str) -> int:
    """Parse a document and store its chunk embeddings. Returns chunk count."""
    logger.info("Parsing file with MarkItDown...")
    md = MarkItDown()
    result = md.convert(temp_file_path)
    text_content = result.text_content

    if not text_content or not text_content.strip():
        raise ValueError("Could not extract text from the file.")

    text_splitter = build_text_splitter()
    chunks = text_splitter.split_text(text_content)

    logger.info("Storing %d chunks in ChromaDB (collection: %s)...", len(chunks), course_id)
    vectorstore = get_vectorstore(course_id)

    # Replace any previous chunks for this file.
    try:
        # noinspection PyProtectedMember
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
    return len(chunks)


def validate_upload_file(filename: str) -> str:
    """Validate file extension. Returns the extension."""
    original_filename = os.path.basename(filename or "")
    ext = os.path.splitext(original_filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(
            f"Unsupported file type. Allowed types: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )
    return ext


def stream_upload_to_disk(file_obj, ext: str) -> tuple[str, str]:
    """Stream upload to a temp file. Returns (temp_dir, temp_file_path)."""
    temp_dir = tempfile.mkdtemp(prefix="moto-upload-")
    temp_file_path = os.path.join(temp_dir, secrets.token_hex(16) + ext)

    bytes_written = 0
    with open(temp_file_path, "wb") as buffer:
        while True:
            chunk = file_obj.read(UPLOAD_CHUNK_BYTES)
            if not chunk:
                break
            bytes_written += len(chunk)
            if bytes_written > MAX_UPLOAD_BYTES:
                shutil.rmtree(temp_dir, ignore_errors=True)
                raise ValueError(
                    f"File exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)}MB upload limit."
                )
            buffer.write(chunk)

    return temp_dir, temp_file_path
