# Moto AI Parser Service

The parser service is Moto AI's internal FastAPI service for document parsing,
embedding, course-grounded chat, and quiz generation. It is called by the Next.js
backend and background worker; browsers never call it directly.

## Quick start

Requirements: Python 3.11+, Ollama, and the `llama3` and `nomic-embed-text`
models.

```bash
cd services/parser-service
python3 -m venv venv
source venv/bin/activate
pip install -e '.[dev]'
cp .env.example .env
ollama pull llama3
ollama pull nomic-embed-text
moto-parser
```

The development server listens on `http://127.0.0.1:8000` by default. Check
readiness with `curl http://127.0.0.1:8000/health`; when enabled, Swagger is at
`http://127.0.0.1:8000/docs`.

`python -m moto_parser` starts the same reload-enabled development server.

## Endpoints

| Method   | Path                 | Purpose                               |
| -------- | -------------------- | ------------------------------------- |
| `POST`   | `/api/upload`        | Parse and index one course document.  |
| `POST`   | `/api/chat`          | Answer from indexed course materials. |
| `POST`   | `/api/generate-quiz` | Generate a quiz from weak topics.     |
| `DELETE` | `/api/document`      | Delete one indexed document.          |
| `GET`    | `/health`            | Report Ollama and Chroma readiness.   |

All endpoints except `/health` require `X-Internal-Token`.

## Documentation

- [Documentation index](docs/README.md)
- [Architecture and module ownership](docs/architecture.md)
- [Operations, configuration, and deployment](docs/operations.md)
