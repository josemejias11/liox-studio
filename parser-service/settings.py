"""Configuration constants loaded from environment variables."""

import os
import re

from dotenv import load_dotenv

# load_dotenv runs before any os.environ.get() call.
load_dotenv(override=False)

OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
CHROMA_DIR = os.environ.get("CHROMA_DIR", "./chroma_db")
LLM_MODEL = os.environ.get("LLM_MODEL", "llama3")
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "nomic-embed-text")
OLLAMA_TIMEOUT_SECONDS = float(os.environ.get("OLLAMA_TIMEOUT_SECONDS", "120"))

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

RETRIEVAL_K_CHAT = int(os.environ.get("RETRIEVAL_K_CHAT", "5"))
RETRIEVAL_K_PER_TOPIC = 4
QUIZ_MAX_CONTEXT_DOCS = 12

CHUNK_SIZE = int(os.environ.get("CHUNK_SIZE", "1000"))
CHUNK_OVERLAP = int(os.environ.get("CHUNK_OVERLAP", "200"))

NO_MATERIALS_ANSWER = (
    "No materials have been uploaded for this course yet, "
    "so I cannot answer your question."
)
NO_CONTEXT_ANSWER = (
    "I do not have enough information to answer this question "
    "based on the course materials."
)
