"""Configuration constants loaded from environment variables."""

import os
import re
from pathlib import Path

from dotenv import load_dotenv

# Load this service's file before any os.environ.get() call, regardless of cwd.
SERVICE_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(SERVICE_ROOT / ".env", override=False)

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
OPENAI_CHAT_MODEL = os.environ.get("OPENAI_CHAT_MODEL", "gpt-5.4-mini")
OPENAI_EMBEDDING_MODEL = os.environ.get("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
OPENAI_TIMEOUT_SECONDS = float(os.environ.get("OPENAI_TIMEOUT_SECONDS", "120"))
_configured_chroma_dir = Path(os.environ.get("CHROMA_DIR", "chroma_db"))
CHROMA_DIR = str(
    _configured_chroma_dir
    if _configured_chroma_dir.is_absolute()
    else SERVICE_ROOT / _configured_chroma_dir
)
EMBEDDINGS_ENABLED = os.environ.get("EMBEDDINGS_ENABLED", "false").strip().lower() == "true"
_configured_extracted_dir = Path(os.environ.get("EXTRACTED_DIR", "extracted_chunks"))
EXTRACTED_DIR = str(
    _configured_extracted_dir
    if _configured_extracted_dir.is_absolute()
    else SERVICE_ROOT / _configured_extracted_dir
)
MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50MB hard cap
UPLOAD_CHUNK_BYTES = 1024 * 1024
ALLOWED_EXTENSIONS = {".pdf", ".pptx", ".docx", ".xlsx"}

# Must satisfy Chroma collection-name rules (3-63 chars, alnum at both ends).
COURSE_ID_PATTERN = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9._-]{1,61}[a-zA-Z0-9]$")


def validate_course_id(value: str) -> str:
    """Validate a course identifier before it reaches Chroma."""
    if not COURSE_ID_PATTERN.fullmatch(value):
        raise ValueError(
            "course_id must be 3-63 characters, alphanumeric at both ends, "
            "and contain only letters, digits, '.', '_' or '-'."
        )
    return value


# Relevance cutoff for cosine-space collections.
RELEVANCE_THRESHOLD = float(os.environ.get("RELEVANCE_THRESHOLD", "0.45"))

CHUNK_SIZE = int(os.environ.get("CHUNK_SIZE", "1000"))
CHUNK_OVERLAP = int(os.environ.get("CHUNK_OVERLAP", "200"))
