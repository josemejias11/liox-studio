"""Runtime state and client creation."""

import logging
import os
from collections import OrderedDict
from contextlib import asynccontextmanager
from threading import Lock

import chromadb
from fastapi import FastAPI
from langchain_chroma import Chroma
from langchain_ollama import OllamaEmbeddings, OllamaLLM

from settings import (
    CHROMA_DIR,
    EMBEDDING_MODEL,
    LLM_MODEL,
    OLLAMA_BASE_URL,
    OLLAMA_TIMEOUT_SECONDS,
)

logger = logging.getLogger(__name__)


class TaskPrefixedOllamaEmbeddings(OllamaEmbeddings):
    """Adds nomic-style task prefixes when the model expects them."""

    def _wants_prefixes(self) -> bool:
        return self.model.startswith("nomic-embed")

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        if self._wants_prefixes():
            texts = [f"search_document: {t}" for t in texts]
        return super().embed_documents(texts)

    def embed_query(self, text: str) -> list[float]:
        if self._wants_prefixes():
            text = f"search_query: {text}"
        return super().embed_query(text)


class _Runtime:
    token: str = ""
    embeddings: TaskPrefixedOllamaEmbeddings | None = None
    llm: OllamaLLM | None = None
    quiz_llm: OllamaLLM | None = None
    chroma_client: chromadb.ClientAPI | None = None


runtime = _Runtime()

_VECTORSTORE_CACHE_MAXSIZE = int(os.environ.get("VECTORSTORE_CACHE_SIZE", "50"))


class _LRUVectorstoreCache:
    """Thread-safe LRU cache for per-course Chroma vectorstore instances."""

    def __init__(self, maxsize: int = _VECTORSTORE_CACHE_MAXSIZE) -> None:
        self._cache: OrderedDict[str, Chroma] = OrderedDict()
        self._maxsize = maxsize
        self._lock = Lock()

    def get(self, key: str) -> Chroma | None:
        with self._lock:
            if key not in self._cache:
                return None
            self._cache.move_to_end(key)
            return self._cache[key]

    def set(self, key: str, value: Chroma) -> None:
        with self._lock:
            if key in self._cache:
                self._cache.move_to_end(key)
            else:
                if len(self._cache) >= self._maxsize:
                    evicted = next(iter(self._cache))
                    del self._cache[evicted]
                    logger.debug("Evicted vectorstore cache entry: %s", evicted)
            self._cache[key] = value

    def pop(self, key: str) -> None:
        with self._lock:
            self._cache.pop(key, None)

    def clear(self) -> None:
        with self._lock:
            self._cache.clear()


_vectorstore_cache = _LRUVectorstoreCache()


@asynccontextmanager
async def lifespan(_fastapi_app: FastAPI):
    logging.basicConfig(level=logging.INFO)
    token = os.environ.get("PARSER_SERVICE_TOKEN")
    if not token:
        raise RuntimeError(
            "PARSER_SERVICE_TOKEN environment variable is not set. "
            "This service must not run without an internal auth token. "
            "Set PARSER_SERVICE_TOKEN to a strong shared secret and restart."
        )
    runtime.token = token

    try:
        runtime.embeddings = TaskPrefixedOllamaEmbeddings(
            model=EMBEDDING_MODEL,
            base_url=OLLAMA_BASE_URL,
            client_kwargs={"timeout": OLLAMA_TIMEOUT_SECONDS},
        )
        runtime.llm = OllamaLLM(
            model=LLM_MODEL,
            base_url=OLLAMA_BASE_URL,
            client_kwargs={"timeout": OLLAMA_TIMEOUT_SECONDS},
        )
        runtime.quiz_llm = OllamaLLM(
            model=LLM_MODEL,
            base_url=OLLAMA_BASE_URL,
            format="json",
            client_kwargs={"timeout": OLLAMA_TIMEOUT_SECONDS},
        )
        os.makedirs(CHROMA_DIR, exist_ok=True)
        runtime.chroma_client = chromadb.PersistentClient(path=CHROMA_DIR)
    except Exception:
        logger.exception(
            "Failed to initialize Ollama clients or ChromaDB at %s. "
            "Refusing to start.",
            CHROMA_DIR,
        )
        raise

    logger.info(
        "Parser service ready (ollama=%s, llm=%s, embeddings=%s, chroma=%s)",
        OLLAMA_BASE_URL,
        LLM_MODEL,
        EMBEDDING_MODEL,
        CHROMA_DIR,
    )
    yield
