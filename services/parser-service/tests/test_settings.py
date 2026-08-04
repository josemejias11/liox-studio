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
            sys.modules.pop("moto_parser.settings", None)
            settings = importlib.import_module("moto_parser.settings")
            self.assertEqual(settings.OPENAI_CHAT_MODEL, "gpt-5.4-mini")
            self.assertEqual(settings.OPENAI_EMBEDDING_MODEL, "text-embedding-3-small")
        finally:
            if previous_chat_model is not None:
                os.environ["OPENAI_CHAT_MODEL"] = previous_chat_model
            if previous_embedding_model is not None:
                os.environ["OPENAI_EMBEDDING_MODEL"] = previous_embedding_model


if __name__ == "__main__":
    unittest.main()
