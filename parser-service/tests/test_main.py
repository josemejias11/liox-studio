"""Moto AI Parser Service — unit tests.

Run from the parser-service directory:
    pytest tests/ -v

All heavy dependencies (Ollama, ChromaDB, MarkItDown) are mocked out.
The lifespan is bypassed by patching at the class level before TestClient
starts, then the autouse fixture wires fresh mocks into the runtime object
for every test.
"""

import io
import json
import os
import sys
from unittest.mock import MagicMock, patch

import pytest
from langchain_core.documents import Document
from starlette.testclient import TestClient

# Ensure the package root is on the path when running from repo root.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import main

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

VALID_TOKEN = "test-internal-token-abc123"
AUTH = {"X-Internal-Token": VALID_TOKEN}
BAD_AUTH = {"X-Internal-Token": "wrong-token"}
COURSE = "test-course-01"  # satisfies COURSE_ID_PATTERN


def _doc(content: str = "Course material text.", source: str = "notes.pdf") -> Document:
    return Document(page_content=content, metadata={"source": source, "course_id": COURSE})


def _quiz_json(n: int = 5) -> str:
    return json.dumps({
        "questions": [
            {
                "question": f"Question {i}?",
                "options": ["A", "B", "C", "D"],
                "correct_answer_index": 0,
            }
            for i in range(n)
        ]
    })


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def client():
    """Single TestClient for the module; lifespan deps are mocked at startup."""
    with (
        patch.dict(os.environ, {"PARSER_SERVICE_TOKEN": VALID_TOKEN, "CHROMA_DIR": "/tmp/test-chroma"}),
        patch("runtime.TaskPrefixedOllamaEmbeddings"),
        patch("runtime.OllamaLLM"),
        patch("runtime.chromadb.PersistentClient"),
        patch("runtime.os.makedirs"),
    ):
        with TestClient(main.app, raise_server_exceptions=False) as c:
            yield c


@pytest.fixture(autouse=True)
def reset_runtime():
    """Inject fresh mocks into the runtime global before every test."""
    main.runtime.token = VALID_TOKEN
    main.runtime.chroma_client = MagicMock()
    main.runtime.embeddings = MagicMock()
    main.runtime.llm = MagicMock()
    main.runtime.quiz_llm = MagicMock()
    main._vectorstore_cache.clear()
    yield


# ---------------------------------------------------------------------------
# GET /health
# ---------------------------------------------------------------------------

class TestHealth:
    def test_returns_200(self, client):
        with patch("main.httpx.get") as mock_get, patch("runtime.os.makedirs"), patch("builtins.open", MagicMock()), patch("main.os.remove"):
            mock_get.return_value = MagicMock(status_code=200)
            resp = client.get("/health")
        assert resp.status_code == 200

    def test_response_contains_required_fields(self, client):
        with patch("main.httpx.get") as mock_get, patch("runtime.os.makedirs"), patch("builtins.open", MagicMock()), patch("main.os.remove"):
            mock_get.return_value = MagicMock(status_code=200)
            resp = client.get("/health")
        body = resp.json()
        assert "status" in body
        assert "ollama_reachable" in body
        assert "chroma_dir_writable" in body
        assert "llm_model" in body
        assert "embedding_model" in body

    def test_degraded_when_ollama_unreachable(self, client):
        import httpx as _httpx
        with patch("main.httpx.get", side_effect=_httpx.ConnectError("refused")), \
             patch("runtime.os.makedirs"), patch("builtins.open", MagicMock()), patch("main.os.remove"):
            resp = client.get("/health")
        assert resp.json()["status"] == "degraded"
        assert resp.json()["ollama_reachable"] is False


# ---------------------------------------------------------------------------
# Authentication — enforced on all mutating endpoints
# ---------------------------------------------------------------------------

PROTECTED_CALLS = [
    ("POST", "/api/upload", None),
    ("POST", "/api/chat", {"json": {"course_id": COURSE, "query": "hi"}}),
    ("POST", "/api/generate-quiz", {"json": {"course_id": COURSE, "weak_topics": ["topic"]}}),
    ("DELETE", "/api/document", {"json": {"course_id": COURSE, "filename": "f.pdf"}}),
]


class TestAuth:
    @pytest.mark.parametrize("method,path,kwargs", PROTECTED_CALLS)
    def test_missing_token_returns_401(self, client, method, path, kwargs):
        resp = client.request(method, path, **(kwargs or {}))
        assert resp.status_code == 401

    @pytest.mark.parametrize("method,path,kwargs", PROTECTED_CALLS)
    def test_wrong_token_returns_401(self, client, method, path, kwargs):
        extra = dict(kwargs or {})
        extra.setdefault("headers", {}).update(BAD_AUTH)
        resp = client.request(method, path, **extra)
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# POST /api/upload
# ---------------------------------------------------------------------------

