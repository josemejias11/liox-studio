"""Extraction-mode branching for store_course_document()."""

import hashlib
import importlib
import io
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

SERVICE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_ROOT / "src"))


class StoreCourseDocumentModeTests(unittest.TestCase):
    def _args(self) -> tuple[str, str, str, io.BytesIO]:
        content = b"fake docx bytes"
        return "course-test-123", "brief.docx", hashlib.sha256(content).hexdigest(), io.BytesIO(
            content
        )

    def test_extraction_only_mode_skips_embeddings(self) -> None:
        documents = importlib.import_module("lb_studio_parser.documents")
        course_id, filename, sha256, file_obj = self._args()
        with (
            patch.object(documents, "EMBEDDINGS_ENABLED", False),
            patch.object(documents, "extract_document_text", return_value="hello world"),
            patch.object(documents, "store_extracted_chunks", return_value=1) as store_extracted,
            patch.object(documents, "replace_document_chunks") as replace_chunks,
        ):
            returned_filename, chunks_stored, status = documents.store_course_document(
                course_id, "source-1", sha256, filename, file_obj
            )
        self.assertEqual(status, "extracted")
        self.assertEqual(chunks_stored, 1)
        self.assertEqual(returned_filename, filename)
        store_extracted.assert_called_once()
        replace_chunks.assert_not_called()

    def test_embeddings_enabled_mode_calls_chroma(self) -> None:
        documents = importlib.import_module("lb_studio_parser.documents")
        course_id, filename, sha256, file_obj = self._args()
        with (
            patch.object(documents, "EMBEDDINGS_ENABLED", True),
            patch.object(documents, "extract_document_text", return_value="hello world"),
            patch.object(documents, "store_extracted_chunks") as store_extracted,
            patch.object(documents, "replace_document_chunks", return_value=1) as replace_chunks,
        ):
            returned_filename, chunks_stored, status = documents.store_course_document(
                course_id, "source-1", sha256, filename, file_obj
            )
        self.assertEqual(status, "indexed")
        self.assertEqual(chunks_stored, 1)
        replace_chunks.assert_called_once()
        store_extracted.assert_not_called()

    def test_rejects_unsafe_source_id_before_any_extraction_work(self) -> None:
        documents = importlib.import_module("lb_studio_parser.documents")
        course_id, filename, sha256, file_obj = self._args()
        with (
            patch.object(documents, "extract_document_text") as extract_text,
            patch.object(documents, "store_extracted_chunks") as store_extracted,
            patch.object(documents, "replace_document_chunks") as replace_chunks,
        ):
            with self.assertRaises(ValueError):
                documents.store_course_document(
                    course_id, "../../etc/passwd", sha256, filename, file_obj
                )
        extract_text.assert_not_called()
        store_extracted.assert_not_called()
        replace_chunks.assert_not_called()


if __name__ == "__main__":
    unittest.main()
