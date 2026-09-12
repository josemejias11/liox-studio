"""Configuration defaults for the OpenAI-backed parser service."""

import importlib
import os
import sys
import unittest
from pathlib import Path

SERVICE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_ROOT / "src"))


class OpenAISettingsTests(unittest.TestCase):
    def test_uses_openai_model_defaults(self) -> None:
        previous_chat_model = os.environ.pop("OPENAI_CHAT_MODEL", None)
        previous_embedding_model = os.environ.pop("OPENAI_EMBEDDING_MODEL", None)
        try:
            sys.modules.pop("lb_studio_parser.settings", None)
            settings = importlib.import_module("lb_studio_parser.settings")
            self.assertEqual(settings.OPENAI_CHAT_MODEL, "gpt-5.4-mini")
            self.assertEqual(settings.OPENAI_EMBEDDING_MODEL, "text-embedding-3-small")
        finally:
            if previous_chat_model is not None:
                os.environ["OPENAI_CHAT_MODEL"] = previous_chat_model
            if previous_embedding_model is not None:
                os.environ["OPENAI_EMBEDDING_MODEL"] = previous_embedding_model

    def test_embeddings_disabled_by_default(self) -> None:
        previous = os.environ.pop("EMBEDDINGS_ENABLED", None)
        try:
            sys.modules.pop("lb_studio_parser.settings", None)
            settings = importlib.import_module("lb_studio_parser.settings")
            self.assertFalse(settings.EMBEDDINGS_ENABLED)
        finally:
            if previous is not None:
                os.environ["EMBEDDINGS_ENABLED"] = previous

    def test_embeddings_enabled_when_flag_set_true(self) -> None:
        previous = os.environ.get("EMBEDDINGS_ENABLED")
        os.environ["EMBEDDINGS_ENABLED"] = "true"
        try:
            sys.modules.pop("lb_studio_parser.settings", None)
            settings = importlib.import_module("lb_studio_parser.settings")
            self.assertTrue(settings.EMBEDDINGS_ENABLED)
        finally:
            if previous is None:
                os.environ.pop("EMBEDDINGS_ENABLED", None)
            else:
                os.environ["EMBEDDINGS_ENABLED"] = previous


if __name__ == "__main__":
    unittest.main()
