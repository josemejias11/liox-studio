"""Application operations used by the parser-service HTTP adapters."""

import logging
import os
import shutil
from typing import BinaryIO

from documents import (
    _validate_course_id,
    delete_stored_document,
    parse_and_store,
    stream_upload_to_disk,
    validate_upload_file,
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


def store_course_document(
    course_id: str,
    filename: str,
    file_obj: BinaryIO,
) -> tuple[str, int]:
    """Validate, persist temporarily, parse, and index one course document."""
    try:
        _validate_course_id(course_id)
    except ValueError as error:
        raise InvalidCourseIdError(str(error)) from error

    original_filename = os.path.basename(filename or "")
    try:
        extension = validate_upload_file(original_filename)
    except ValueError as error:
        raise InvalidUploadError(str(error)) from error

    logger.info("Upload request: course=%s file=%s", course_id, original_filename)

    temp_dir: str | None = None
    try:
        temp_dir, temp_file_path = stream_upload_to_disk(file_obj, extension)
        chunks_stored = parse_and_store(course_id, original_filename, temp_file_path)
        return original_filename, chunks_stored
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


def remove_course_document(course_id: str, filename: str) -> str:
    """Remove one document's chunks and return the public deletion status."""
    logger.info("Delete request: course=%s file=%s", course_id, filename)
    try:
        deleted = delete_stored_document(course_id, filename)
    except Exception as error:
        logger.warning(
            "Could not delete chunks for %s in course %s",
            filename,
            course_id,
            exc_info=True,
        )
        raise DocumentDeletionError("Failed to delete document chunks.") from error

    status = "deleted" if deleted else "not_found"
    if deleted:
        logger.info("Deleted chunks for %s in course %s", filename, course_id)
    return status
