from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from dependencies import verify_api_key
from services.chroma_db import query_db
from services.claude_service import generate_quiz

router = APIRouter(prefix="/quiz", tags=["quiz"])


class QuizRequest(BaseModel):
    topic: str = Field(..., min_length=1, max_length=2000)
    deck_id: Optional[UUID] = None
    num_questions: int = Field(default=3, ge=1, le=20)


@router.post("/", dependencies=[Depends(verify_api_key)])
async def create_quiz(request: QuizRequest):
    deck_id_str = str(request.deck_id) if request.deck_id else None
    relevant_slides = query_db(query=request.topic, deck_id=deck_id_str, n_results=5)

    if not relevant_slides:
        raise HTTPException(status_code=404, detail="No relevant context found to generate a quiz.")

    context = "\n---\n".join(relevant_slides)
    quiz_data = await generate_quiz(context, request.num_questions)

    if "error" in quiz_data:
        raise HTTPException(status_code=500, detail=quiz_data["error"])

    return {"quiz": quiz_data}
