import os
import shutil
import tempfile
import logging
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from markitdown import MarkItDown
from langchain_community.embeddings import OllamaEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_community.llms import Ollama
from langchain_text_splitters import RecursiveCharacterTextSplitter

# Initialize Logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Constants
CHROMA_PERSIST_DIR = "./chroma_db"
EMBEDDING_MODEL = "nomic-embed-text"
LLM_MODEL = "llama3"

# Initialize FastAPI App
app = FastAPI(
    title="Moto AI Parser Service",
    description="Microservice to parse course documents and chat using local LLM",
    version="1.0.0"
)

# Enable CORS for Next.js frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this to the Next.js app's URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Models
try:
    embeddings = OllamaEmbeddings(model=EMBEDDING_MODEL)
    llm = Ollama(model=LLM_MODEL)
except Exception as e:
    logger.error(f"Failed to initialize Ollama models. Ensure Ollama is running: {e}")

class ChatRequest(BaseModel):
    course_id: str
    query: str

class QuizRequest(BaseModel):
    course_id: str
    weak_topics: list[str]

@app.post("/api/upload")
async def upload_file(course_id: str = Form(...), file: UploadFile = File(...)):
    """
    Accepts a file and course_id. Parses the file using markitdown, splits it into chunks,
    and stores embeddings in a ChromaDB collection specific to the course_id.
    """
    logger.info(f"Received upload request for course: {course_id}, file: {file.filename}")
    
    # Check allowed extensions (PDF, PPTX, DOCX)
    allowed_extensions = {".pdf", ".pptx", ".docx"}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_extensions:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported file type. Allowed types: {', '.join(allowed_extensions)}"
        )

    # Save uploaded file temporarily
    temp_dir = tempfile.mkdtemp()
    temp_file_path = os.path.join(temp_dir, file.filename)
    
    try:
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Parse the file using MarkItDown
        logger.info("Parsing file with MarkItDown...")
        md = MarkItDown()
        result = md.convert(temp_file_path)
        text_content = result.text_content
        
        if not text_content or not text_content.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from the file.")
            
        # Split text into chunks
        logger.info("Splitting text into chunks...")
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            separators=["\n\n", "\n", " ", ""]
        )
        chunks = text_splitter.split_text(text_content)
        
        # Store in ChromaDB
        logger.info(f"Storing {len(chunks)} chunks in ChromaDB (collection: {course_id})...")
        vectorstore = Chroma(
            collection_name=course_id,
            embedding_function=embeddings,
            persist_directory=CHROMA_PERSIST_DIR
        )
        
        # Adding texts with basic metadata
        metadatas = [{"source": file.filename, "course_id": course_id} for _ in chunks]
        vectorstore.add_texts(texts=chunks, metadatas=metadatas)
        
        logger.info("Upload and processing complete.")
        return {
            "message": "File successfully parsed and embedded.",
            "course_id": course_id,
            "chunks_processed": len(chunks)
        }

    except Exception as e:
        logger.error(f"Error processing file: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error processing file: {str(e)}")
    
    finally:
        # Cleanup temporary files
        shutil.rmtree(temp_dir, ignore_errors=True)

@app.post("/api/chat")
async def chat(request: ChatRequest):
    """
    Accepts course_id and query. Retrieves top context chunks from ChromaDB and 
    uses local Ollama LLM to answer the query strictly based on context.
    """
    logger.info(f"Received chat query for course: {request.course_id}")
    
    try:
        # Load the specific course collection from ChromaDB
        vectorstore = Chroma(
            collection_name=request.course_id,
            embedding_function=embeddings,
            persist_directory=CHROMA_PERSIST_DIR
        )
        
        # Retrieve top 5 most relevant chunks
        logger.info("Retrieving relevant context from ChromaDB...")
        docs = vectorstore.similarity_search(request.query, k=5)
        
        if not docs:
            # If the collection is empty or doesn't exist, Chroma typically returns an empty list
            return {
                "answer": "No materials have been uploaded for this course yet, so I cannot answer your question."
            }
            
        # Combine documents into context string
        context_texts = [f"--- Source: {doc.metadata.get('source', 'Unknown')} ---\n{doc.page_content}" for doc in docs]
        context_str = "\n\n".join(context_texts)
        
        # Construct strict system prompt
        prompt = f"""You are an expert AI teaching assistant for a specific course.
Your task is to answer the user's question based strictly on the provided context below.

Rules:
1. Only use the provided context to answer the question.
2. If the context does not contain enough information to answer the question, output EXACTLY: "I do not have enough information to answer this question based on the course materials."
3. Do NOT hallucinate. Do NOT use outside knowledge.
4. Keep your answer clear, concise, and educational.

Context:
{context_str}

Question:
{request.query}

Answer:"""

        # Query Local LLM
        logger.info("Generating response with local LLM...")
        response = llm.invoke(prompt)
        
        return {
            "answer": response.strip(),
            "sources": list(set([doc.metadata.get("source", "Unknown") for doc in docs]))
        }
        
    except Exception as e:
        logger.error(f"Error during chat generation: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error generating response: {str(e)}")

