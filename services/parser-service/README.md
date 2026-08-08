# Moto AI Parser Service

The parser service is Moto AI's internal FastAPI service for source parsing,
embedding, revision-grounded chat, and supplemental quiz generation. It is
called by the Next.js backend and background worker; browsers never call it
directly. OpenAI is the language-model and embedding provider behind this
service boundary; browsers never receive the API key.

## Quick start

Requirements: Python 3.11+ and an OpenAI API project with billing enabled.

```bash
cd services/parser-service
python3 -m venv venv
source venv/bin/activate
pip install -e '.[dev]'
cp .env.example .env
# Set OPENAI_API_KEY and match PARSER_SERVICE_TOKEN to the root .env.local.
moto-parser
```

The development server listens on `http://127.0.0.1:8000` by default. Check
readiness with `curl http://127.0.0.1:8000/health`; when enabled, Swagger is at
`http://127.0.0.1:8000/docs`.

`python -m moto_parser` starts the same reload-enabled development server.

## Endpoints

| Method   | Path                   | Purpose                                                           |
| -------- | ---------------------- | ----------------------------------------------------------------- |
| `POST`   | `/api/upload`          | Index one immutable source ID and its SHA-256.                    |
| `POST`   | `/api/generate-assistant-qa` | Draft source-cited Course Assistant Q&A for author approval. |
| `POST`   | `/api/generate-quiz`   | Generate a supplemental quiz from explicit revision sources.      |
| `POST`   | `/api/generate-course` | Generate an editable course draft from explicit revision sources. |
| `DELETE` | `/api/document`        | Delete chunks for one source ID.                                  |
| `GET`    | `/health`              | Report OpenAI configuration and Chroma readiness.                 |

All endpoints except `/health` require `X-Internal-Token`.

Chat requests use `{ "course_id", "source_ids", "query" }`. Quiz requests add
`source_ids` alongside `course_id` and `weak_topics`. An empty `source_ids`
list never expands to the course corpus: retrieval returns no context. Uploads
carry `source_id` and `sha256` multipart fields, and every Chroma chunk stores
`course_id`, `source_id`, and `sha256` metadata.

## Documentation

- [Documentation index](docs/README.md)
- [Architecture and module ownership](docs/architecture.md)
- [Operations, configuration, and deployment](docs/operations.md)
