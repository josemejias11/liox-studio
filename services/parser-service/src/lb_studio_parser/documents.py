"""Document validation, extraction, indexing, and deletion use cases."""

import logging
import os
import re
import secrets
import shutil
import tempfile
from typing import BinaryIO, cast

from markitdown import MarkItDown

from .retrieval import build_text_splitter, delete_document_chunks, replace_document_chunks
from .settings import (
    ALLOWED_EXTENSIONS,
    MAX_UPLOAD_BYTES,
    UPLOAD_CHUNK_BYTES,
    validate_course_id,
)

logger = logging.getLogger(__name__)


class InvalidCourseIdError(ValueError):
    """The supplied course identifier is not valid."""


class InvalidUploadError(ValueError):
    """The uploaded document cannot be accepted."""


class UploadTooLargeError(InvalidUploadError):
    """The uploaded document exceeds the configured size limit."""


class DocumentExtractionError(InvalidUploadError):
    """The uploaded document contains no extractable text."""


class DocumentProcessingError(RuntimeError):
    """The uploaded document could not be processed."""


class DocumentDeletionError(RuntimeError):
    """Stored document chunks could not be removed."""


def validate_upload_file(filename: str) -> str:
    """Validate file extension. Returns the extension."""
    original_filename = os.path.basename(filename or "")
    ext = os.path.splitext(original_filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(
            f"Unsupported file type. Allowed types: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )
    return ext


def stream_upload_to_disk(file_obj: BinaryIO, ext: str) -> tuple[str, str]:
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


def extract_document_text(file_path: str) -> str:
    """Extract non-empty text from one staged document."""
    logger.info("Parsing file with MarkItDown...")
    text_content = MarkItDown().convert(file_path).text_content
    if not text_content or not text_content.strip():
        raise ValueError("Could not extract text from the file.")
    return cast(str, text_content)


def store_course_document(
    course_id: str,
    source_id: str,
    sha256: str,
    filename: str,
    file_obj: BinaryIO,
) -> tuple[str, int]:
    """Validate, stage, parse, and index one course document."""
    try:
        validate_course_id(course_id)
    except ValueError as error:
        raise InvalidCourseIdError(str(error)) from error

    if not source_id or len(source_id) > 100:
        raise InvalidUploadError("source_id must be between 1 and 100 characters.")
    if not re.fullmatch(r"[0-9a-f]{64}", sha256):
        raise InvalidUploadError("sha256 must be a lowercase hexadecimal SHA-256 digest.")

    original_filename = os.path.basename(filename or "")
    try:
        extension = validate_upload_file(original_filename)
    except ValueError as error:
        raise InvalidUploadError(str(error)) from error

    logger.info(
        "Source index request: course=%s source=%s file=%s",
        course_id,
        source_id,
        original_filename,
    )
    temp_dir: str | None = None
    try:
        temp_dir, temp_file_path = stream_upload_to_disk(file_obj, extension)
        chunks = build_text_splitter().split_text(extract_document_text(temp_file_path))
        return original_filename, replace_document_chunks(
            course_id,
            source_id,
            sha256,
            original_filename,
            chunks,
        )
    except ValueError as error:
        detail = str(error)
        if "MB upload limit" in detail:
            raise UploadTooLargeError(detail) from error
        if "extract text" in detail.lower():
            raise DocumentExtractionError(detail) from error
        raise DocumentProcessingError("Internal server error processing file.") from error
    except Exception as error:
        logger.exception("Error processing upload for course %s", course_id)
        raise DocumentProcessingError("Internal server error processing file.") from error
    finally:
        if temp_dir:
            shutil.rmtree(temp_dir, ignore_errors=True)


def remove_course_document(course_id: str, source_id: str) -> str:
    """Remove one document's chunks and return the public deletion status."""
    logger.info("Source delete request: course=%s source=%s", course_id, source_id)
    try:
        deleted = delete_document_chunks(course_id, source_id)
    except Exception as error:
        logger.warning(
            "Could not delete chunks for source %s in course %s",
            source_id,
            course_id,
            exc_info=True,
        )
        raise DocumentDeletionError("Failed to delete document chunks.") from error
    if deleted:
        logger.info("Deleted chunks for source %s in course %s", source_id, course_id)
    return "deleted" if deleted else "not_found"
