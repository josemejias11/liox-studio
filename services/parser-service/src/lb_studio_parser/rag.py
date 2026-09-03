"""Source-grounded authoring-draft and supplemental quiz generation."""

import hashlib
import json
import logging

from langchain_core.documents import Document
from pydantic import ValidationError

from .contracts import AssistantQaDraft, QuizPayload
from .retrieval import collection_exists, format_context, retrieve_course_documents
from .runtime import runtime
from .settings import (
    QUIZ_MAX_CONTEXT_DOCS,
    RETRIEVAL_K_PER_TOPIC,
)

logger = logging.getLogger(__name__)


def response_text(response: object) -> str:
    """Return text content from a LangChain chat-model response."""
    content = getattr(response, "content", response)
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(
            item if isinstance(item, str) else str(item.get("text", "")) for item in content
        )
    return str(content)


def generate_assistant_qa(course_id: str, source_ids: list[str]) -> list[AssistantQaDraft]:
    if not source_ids or not collection_exists(course_id):
        raise LookupError("No indexed course sources are available for assistant Q&A.")
    documents = retrieve_course_documents(
        course_id, source_ids, "key concepts procedures specifications", 30
    )
    if not documents:
        raise LookupError("No relevant indexed material is available for assistant Q&A.")
    sources = "\n\n".join(
        f"SOURCE_ID: {doc.metadata.get('source_id')}\nLABEL: {doc.metadata.get('source')}\nEXCERPT: {doc.page_content[:900]}"
        for doc in documents
    )
    schema = json.dumps({"drafts": [AssistantQaDraft.model_json_schema(by_alias=True)]}, indent=2)
    prompt = f"""Create 5-12 course assistant Q&A drafts using only these selected indexed sources.
Every answer must be concise, learner-ready, and directly supported by a citation. Each citation must use the supplied SOURCE_ID and LABEL and quote a short source excerpt. Return only JSON matching the schema. These are author drafts, not approved learner content.

SELECTED SOURCES:
{sources}

JSON SCHEMA:
{schema}"""
    assert runtime.generation_model is not None
    try:
        raw = response_text(runtime.generation_model.invoke(prompt))
        data = json.loads(raw)
        return [AssistantQaDraft.model_validate(item) for item in data["drafts"]]
    except (json.JSONDecodeError, KeyError, ValidationError, TypeError) as error:
        raise RuntimeError(
            "The language model did not return valid assistant Q&A drafts."
        ) from error


def generate_quiz(course_id: str, source_ids: list[str], weak_topics: list[str]) -> list[dict]:
    logger.info("Revision-bound quiz request: course=%s topics=%s", course_id, weak_topics)
    if not source_ids:
        raise LookupError("No revision sources are available to generate a quiz.")
    if not collection_exists(course_id):
        raise LookupError("No materials found for this course to generate a quiz.")
    documents: list[Document] = []
    seen: set[str] = set()
    for topic in weak_topics:
        for document in retrieve_course_documents(
            course_id, source_ids, topic, RETRIEVAL_K_PER_TOPIC
        ):
            key = hashlib.sha256(document.page_content.encode()).hexdigest()
            if key not in seen:
                seen.add(key)
                documents.append(document)
    documents = documents[:QUIZ_MAX_CONTEXT_DOCS]
    if not documents:
        raise LookupError("No relevant course materials found for the requested topics.")
    context_str = format_context(documents)
    prompt = f"""You are an expert AI teaching assistant.
Your task is to generate a 5-question multiple-choice quiz based strictly on the provided context below. The quiz should focus on these weak topics: {", ".join(weak_topics)}.

Rules:
1. Only use the provided context to create the questions.
2. Generate exactly 5 questions.
3. Each question must have exactly 4 options.
4. Each question must specify the index (0, 1, 2, or 3) of the correct answer.
5. Output ONLY a JSON object matching this exact schema:

{{
  "questions": [
    {{
      "question": "The text of the question?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer_index": 0
    }}
  ]
}}

Context:
{context_str}

Output the JSON object now:"""
    last_error: Exception | None = None
    for attempt in range(2):
        logger.info("Generating quiz with OpenAI (attempt %d)...", attempt + 1)
        assert runtime.generation_model is not None
        try:
            parsed = json.loads(response_text(runtime.generation_model.invoke(prompt)))
            questions = parsed.get("questions") if isinstance(parsed, dict) else None
            if isinstance(questions, list) and len(questions) > 5:
                questions = questions[:5]
            return [
                question.model_dump()
                for question in QuizPayload.model_validate({"questions": questions}).questions
            ]
        except (ValueError, ValidationError, AttributeError) as error:
            last_error = error
            logger.warning("Quiz output failed validation on attempt %d: %s", attempt + 1, error)
    logger.error("Quiz generation failed after retry: %s", last_error)
    raise RuntimeError(
        "The language model did not return a valid quiz. Please try again."
    ) from last_error