class TestUpload:
    def _pdf_file(self, size: int = 100) -> dict:
        return {"file": ("test.pdf", io.BytesIO(b"%" * size), "application/pdf")}

    def test_invalid_course_id_returns_422(self, client):
        resp = client.post(
            "/api/upload",
            headers=AUTH,
            data={"course_id": "x"},  # too short, fails COURSE_ID_PATTERN
            files=self._pdf_file(),
        )
        assert resp.status_code == 422

    def test_unsupported_file_type_returns_400(self, client):
        resp = client.post(
            "/api/upload",
            headers=AUTH,
            data={"course_id": COURSE},
            files={"file": ("notes.txt", io.BytesIO(b"hello"), "text/plain")},
        )
        assert resp.status_code == 400
        assert "Unsupported file type" in resp.json()["detail"]

    def test_empty_extracted_content_returns_400(self, client):
        mock_result = MagicMock()
        mock_result.text_content = "   "
        with patch("documents.MarkItDown") as MockMD, patch("main.shutil.rmtree"):
            MockMD.return_value.convert.return_value = mock_result
            resp = client.post(
                "/api/upload",
                headers=AUTH,
                data={"course_id": COURSE},
                files=self._pdf_file(),
            )
        assert resp.status_code == 400
        assert "extract text" in resp.json()["detail"]

    def test_successful_upload_returns_chunks_stored(self, client):
        mock_result = MagicMock()
        mock_result.text_content = "This is valid course content. " * 50
        mock_vs = MagicMock()
        with patch("documents.MarkItDown") as MockMD, \
             patch("vectorstore.get_vectorstore", return_value=mock_vs), \
             patch("main.shutil.rmtree"):
            MockMD.return_value.convert.return_value = mock_result
            resp = client.post(
                "/api/upload",
                headers=AUTH,
                data={"course_id": COURSE},
                files=self._pdf_file(),
            )
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "success"
        assert body["filename"] == "test.pdf"
        assert body["chunks_stored"] > 0

    def test_reuploading_same_file_deletes_previous_chunks(self, client):
        mock_result = MagicMock()
        mock_result.text_content = "Content. " * 50
        mock_vs = MagicMock()
        with patch("documents.MarkItDown") as MockMD, \
             patch("vectorstore.get_vectorstore", return_value=mock_vs), \
             patch("main.shutil.rmtree"):
            MockMD.return_value.convert.return_value = mock_result
            client.post(
                "/api/upload",
                headers=AUTH,
                data={"course_id": COURSE},
                files=self._pdf_file(),
            )
        # delete(where={"source": original_filename}) must have been called
        mock_vs._collection.delete.assert_called_once_with(where={"source": "test.pdf"})

    def test_file_too_large_returns_413(self, client):
        # Patch the limit to 100 bytes so the test doesn't allocate/write 50 MB.
        with patch.object(main, "MAX_UPLOAD_BYTES", 100):
            resp = client.post(
                "/api/upload",
                headers=AUTH,
                data={"course_id": COURSE},
                files={"file": ("big.pdf", io.BytesIO(b"x" * 200), "application/pdf")},
            )
        assert resp.status_code == 413


# ---------------------------------------------------------------------------
# POST /api/chat
# ---------------------------------------------------------------------------

