import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import chat, quiz
from services.chroma_db import collection

ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

app = FastAPI(
    title="Deck Converter API",
    description="E-learning platform backend: Converts PPTX to interactive assets.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router)
app.include_router(quiz.router)


@app.get("/")
async def root():
    return {
        "status": "ok",
        "message": "Deck Converter API is running",
        "docs": "/docs"
    }


@app.get("/health")
async def health():
    try:
        doc_count = collection.count()
        return {"status": "ok", "chroma_documents": doc_count}
    except Exception:
        from fastapi import Response
        return Response(
            content='{"status":"degraded","detail":"ChromaDB unreachable"}',
            status_code=503,
            media_type="application/json"
        )
