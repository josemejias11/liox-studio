# Deployment Guide

This document covers production deployment of Moto Tutor AI across all four services: Next.js app, Python parser service, PostgreSQL, and the LLM host.

## Architecture Overview

```
Browser ──→ Next.js (port 3000) ──→ Python parser-service (port 8000)
                │                          │
                ▼                          ▼
          PostgreSQL                  Ollama + ChromaDB
          (Prisma ORM)               (local LLM + vector store)
                │
                ▼
           Sanity CMS
        (hosted headless)
```

All AI traffic is server-to-server through the Next.js API routes. The browser never reaches the parser service directly.

## Prerequisites

- Node.js 20+
- Python 3.9+
- PostgreSQL 16+ (managed or self-hosted)
- A server or VM with GPU access for the Ollama LLM (CPU-only works for `llama3` but is slower)
- A Sanity project (free tier: [sanity.io/manage](https://sanity.io/manage))

## 1. PostgreSQL

### Option A — Managed (recommended)

Use Supabase, Neon, or any managed Postgres provider.

1. Create a new database (e.g. `moto_ai_prod`).
2. Get the connection string (pooled and direct).
3. Set both env vars in the Next.js deployment:

```bash
DATABASE_URL="postgresql://user:pass@host:6543/moto_ai_prod?pgbouncer=true"
DIRECT_URL="postgresql://user:pass@host:5432/moto_ai_prod"
```

4. Run migrations once after deployment:

```bash
npx prisma migrate deploy
```

### Option B — Self-hosted

```bash
# Install PostgreSQL and create the database
psql -U postgres -c "CREATE DATABASE moto_ai_prod;"

# Set env vars pointing to localhost
DATABASE_URL="postgresql://user:pass@localhost:5432/moto_ai_prod"
DIRECT_URL="postgresql://user:pass@localhost:5432/moto_ai_prod"
```

## 2. LLM Host (Ollama)

The parser service requires Ollama with two models.

### Self-hosted Ollama

1. Install Ollama on a server with at least 8 GB RAM and a GPU if available:
   ```bash
   curl -fsSL https://ollama.com/install.sh | sh
   ```

2. Pull the required models:
   ```bash
   ollama pull llama3
   ollama pull nomic-embed-text
   ```

3. Bind Ollama to listen on the network interface (default is localhost-only):
   ```bash
   OLLAMA_HOST=0.0.0.0:11434 ollama serve
   ```

4. Configure the parser service to point to this host:
   ```bash
   OLLAMA_HOST="http://<ollama-server-ip>:11434"
   ```

### CPU-only fallback

`llama3` runs on CPU at reduced speed. Expect 3-10 second response times for chat queries.

## 3. Python Parser Service

### Deploy as a systemd service (Linux)

```ini
# /etc/systemd/system/moto-parser.service
[Unit]
Description=Moto Tutor AI Parser Service
After=network.target

[Service]
Type=simple
User=moto
WorkingDirectory=/opt/moto-ai/parser-service
Environment=PARSER_SERVICE_TOKEN=<strong-secret>
Environment=OLLAMA_HOST=http://localhost:11434
Environment=PARSER_PORT=8000
ExecStart=/opt/moto-ai/parser-service/venv/bin/python /opt/moto-ai/parser-service/main.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable moto-parser
sudo systemctl start moto-parser
```

### Deploy with Docker Compose (with Ollama)

```yaml
# docker-compose.parser.yml
services:
  ollama:
    image: ollama/ollama:latest
    volumes:
      - ollama_data:/root/.ollama
    ports:
      - "11434:11434"
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]

  parser:
    build:
      context: ./parser-service
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      - OLLAMA_HOST=http://ollama:11434
      - PARSER_SERVICE_TOKEN=${PARSER_SERVICE_TOKEN}
    depends_on:
      - ollama
    volumes:
      - chroma_data:/app/chroma_db

volumes:
  ollama_data:
  chroma_data:
```

### Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PARSER_SERVICE_TOKEN` | Yes | — | Shared secret for Next.js ↔ parser auth |
| `OLLAMA_HOST` | Yes | `http://localhost:11434` | Ollama server URL |
| `PARSER_PORT` | No | `8000` | Port the parser service listens on |
| `CHROMA_PERSIST_DIR` | No | `./chroma_db` | Where ChromaDB stores vector data |

### Health check

```bash
curl http://localhost:8000/health
# {"status":"ok","ollama_reachable":true,"chroma_dir_writable":true}
```

## 4. Next.js App

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Pooled Postgres connection (Prisma migrations use `DIRECT_URL`) |
| `DIRECT_URL` | Yes | Direct Postgres connection for migrations |
| `SANITY_API_TOKEN` | Yes | Sanity Editor role token |
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | Yes | Sanity project ID (e.g. `e7l925v5`) |
| `NEXT_PUBLIC_SANITY_DATASET` | No | Dataset name (default: `production`) |
| `PARSER_SERVICE_URL` | Yes | URL of the parser service (e.g. `http://localhost:8000`) |
| `PARSER_SERVICE_TOKEN` | Yes | Must match the parser service's `PARSER_SERVICE_TOKEN` |
| `ANALYTICS_PASSWORD` | Yes | Password for the instructor dashboard login |
| `UPSTASH_REDIS_REST_URL` | No | Upstash Redis URL for rate limiting (omit to disable) |
| `UPSTASH_REDIS_REST_TOKEN` | No | Upstash Redis token for rate limiting |

### Deploy to Vercel (recommended)

1. Push the repo to GitHub.
2. Import the project in Vercel.
3. Set the build command: `prisma migrate deploy && next build`
4. Set all env vars listed above in the Vercel dashboard.
5. Add `http://localhost:3000` to Sanity CORS Origins (with credentials).
6. Deploy.

The Sanity Studio is embedded at `/studio` — no separate deployment needed.

### Deploy to a Linux server

```bash
npm install
npm run db:migrate
npm run build
npm start  # runs on port 3000
```

Use a process manager (pm2, systemd, or supervisor) to keep it running.

## 5. Sanity Configuration

1. Go to [sanity.io/manage](https://sanity.io/manage) → your project → API.
2. Create a token with **Editor** role.
3. Set `SANITY_API_TOKEN` in the Next.js env.
4. Go to **API → CORS Origins** and add your production domain with **Allow credentials** checked.

## 6. Rate Limiting (optional)

Rate limiting uses Upstash Redis and is gracefully disabled when env vars are unset.

1. Create a free Upstash Redis instance at [upstash.com](https://upstash.com).
2. Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

## 7. Post-Deployment Checklist

- [ ] PostgreSQL is running and `DATABASE_URL`/`DIRECT_URL` are set.
- [ ] Ollama is running with `llama3` and `nomic-embed-text` models pulled.
- [ ] Parser service health check returns `{"status":"ok"}`.
- [ ] Parser service token matches between Next.js and the parser env.
- [ ] Sanity CORS origin includes the production domain.
- [ ] Analytics dashboard password is set and not the dev default.
- [ ] HTTPS is enabled (Vercel handles this automatically; for self-hosted, use a reverse proxy like nginx or Caddy).
- [ ] `prisma migrate deploy` ran successfully on the production database.

## Security Notes

- The parser service must be **internal-only**. Bind it to `127.0.0.1` or use a firewall to block external access. The browser only calls Next.js routes, never the parser directly.
- `PARSER_SERVICE_TOKEN` is the shared secret between Next.js and the parser. Use a long random string. Never expose it in client-side code.
- Quiz answer keys are **server-side only**. The `QUIZ_GRADING_QUERY` is never exposed to the browser.
- All course file uploads are routed through the server, never from the browser to the parser.
- The analytics dashboard is now gated behind the `analytics_token` cookie. Set a strong `ANALYTICS_PASSWORD`.

## Backup & Recovery

### PostgreSQL

Back up with `pg_dump`:
```bash
pg_dump -U user -h host moto_ai_prod > moto_backup_$(date +%Y-%m-%d).sql
```

Restore:
```bash
psql -U user -h host moto_ai_prod < moto_backup_2026-07-07.sql
```

### ChromaDB

Back up the persist directory:
```bash
tar -czf chroma_backup_$(date +%Y-%m-%d).tar.gz parser-service/chroma_db/
```

Restore by extracting to the same path and restarting the parser service.

### Sanity

Sanity stores content in their cloud. No backup needed for authored content — it's versioned automatically. Use Sanity's export API if you need an offline copy.

## Monitoring

Recommended (not included in the repo):

- **Uptime**: health check endpoint at parser `/health` and Next.js `/api/health`
- **Errors**: Sentry or similar for both Next.js and the parser service
- **Performance**: Vercel Analytics (if deployed on Vercel) or CloudWatch (if on AWS)
- **LLM metrics**: track Ollama request latency and failure rate via the parser service logs
