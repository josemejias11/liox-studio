from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from dependencies import verify_api_key
from services.chroma_db import query_db
from services.claude_service import stream_tutor_response

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000)
    deck_id: Optional[UUID] = None
    context_hint: Optional[str] = None


@router.post("/", dependencies=[Depends(verify_api_key)])
async def chat_with_tutor(request: ChatRequest):
    deck_id_str = str(request.deck_id) if request.deck_id else None
    relevant_lessons = query_db(query=request.query, deck_id=deck_id_str, n_results=3)
    context = "\n---\n".join(relevant_lessons) if relevant_lessons else "No relevant context found in the uploaded lessons."

    return StreamingResponse(
        stream_tutor_response(request.query, context, context_hint=request.context_hint),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
