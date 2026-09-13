"""Local, embedding-free chunk persistence."""

import importlib
import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

SERVICE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_ROOT / "src"))


class ExtractionStoreTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.mkdtemp(prefix="lb-studio-extracted-test-")
        self.addCleanup(shutil.rmtree, self.temp_dir, ignore_errors=True)
        import lb_studio_parser.settings as settings_module

        settings_module.EXTRACTED_DIR = self.temp_dir
        sys.modules.pop("lb_studio_parser.extraction_store", None)
        self.extraction_store = importlib.import_module("lb_studio_parser.extraction_store")

    def test_store_writes_a_json_file_with_the_chunks(self) -> None:
        count = self.extraction_store.store_extracted_chunks(
            "course-1", "source-1", "a" * 64, "brief.docx", ["chunk one", "chunk two"]
        )
        self.assertEqual(count, 2)
        stored_path = Path(self.temp_dir) / "course-1" / "source-1.json"
        self.assertTrue(stored_path.exists())
        payload = json.loads(stored_path.read_text())
        self.assertEqual(payload["chunks"], ["chunk one", "chunk two"])
        self.assertEqual(payload["filename"], "brief.docx")

    def test_delete_removes_an_existing_file_and_reports_it(self) -> None:
        self.extraction_store.store_extracted_chunks(
            "course-1", "source-1", "a" * 64, "brief.docx", ["chunk one"]
        )
        deleted = self.extraction_store.delete_extracted_chunks("course-1", "source-1")
        self.assertTrue(deleted)
        self.assertFalse((Path(self.temp_dir) / "course-1" / "source-1.json").exists())

    def test_delete_reports_false_when_nothing_to_delete(self) -> None:
        deleted = self.extraction_store.delete_extracted_chunks("course-1", "missing-source")
        self.assertFalse(deleted)

    def test_store_rejects_a_source_id_with_a_path_separator(self) -> None:
        with self.assertRaises(ValueError):
            self.extraction_store.store_extracted_chunks(
                "course-1", "../../etc/passwd", "a" * 64, "brief.docx", ["chunk one"]
            )

    def test_store_rejects_a_source_id_with_dot_dot_traversal(self) -> None:
        with self.assertRaises(ValueError):
            self.extraction_store.store_extracted_chunks(
                "course-1", "..", "a" * 64, "brief.docx", ["chunk one"]
            )

    def test_delete_rejects_a_source_id_with_a_path_separator(self) -> None:
        with self.assertRaises(ValueError):
            self.extraction_store.delete_extracted_chunks("course-1", "sub/dir")

    def test_store_rejects_a_course_id_with_a_path_separator(self) -> None:
        with self.assertRaises(ValueError):
            self.extraction_store.store_extracted_chunks(
                "course/1", "source-1", "a" * 64, "brief.docx", ["chunk one"]
            )

    def test_store_and_delete_still_accept_a_cuid_shaped_source_id(self) -> None:
        cuid_like = "cljk3x9q00001z2r4b8f9h2a"
        count = self.extraction_store.store_extracted_chunks(
            "course-1", cuid_like, "a" * 64, "brief.docx", ["chunk one"]
        )
        self.assertEqual(count, 1)
        deleted = self.extraction_store.delete_extracted_chunks("course-1", cuid_like)
        self.assertTrue(deleted)


if __name__ == "__main__":
    unittest.main()
