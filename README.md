# Moto Tutor AI — eLearning Platform

An AI-powered eLearning platform that replaces traditional authoring tools (Articulate Storyline, Adobe Captivate) with a modern CMS-driven system. Instructional designers author content in a headless CMS and upload course files directly to the CMS. Learners interact with a 16:9 interactive course player featuring a localized AI course assistant and adaptive quiz generation based on their analytics.

---

## Architecture

The platform consists of a Next.js frontend and a Python FastAPI backend for localized AI workloads.

```text
Sanity CMS (headless) ───────┐ (uploads course files)
       │                     ▼
       ▼               Python FastAPI (parser-service)
Next.js 16 (web/)      ─────────────────────────────
─────────────────      /api/upload      markitdown + ChromaDB
/ course library       /api/chat        local Llama 3 Chat
/course/[slug]         /api/generate-quiz local Llama 3 Quiz Gen
/analytics
/studio
```

**Data flow:**
1. Content is authored in Sanity Studio. Course files (PDF, PPTX, DOCX) are uploaded directly via a custom Studio component, hitting the Python `/api/upload` endpoint.
2. The Python backend uses `markitdown` to parse the file and `langchain` + `ChromaDB` to embed and store the chunks locally.
3. Learner explores hotspots. A floating AI Assistant (`CourseAIFab`) queries the Python `/api/chat` endpoint to get course-specific answers generated locally by `llama3`.
4. Learner enters a Quiz Lesson. The Next.js app sends the learner's analytics (weak topics) to `/api/generate-quiz`. The Python backend searches ChromaDB for those topics and uses `llama3` to dynamically generate a structured JSON quiz.
5. Hotspot visits and lesson progress → `/api/progress` → local PostgreSQL via Prisma.

---

## Performance & Privacy

- **Self-Hosted AI:** All chat and quiz generation runs on your own Ollama host (`llama3`). No proprietary course files or student queries are ever sent to third-party APIs (like OpenAI or Gemini).
- **Internal-Only AI Backend:** The browser never reaches the FastAPI service — all AI traffic proxies through Next.js route handlers carrying a shared-secret `X-Internal-Token` header.
- **Server-Side Grading:** All quizzes (AI-generated and CMS-authored) are graded server-side; the answer key never reaches the browser.
- **Local Postgres:** Progress tracking and quiz attempts are stored in a local PostgreSQL database via Prisma. In production, swap for a managed PG instance (e.g. Supabase) by updating `DATABASE_URL` / `DIRECT_URL` in your environment.

---

## Getting Started

