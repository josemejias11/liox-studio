# Moto AI Parser Service

This is the Python FastAPI microservice for Moto AI. It handles document parsing, generating embeddings, storing chunks in a vector database, and querying a local LLM.

## Prerequisites

1.  Python 3.8+
2.  [Ollama](https://ollama.com/) installed and running locally.
3.  Ollama models downloaded:
    *   `nomic-embed-text`
    *   `llama3`

    *Run these commands to pull the models:*
    ```bash
    ollama pull nomic-embed-text
    ollama pull llama3
    ```

## Setup Instructions

1.  Navigate to the `parser-service` directory.
2.  Activate the virtual environment:
    ```bash
    source venv/bin/activate
    ```
3.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```

## First-time Setup

Copy the example env file and set your token (one-off step before first run):

```bash
cp .env.example .env
# Edit .env and set PARSER_SERVICE_TOKEN to a strong shared secret
```

The service reads `parser-service/.env` automatically via `python-dotenv`. Shell exports always win over the file (`override=False`), so `PARSER_SERVICE_TOKEN=x python main.py` still works as expected.

## Running the Service

Use either of these canonical commands (both always bind to port 8000):

```bash
python main.py
# or
bash run.sh
```

Both commands read an optional `PORT` environment variable (default `8000`) and
will exit immediately with a clear error if `PORT` is set below 1024.

If you need to invoke uvicorn directly (e.g. for production without `--reload`):
```bash
uvicorn main:app --host 127.0.0.1 --port 8000
```

> **Production note:** bind to `127.0.0.1` (not `0.0.0.0`) so the service is
> reachable only from the local Next.js process, not from external network
> interfaces. Never use `--reload` in production — it watches the filesystem
> for changes and is a dev-only flag.

The API will be available at `http://localhost:8000`.
You can view the interactive API documentation (Swagger UI) at `http://localhost:8000/docs`.

## Endpoints

### `POST /api/upload`
Accepts `multipart/form-data`.
*   `course_id`: The ID of the course (string).
*   `file`: The document to upload (PDF, PPTX, DOCX).

### `POST /api/chat`
Accepts `application/json`.
*   `course_id`: The ID of the course (string).
*   `query`: The user's question (string).
