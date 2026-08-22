"""Provider and vector-store lifecycle for the private parser service."""

import logging
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import chromadb
from fastapi import FastAPI
from langchain_openai import ChatOpenAI, OpenAIEmbeddings

from .settings import (
    CHROMA_DIR,
    OPENAI_API_KEY,
    OPENAI_CHAT_MODEL,
    OPENAI_EMBEDDING_MODEL,
    OPENAI_TIMEOUT_SECONDS,
)

logger = logging.getLogger(__name__)


class Runtime:
    token: str = ""
    embeddings: OpenAIEmbeddings | None = None
    generation_model: ChatOpenAI | None = None
    chroma_client: chromadb.ClientAPI | None = None


runtime = Runtime()


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    logging.basicConfig(level=logging.INFO)
    token = os.environ.get("PARSER_SERVICE_TOKEN")
    if not token:
        raise RuntimeError("PARSER_SERVICE_TOKEN environment variable is not set.")
    if not OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY environment variable is not set.")
    runtime.token = token
    try:
        runtime.embeddings = OpenAIEmbeddings(  # type: ignore[call-arg,arg-type]
            model=OPENAI_EMBEDDING_MODEL,
            api_key=OPENAI_API_KEY,  # type: ignore[arg-type]
            request_timeout=OPENAI_TIMEOUT_SECONDS,
        )
        runtime.generation_model = ChatOpenAI(  # type: ignore[arg-type]
            model=OPENAI_CHAT_MODEL,
            api_key=OPENAI_API_KEY,  # type: ignore[arg-type]
            timeout=OPENAI_TIMEOUT_SECONDS,
            model_kwargs={"response_format": {"type": "json_object"}},
        )
        os.makedirs(CHROMA_DIR, exist_ok=True)
        runtime.chroma_client = chromadb.PersistentClient(path=CHROMA_DIR)
    except Exception:
        logger.exception("Failed to initialize OpenAI clients or ChromaDB at %s.", CHROMA_DIR)
        raise
    yield