### Prerequisites
- Node.js 20+
- Python 3.9+
- [Ollama](https://ollama.com/) installed and running locally
- A [Sanity](https://sanity.io) account (free tier works)
- PostgreSQL running locally (any installation — Postgres.app, Homebrew, Docker, or WebStorm's built-in DB tool)

```bash
# Pull the required AI models
ollama pull llama3
ollama pull nomic-embed-text
```

---

### 1. Clone and configure environment

```bash
git clone https://github.com/josemejias11/moto-ai.git
cd moto-ai
```

Copy the example env file and fill in your local values:

```bash
cp web/.env.example web/.env.local
```

Edit `web/.env.local` — the minimum required for local dev:

```env
# Local PostgreSQL — match your local instance credentials
DATABASE_URL="postgresql://<user>:<password>@localhost:5432/moto_ai_dev"
DIRECT_URL="postgresql://<user>:<password>@localhost:5432/moto_ai_dev"

# Sanity — get from sanity.io/manage → your project → API → Tokens (Editor role)
SANITY_API_TOKEN="your-editor-token"

# FastAPI shared secret — must match PARSER_SERVICE_TOKEN below
PARSER_SERVICE_URL="http://localhost:8000"
PARSER_SERVICE_TOKEN="dev-secret-change-me"
```

Create the local database (once):

```bash
psql -U <user> -d postgres -c "CREATE DATABASE moto_ai_dev;"
```

---

### 2. Start the Python AI Backend

```bash
cd parser-service
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
export PARSER_SERVICE_TOKEN="dev-secret-change-me"   # must match web/.env.local
uvicorn main:app --host 127.0.0.1 --port 8000
```

Verify it's healthy:
```bash
curl http://localhost:8000/health
# {"status":"ok","ollama_reachable":true,"chroma_dir_writable":true,...}
```

---

### 3. Start the Next.js Frontend

Open a new terminal:

```bash
cd web
npm install
npm run db:migrate   # applies Prisma migrations to local PostgreSQL
npm run dev
# → http://localhost:3000
```

---

### 4. Connect Sanity Studio

The Sanity project ID is already set in `web/.env` (`e7l925v5`). You only need to:

1. Add your **API Token** to `web/.env.local` (see step 1 above).
2. Add `http://localhost:3000` to **CORS Origins** in [sanity.io/manage](https://sanity.io/manage) → your project → **API → CORS Origins** with **Allow credentials** checked.

The embedded Studio is then available at `http://localhost:3000/studio`.

---

## The Three UIs

### Course Player — learner view
`http://localhost:3000`

Strict 16:9 interactive player with animated lesson transitions, hotspot-gated navigation, and an AI chat panel for every feature.

| Component | What it does |
|-----------|-------------|
| `LessonFrame` | 16:9 locked frame, nav bar, progress bar, course map toggle |
| `Hotspot` | Pulsing dot positioned by %; turns emerald when visited |
| `CourseAIFab` | Floating AI Assistant powered by Python `llama3` — available anywhere |
| `DiscoveryPanel` | Shows learn content + allows chatting with AI about specific features |
| `ProductStage` | 3D-style product view with floating hotspots and a completion burst animation |
| `QuizLesson` | Dynamically generates an AI quiz based on the learner's weakest topics |
| `NavMap` | Full-course map with type icons and completion dots |

### Sanity Studio — authoring tool
`http://localhost:3000/studio`

Where instructional designers create and publish course content. Includes the **Course Uploader** component — upload `.pdf`, `.docx`, and `.pptx` directly into local ChromaDB for the AI to learn from.

### Instructor Dashboard — analytics
`http://localhost:3000/analytics`

Server-rendered dashboard reading directly from PostgreSQL via Prisma:
- **Summary cards** — total sessions, features explored, avg quiz score, quiz attempts
- **Top Features bar chart** — top 8 most-visited hotspots with CSS progress bars
- **Recent Sessions table** — last 12 sessions with lesson count, hotspot count, status, and relative time

Password is set via `ANALYTICS_PASSWORD` in your env (any value works locally).

---

## API Routes

### Python FastAPI (`localhost:8000` — internal only, requires `X-Internal-Token`)
| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/health` | Readiness probe — Ollama reachability + ChromaDB writable. No auth. |
| `POST` | `/api/upload` | Parses DOCX/PDF/PPTX and upserts into ChromaDB. |
| `POST` | `/api/chat` | Queries ChromaDB context + `llama3` to answer course questions. |
| `POST` | `/api/generate-quiz` | Analyzes weak topics and generates a JSON adaptive quiz via `llama3`. |

### Next.js (`localhost:3000`)
The browser only ever calls these routes; the AI routes proxy server-to-server to the FastAPI service.

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/progress?sessionId=` | Returns lesson progress for a session |
| `POST` | `/api/progress` | Upserts lesson progress and hotspot visits |
| `POST` | `/api/chat` | Proxies course Q&A to the parser service |
| `POST` | `/api/quiz` | Generates an AI quiz; answer key stays server-side |
| `POST` | `/api/quiz/grade` | Grades AI or CMS quizzes server-side and records the attempt |
| `POST` | `/api/upload` | Proxies course-material uploads (50 MB cap) |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| CMS | Sanity (headless) + embedded Studio via `next-sanity` |
| Frontend | Next.js 16, React 19, TypeScript (strict) |
| Styling | Tailwind CSS v4, `tw-animate-css`, shadcn/ui v4 |
| AI Backend | Python 3.9+, FastAPI, Uvicorn |
| AI Models | Ollama (`llama3` + `nomic-embed-text`), LangChain, ChromaDB, `markitdown` |
| Database | PostgreSQL (local dev) + Prisma ORM v5 |
| Rate Limiting | Upstash Redis (gracefully disabled when env vars are unset) |

---

## Dev vs Production

| Config | Dev (local) | Production |
|--------|-------------|------------|
| PostgreSQL | Local instance (`localhost:5432`) | Managed PG, e.g. Supabase (update `DATABASE_URL`/`DIRECT_URL`) |
| AI backend | Local Ollama (`localhost:11434`) | Self-hosted Ollama server (update `PARSER_SERVICE_URL`) |
| Rate limiting | Disabled (empty Upstash env vars) | Upstash Redis (`UPSTASH_REDIS_REST_URL` + `_TOKEN`) |
| Analytics password | Any value | Strong secret in hosting env vars |
