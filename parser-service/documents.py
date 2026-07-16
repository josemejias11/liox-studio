"""Document parsing and upload logic."""

import logging
import os
import secrets
import shutil
import tempfile
from typing import BinaryIO

from settings import (
    ALLOWED_EXTENSIONS,
    COURSE_ID_PATTERN,
    MAX_UPLOAD_BYTES,
    UPLOAD_CHUNK_BYTES,
)

logger = logging.getLogger(__name__)


def validate_course_id(value: str) -> str:
    if not COURSE_ID_PATTERN.fullmatch(value):
        raise ValueError(
            "course_id must be 3-63 characters, alphanumeric at both ends, "
            "and contain only letters, digits, '.', '_' or '-'."
        )
    return value


_validate_course_id = validate_course_id


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