class TestChat:
    def test_unknown_course_returns_no_materials_answer(self, client):
        with patch("rag_chat.collection_exists", return_value=False):
            resp = client.post("/api/chat", headers=AUTH, json={"course_id": COURSE, "query": "What is Qira?"})
        assert resp.status_code == 200
        assert main.NO_MATERIALS_ANSWER in resp.json()["answer"]
        assert resp.json()["sources"] == []

    def test_no_relevant_docs_returns_no_context_answer(self, client):
        mock_vs = MagicMock()
        mock_vs.similarity_search_with_relevance_scores.return_value = []
        with patch("rag_chat.collection_exists", return_value=True), \
             patch("rag_chat.get_vectorstore", return_value=mock_vs):
            resp = client.post("/api/chat", headers=AUTH, json={"course_id": COURSE, "query": "Unknown topic"})
        assert resp.status_code == 200
        assert resp.json()["answer"] == main.NO_CONTEXT_ANSWER

    def test_successful_chat_returns_answer_and_sources(self, client):
        mock_vs = MagicMock()
        mock_vs.similarity_search_with_relevance_scores.return_value = [
            (_doc("Qira can generate images.", "slides.pdf"), 0.82),
        ]
        main.runtime.llm.invoke.return_value = "Qira generates images using AI."
        with patch("rag_chat.collection_exists", return_value=True), \
             patch("rag_chat.get_vectorstore", return_value=mock_vs):
            resp = client.post("/api/chat", headers=AUTH, json={"course_id": COURSE, "query": "What can Qira do?"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["answer"] == "Qira generates images using AI."
        assert "slides.pdf" in body["sources"]

    def test_query_too_long_returns_422(self, client):
        resp = client.post(
            "/api/chat",
            headers=AUTH,
            json={"course_id": COURSE, "query": "q" * 2001},
        )
        assert resp.status_code == 422

    def test_llm_no_context_response_omits_sources(self, client):
        mock_vs = MagicMock()
        mock_vs.similarity_search_with_relevance_scores.return_value = [
            (_doc(), 0.75),
        ]
        main.runtime.llm.invoke.return_value = main.NO_CONTEXT_ANSWER
        with patch("rag_chat.collection_exists", return_value=True), \
             patch("rag_chat.get_vectorstore", return_value=mock_vs):
            resp = client.post("/api/chat", headers=AUTH, json={"course_id": COURSE, "query": "Unrelated?"})
        assert resp.json()["sources"] == []


# ---------------------------------------------------------------------------
# POST /api/generate-quiz
# ---------------------------------------------------------------------------

class TestGenerateQuiz:
    def test_unknown_course_returns_404(self, client):
        with patch("quiz_generation.collection_exists", return_value=False):
            resp = client.post("/api/generate-quiz", headers=AUTH, json={"course_id": COURSE, "weak_topics": ["AI"]})
        assert resp.status_code == 404

    def test_no_relevant_docs_returns_404(self, client):
        mock_vs = MagicMock()
        mock_vs.similarity_search_with_relevance_scores.return_value = []
        with patch("quiz_generation.collection_exists", return_value=True), \
             patch("quiz_generation.get_vectorstore", return_value=mock_vs):
            resp = client.post("/api/generate-quiz", headers=AUTH, json={"course_id": COURSE, "weak_topics": ["AI"]})
        assert resp.status_code == 404

    def test_successful_quiz_returns_five_questions(self, client):
        mock_vs = MagicMock()
        mock_vs.similarity_search_with_relevance_scores.return_value = [
            (_doc(), 0.70),
        ]
        main.runtime.quiz_llm.invoke.return_value = _quiz_json(5)
        with patch("quiz_generation.collection_exists", return_value=True), \
             patch("quiz_generation.get_vectorstore", return_value=mock_vs):
            resp = client.post("/api/generate-quiz", headers=AUTH, json={"course_id": COURSE, "weak_topics": ["Style Sync"]})
        assert resp.status_code == 200
        questions = resp.json()["questions"]
        assert len(questions) == 5
        assert all(len(q["options"]) == 4 for q in questions)

    def test_bad_llm_json_retries_and_returns_502(self, client):
        mock_vs = MagicMock()
        mock_vs.similarity_search_with_relevance_scores.return_value = [(_doc(), 0.70)]
        main.runtime.quiz_llm.invoke.return_value = "not json at all"
        with patch("quiz_generation.collection_exists", return_value=True), \
             patch("quiz_generation.get_vectorstore", return_value=mock_vs):
            resp = client.post("/api/generate-quiz", headers=AUTH, json={"course_id": COURSE, "weak_topics": ["topic"]})
        assert resp.status_code == 502
        # Confirm it tried twice
        assert main.runtime.quiz_llm.invoke.call_count == 2

    def test_llm_returning_more_than_five_questions_is_trimmed(self, client):
        mock_vs = MagicMock()
        mock_vs.similarity_search_with_relevance_scores.return_value = [(_doc(), 0.70)]
        main.runtime.quiz_llm.invoke.return_value = _quiz_json(8)
        with patch("quiz_generation.collection_exists", return_value=True), \
             patch("quiz_generation.get_vectorstore", return_value=mock_vs):
            resp = client.post("/api/generate-quiz", headers=AUTH, json={"course_id": COURSE, "weak_topics": ["topic"]})
        assert resp.status_code == 200
        assert len(resp.json()["questions"]) == 5

    def test_empty_weak_topics_returns_422(self, client):
        resp = client.post("/api/generate-quiz", headers=AUTH, json={"course_id": COURSE, "weak_topics": []})
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# DELETE /api/document
# ---------------------------------------------------------------------------

def _delete(client, headers, body: dict):
    """Send a DELETE with a JSON body (Starlette TestClient lacks json= on delete)."""
    return client.request(
        "DELETE",
        "/api/document",
        headers={**headers, "Content-Type": "application/json"},
        content=json.dumps(body),
    )


class TestDeleteDocument:
    def test_unknown_course_returns_not_found_status(self, client):
        with patch("main.collection_exists", return_value=False):
            resp = _delete(client, AUTH, {"course_id": COURSE, "filename": "notes.pdf"})
        assert resp.status_code == 200
        assert resp.json()["status"] == "not_found"

    def test_successful_delete_returns_deleted_status(self, client):
        mock_vs = MagicMock()
        with patch("main.collection_exists", return_value=True), \
             patch("main.get_vectorstore", return_value=mock_vs):
            resp = _delete(client, AUTH, {"course_id": COURSE, "filename": "notes.pdf"})
        assert resp.status_code == 200
        assert resp.json()["status"] == "deleted"
        mock_vs._collection.delete.assert_called_once_with(where={"source": "notes.pdf"})

    def test_delete_evicts_vectorstore_cache(self, client):
        mock_vs = MagicMock()
        main._vectorstore_cache.set(COURSE, mock_vs)
        assert main._vectorstore_cache.get(COURSE) is not None

        with patch("main.collection_exists", return_value=True), \
             patch("main.get_vectorstore", return_value=mock_vs):
            _delete(client, AUTH, {"course_id": COURSE, "filename": "notes.pdf"})

        assert main._vectorstore_cache.get(COURSE) is None

    def test_invalid_course_id_returns_422(self, client):
        resp = _delete(client, AUTH, {"course_id": "x", "filename": "f.pdf"})
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# collection_exists — error discrimination
# ---------------------------------------------------------------------------

class TestCollectionExists:
    def test_returns_true_when_collection_found(self):
        main.runtime.chroma_client.get_collection.return_value = MagicMock()
        assert main.collection_exists(COURSE) is True

    def test_returns_false_for_not_found_error(self):
        main.runtime.chroma_client.get_collection.side_effect = Exception("Collection test-course-01 does not exist.")
        assert main.collection_exists(COURSE) is False

    def test_reraises_unexpected_storage_errors(self):
        main.runtime.chroma_client.get_collection.side_effect = OSError("disk full")
        with pytest.raises(OSError):
            main.collection_exists(COURSE)


# ---------------------------------------------------------------------------
# build_text_splitter — chunking is env-configurable
# ---------------------------------------------------------------------------

class TestBuildTextSplitter:
    def test_uses_configured_chunk_size_and_overlap(self):
        with patch.object(main, "CHUNK_SIZE", 300), patch.object(main, "CHUNK_OVERLAP", 50):
            splitter = main.build_text_splitter()
        assert splitter._chunk_size == 300
        assert splitter._chunk_overlap == 50

    def test_defaults_match_documented_values(self):
        splitter = main.build_text_splitter()
        assert splitter._chunk_size == main.CHUNK_SIZE
        assert splitter._chunk_overlap == main.CHUNK_OVERLAP


# ---------------------------------------------------------------------------
# _LRUVectorstoreCache
# ---------------------------------------------------------------------------

class TestLRUVectorstoreCache:
    def _cache(self, maxsize: int = 3) -> main._LRUVectorstoreCache:
        return main._LRUVectorstoreCache(maxsize=maxsize)

    def test_set_and_get(self):
        c = self._cache()
        vs = MagicMock()
        c.set("a", vs)
        assert c.get("a") is vs

    def test_get_missing_returns_none(self):
        assert self._cache().get("missing") is None

    def test_evicts_lru_entry_when_full(self):
        c = self._cache(maxsize=2)
        a, b, d = MagicMock(), MagicMock(), MagicMock()
        c.set("a", a)
        c.set("b", b)
        c.set("d", d)  # should evict "a"
        assert c.get("a") is None
        assert c.get("b") is b
        assert c.get("d") is d

    def test_accessing_entry_prevents_eviction(self):
        c = self._cache(maxsize=2)
        a, b, d = MagicMock(), MagicMock(), MagicMock()
        c.set("a", a)
        c.set("b", b)
        c.get("a")     # touch "a" → moves it to MRU position
        c.set("d", d)  # should evict "b", not "a"
        assert c.get("a") is a
        assert c.get("b") is None

    def test_pop_removes_entry(self):
        c = self._cache()
        c.set("a", MagicMock())
        c.pop("a")
        assert c.get("a") is None

    def test_pop_nonexistent_is_safe(self):
        c = self._cache()
        c.pop("nonexistent")  # must not raise

    def test_clear_empties_cache(self):
        c = self._cache()
        c.set("a", MagicMock())
        c.set("b", MagicMock())
        c.clear()
        assert c.get("a") is None
        assert c.get("b") is None
