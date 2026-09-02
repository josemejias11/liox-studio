# Lionbridge Course Studio Parser Service

The parser service is Lionbridge Course Studio's internal FastAPI service for source parsing,
embedding, source-grounded authoring drafts, and supplemental quiz-draft
generation. It is called by the Next.js backend and background worker;
browsers never call it directly. OpenAI is the language-model and embedding
provider behind this service boundary; browsers never receive the API key.
Ollama and other local-model runtimes are not supported: this service does not
download, start, or connect to a local model.

## Quick start

Requirements: Python 3.11+ and an OpenAI API project with billing enabled.

```bash
cd services/parser-service
python3 -m venv venv
source venv/bin/activate
pip install -e '.[dev]'
cp .env.example .env
# Set OPENAI_API_KEY and match PARSER_SERVICE_TOKEN to the root .env.local.
lb-studio-parser
```

The development server listens on `http://127.0.0.1:8000` by default. Check
readiness with `curl http://127.0.0.1:8000/health`; when enabled, Swagger is at
`http://127.0.0.1:8000/docs`.

`python -m lb_studio_parser` starts the same reload-enabled development server.

## Endpoints

| Method   | Path                         | Purpose                                                           |
| -------- | ---------------------------- | ----------------------------------------------------------------- |
| `POST`   | `/api/upload`                | Index one immutable source ID and its SHA-256.                    |
| `POST`   | `/api/generate-assistant-qa` | Draft source-cited Course Assistant Q&A for author approval.      |
| `POST`   | `/api/generate-quiz`         | Generate a supplemental quiz from explicit revision sources.      |
| `POST`   | `/api/generate-course`       | Generate an editable course draft from explicit revision sources. |
| `DELETE` | `/api/document`              | Delete chunks for one source ID.                                  |
| `GET`    | `/health`                    | Report OpenAI configuration and Chroma readiness.                 |

All endpoints except `/health` require `X-Internal-Token`.

Pydantic models in `src/lb_studio_parser/contracts.py` own the parser service's HTTP
validation. The TypeScript parser client validates every untrusted HTTP
response again; course-generation responses use the canonical schema in
`packages/contracts`, while endpoint-specific transport responses remain local
to the client. Keep those field names and bounds aligned when changing the API.

Generation requests always carry explicit source IDs. An empty `source_ids`
list never expands to the course corpus: retrieval returns no context. Uploads
carry `source_id` and `sha256` multipart fields, and every Chroma chunk stores
`course_id`, `source_id`, and `sha256` metadata. Generated Course Assistant
Q&A remains a source-cited draft until a Studio author approves it; learners
never receive parser citations or call this service.

## Repository documentation

The root [README](../../README.md) describes the application and runtime
boundaries. This directory is the authoritative source for parser-service
configuration and operation; the former parser-local documentation tree is not
part of the repository.
