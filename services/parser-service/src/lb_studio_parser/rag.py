"""Source-grounded authoring-draft generation."""

import json
import logging

from pydantic import ValidationError

from .contracts import AssistantQaDraft
from .retrieval import collection_exists, retrieve_course_documents
from .runtime import runtime

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
