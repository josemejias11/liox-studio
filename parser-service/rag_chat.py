"""RAG chat logic."""

import logging

from runtime import runtime
from settings import NO_CONTEXT_ANSWER, NO_MATERIALS_ANSWER, RETRIEVAL_K_CHAT
from vectorstore import collection_exists, format_context, retrieve_course_documents

logger = logging.getLogger(__name__)


def answer_question(course_id: str, query: str) -> tuple[str, list[str]]:
    """Answer a question from course materials. Returns (answer, sources)."""
    logger.info("Chat query for course: %s", course_id)

    if not collection_exists(course_id):
        return NO_MATERIALS_ANSWER, []

    docs = retrieve_course_documents(course_id, query, k=RETRIEVAL_K_CHAT)

    if not docs:
        return NO_CONTEXT_ANSWER, []

    context_str = format_context(docs)

    prompt = f"""You are an expert AI teaching assistant for a specific course.
Your task is to answer the user's question based strictly on the provided context below.

Rules:
1. Only use the provided context to answer the question.
2. If the context does not contain enough information to answer the question, output EXACTLY: "{NO_CONTEXT_ANSWER}"
3. Do NOT hallucinate. Do NOT use outside knowledge.
4. Be extremely concise and precise. Provide the answer in 1-3 short sentences maximum. Avoid long-winded explanations or filler.
5. Do NOT include any conversational filler, meta-text, or introductions like "Here is an answer". Output ONLY the direct answer.

Context:
{context_str}

Question:
{query}

Answer:"""

    logger.info("Generating response with local LLM...")
    assert runtime.llm is not None
    answer = runtime.llm.invoke(prompt).strip()

    if NO_CONTEXT_ANSWER in answer:
        return NO_CONTEXT_ANSWER, []

    return (
        answer,
        sorted({doc.metadata.get("source", "Unknown") for doc in docs}),
    )
