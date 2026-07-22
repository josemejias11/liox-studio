# Parser Service Operations

## Requirements

- Python 3.11+ (the checked tooling target)
- Ollama running locally or on the configured host
- Ollama models: `llama3` and `nomic-embed-text`

```bash
ollama pull llama3
ollama pull nomic-embed-text
```

## Configuration

Copy `.env.example` to `.env`. `python-dotenv` explicitly loads this service's
`.env` file with
`override=False`, so shell environment variables take precedence.

| Variable                       | Purpose                                      | Default                   |
| ------------------------------ | -------------------------------------------- | ------------------------- |
| `PARSER_SERVICE_TOKEN`         | Required shared token for internal requests. | none                      |
| `OLLAMA_BASE_URL`              | Ollama server URL.                           | `http://localhost:11434`  |
| `LLM_MODEL`                    | Chat and quiz model.                         | `llama3`                  |
| `EMBEDDING_MODEL`              | Embedding model.                             | `nomic-embed-text`        |
| `CHROMA_DIR`                   | Persistent Chroma data directory.            | service-local `chroma_db` |
| `OLLAMA_TIMEOUT_SECONDS`       | Ollama client timeout.                       | `120`                     |
| `RELEVANCE_THRESHOLD`          | Retrieval relevance cutoff.                  | `0.45`                    |
| `RETRIEVAL_K_CHAT`             | Retrieved documents per chat query.          | `5`                       |
| `CHUNK_SIZE` / `CHUNK_OVERLAP` | Document chunking controls.                  | `1000` / `200`            |
| `PARSER_PORT`                  | Service port; must be 1024 or higher.        | `8000`                    |

Do not use `PORT`: it can collide with the Node application.

## Local development

```bash
cd services/parser-service
python3 -m venv venv
source venv/bin/activate
pip install -e '.[dev]'
moto-parser
```

`moto-parser` and `python -m moto_parser` use `PARSER_PORT`, bind to
`127.0.0.1`, and enable reload.
To use another port:

```bash
PARSER_PORT=9000 moto-parser
```

## Health and troubleshooting

```bash
curl http://localhost:8000/health
```

`status: "ok"` requires Ollama reachability and a writable Chroma directory.
If startup fails, verify `PARSER_SERVICE_TOKEN`, that Ollama is running with
both models, and that `PARSER_PORT` is not below 1024.
