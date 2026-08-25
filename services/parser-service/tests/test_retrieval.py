"""Tests for atomic source-chunk replacement in the retrieval module."""

import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

SERVICE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_ROOT / "src"))

from moto_parser import retrieval  # noqa: E402


class ReplaceDocumentChunksTests(unittest.TestCase):
    def test_delete_failure_fails_closed(self) -> None:
        fake_vectorstore = MagicMock()
        fake_vectorstore._collection.delete.side_effect = RuntimeError("chroma unavailable")

        with patch.object(retrieval, "get_vectorstore", return_value=fake_vectorstore):
            with self.assertRaises(RuntimeError):
                retrieval.replace_document_chunks(
                    course_id="course-1",
                    source_id="source-1",
                    sha256="a" * 64,
                    filename="doc.pdf",
                    chunks=["chunk one", "chunk two"],
                )

        fake_vectorstore.add_texts.assert_not_called()

    def test_successful_delete_still_adds_new_chunks(self) -> None:
        fake_vectorstore = MagicMock()

        with patch.object(retrieval, "get_vectorstore", return_value=fake_vectorstore):
            count = retrieval.replace_document_chunks(
                course_id="course-1",
                source_id="source-1",
                sha256="b" * 64,
                filename="doc.pdf",
                chunks=["chunk one", "chunk two"],
            )

        self.assertEqual(count, 2)
        fake_vectorstore.add_texts.assert_called_once()


if __name__ == "__main__":
    unittest.main()
