"""Quiz generation logic."""

import hashlib
import json
import logging

from pydantic import ValidationError

from contracts import QuizPayload
from runtime import runtime
from settings import QUIZ_MAX_CONTEXT_DOCS, RETRIEVAL_K_PER_TOPIC
from vectorstore import collection_exists, format_context, retrieve_course_documents

logger = logging.getLogger(__name__)


def generate_quiz(course_id: str, weak_topics: list[str]) -> list[dict]:
    """Generate a 5-question quiz targeting weak topics. Returns list of question dicts."""
    logger.info("Quiz generation request: course=%s topics=%s", course_id, weak_topics)

    if not collection_exists(course_id):
        raise LookupError("No materials found for this course to generate a quiz.")

    # Retrieve per weak topic, then merge and dedupe.
    docs = []
    seen: set[str] = set()
    for topic in weak_topics:
        for doc in retrieve_course_documents(course_id, topic, k=RETRIEVAL_K_PER_TOPIC):
            key = hashlib.sha256(doc.page_content.encode("utf-8")).hexdigest()
            if key not in seen:
                seen.add(key)
                docs.append(doc)
    docs = docs[:QUIZ_MAX_CONTEXT_DOCS]

    if not docs:
        raise LookupError("No relevant course materials found for the requested topics.")

    context_str = format_context(docs)

    prompt = f"""You are an expert AI teaching assistant.
Your task is to generate a 5-question multiple-choice quiz based strictly on the provided context below. The quiz should focus on these weak topics: {', '.join(weak_topics)}.

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
        logger.info("Generating quiz with local LLM (attempt %d)...", attempt + 1)
        assert runtime.quiz_llm is not None
        response = runtime.quiz_llm.invoke(prompt)
        try:
            parsed = json.loads(response)
            questions = parsed.get("questions") if isinstance(parsed, dict) else None
            if isinstance(questions, list) and len(questions) > 5:
                questions = questions[:5]
            validated = QuizPayload.model_validate({"questions": questions})
            return [q.model_dump() for q in validated.questions]
        except (ValueError, ValidationError, AttributeError) as e:
            last_error = e
            logger.warning("Quiz output failed validation on attempt %d: %s", attempt + 1, e)

    logger.error("Quiz generation failed after retry: %s", last_error)
    raise RuntimeError("The language model did not return a valid quiz. Please try again.")
