"""Revision-bound, validated complete-course draft generation."""

import json
import logging
from typing import Literal

from pydantic import ValidationError

from .contracts import CourseGenerationResponse, GeneratedCourseGraph
from .rag import response_text
from .retrieval import format_context, retrieve_course_documents
from .runtime import runtime
from .settings import OPENAI_CHAT_MODEL

logger = logging.getLogger(__name__)
PROMPT_TEMPLATE_VERSION: Literal["course-generation.v1"] = "course-generation.v1"
GENERATION_MAX_CONTEXT_DOCS = 40


def generate_course(
    course_id: str,
    source_ids: list[str],
    brief: str,
    prompt_template_version: str,
) -> CourseGenerationResponse:
    if prompt_template_version != PROMPT_TEMPLATE_VERSION:
        raise ValueError("Unsupported course-generation prompt template version.")
    documents = retrieve_course_documents(course_id, source_ids, brief, GENERATION_MAX_CONTEXT_DOCS)
    if not documents:
        raise LookupError("No relevant frozen revision sources were found for this brief.")

    context = format_context(documents)
    schema = json.dumps(GeneratedCourseGraph.model_json_schema(by_alias=True), indent=2)
    prompt = f"""Create a complete Course Studio authoring draft from the approved source excerpts.

Rules:
1. Use only facts present in APPROVED SOURCES. Never add outside facts.
2. Follow the AUTHOR BRIEF for emphasis and audience, but not as a factual source.
3. Return only one JSON object matching the schema. Do not use markdown fences.
4. Do not emit IDs, publication state, delivery instructions, or asset URLs.
5. Asset placeholders and quiz answers are author-review suggestions, not approved content.
6. Every lesson must use one of the schema's supported lesson types.

AUTHOR BRIEF:
{brief}

APPROVED SOURCES:
{context}

JSON SCHEMA:
{schema}
"""

    last_error: Exception | None = None
    for attempt in range(2):
        try:
            if runtime.generation_model is None:
                raise RuntimeError("The course-generation model is not initialized.")
            raw = response_text(runtime.generation_model.invoke(prompt))
            graph = GeneratedCourseGraph.model_validate(json.loads(raw))
            return CourseGenerationResponse(
                graph=graph,
                model_identifier=OPENAI_CHAT_MODEL,
                prompt_template_version=PROMPT_TEMPLATE_VERSION,
            )
        except (json.JSONDecodeError, ValidationError, TypeError) as error:
            last_error = error
            logger.warning("Course output failed validation on attempt %d: %s", attempt + 1, error)
    raise RuntimeError(
        "The language model did not return a complete valid course. Please try again."
    ) from last_error