@app.post("/api/generate-quiz")
async def generate_quiz(request: QuizRequest):
    """
    Accepts course_id and a list of weak_topics. Retrieves context from ChromaDB
    and uses local Ollama LLM to generate a 5-question multiple-choice quiz
    strictly in JSON format.
    """
    import json
    logger.info(f"Received quiz generation request for course: {request.course_id}, topics: {request.weak_topics}")
    
    try:
        if not request.weak_topics:
            raise HTTPException(status_code=400, detail="List of weak_topics cannot be empty.")

        # Load the specific course collection from ChromaDB
        vectorstore = Chroma(
            collection_name=request.course_id,
            embedding_function=embeddings,
            persist_directory=CHROMA_PERSIST_DIR
        )
        
        # Formulate a search query from weak topics
        search_query = " ".join(request.weak_topics)
        
        # Retrieve top 10 most relevant chunks to get broad context
        logger.info(f"Retrieving relevant context for topics: {search_query}...")
        docs = vectorstore.similarity_search(search_query, k=10)
        
        if not docs:
            raise HTTPException(status_code=404, detail="No materials found for this course to generate a quiz.")
            
        # Combine documents into context string
        context_texts = [f"--- Source: {doc.metadata.get('source', 'Unknown')} ---\n{doc.page_content}" for doc in docs]
        context_str = "\n\n".join(context_texts)
        
        # Construct strict system prompt for JSON generation
        prompt = f"""You are an expert AI teaching assistant.
Your task is to generate a 5-question multiple-choice quiz based strictly on the provided context below. The quiz should focus on these weak topics: {', '.join(request.weak_topics)}.

Rules:
1. Only use the provided context to create the questions.
2. Generate exactly 5 questions.
3. Each question must have exactly 4 options.
4. Each question must specify the index (0, 1, 2, or 3) of the correct answer.
5. You MUST output ONLY valid JSON. Do NOT include any markdown formatting like ```json. Do NOT include any conversational text.

The JSON output must be a list of objects with the following schema:
[
  {{
    "question": "The text of the question?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct_answer_index": 0
  }},
  ...
]

Context:
{context_str}

Output JSON ONLY:"""

        # Query Local LLM
        logger.info("Generating quiz with local LLM...")
        response = llm.invoke(prompt)
        
        # Clean up response to extract only JSON, in case the LLM ignored formatting rules
        response_text = response.strip()
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        response_text = response_text.strip()
            
        # Parse JSON
        try:
            quiz_data = json.loads(response_text)
            # Basic validation
            if not isinstance(quiz_data, list):
                raise ValueError("JSON is not a list")
            
            return {
                "quiz": quiz_data,
                "sources": list(set([doc.metadata.get("source", "Unknown") for doc in docs]))
            }
        except json.JSONDecodeError as json_err:
            logger.error(f"Failed to parse LLM response as JSON. Response: {response_text}. Error: {json_err}")
            raise HTTPException(status_code=500, detail="The AI failed to generate a valid JSON quiz. Please try again.")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error during quiz generation: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error generating quiz: {str(e)}")

@app.get("/health")
async def health_check():
    """Simple health check endpoint"""
    return {"status": "ok", "service": "moto-ai-parser"}
