"""Text extraction from staged course documents."""

import logging

from markitdown import MarkItDown

logger = logging.getLogger(__name__)


def extract_document_text(file_path: str) -> str:
    """Extract non-empty text from one staged document."""
    logger.info("Parsing file with MarkItDown...")
    text_content = MarkItDown().convert(file_path).text_content
    if not text_content or not text_content.strip():
        raise ValueError("Could not extract text from the file.")
    return text_content
