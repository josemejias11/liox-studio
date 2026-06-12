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
5. Hotspot visits and lesson progress → `/api/progress` → SQLite via Prisma.

---

## Performance & Privacy

- **Self-Hosted AI:** All chat and quiz generation runs on your own Ollama host (`llama3`). No proprietary course files or student queries are ever sent to third-party APIs (like OpenAI or Gemini).
- **Internal-Only AI Backend:** The browser never reaches the FastAPI service — all AI traffic proxies through Next.js route handlers carrying a shared-secret `X-Internal-Token` header.
- **Server-Side Grading:** All quizzes (AI-generated and CMS-authored) are graded server-side; the answer key never reaches the browser.
- **SQLite WAL Mode:** Enabled Write-Ahead Logging (WAL) and increased `busy_timeout` (5000ms) on the Prisma SQLite connection to smoothly handle concurrent telemetry and progress writes without database locks.

---

## Getting Started

### Prerequisites
- Node.js 20+
- Python 3.9+
- [Ollama](https://ollama.com/) installed and running locally with the `llama3` and `nomic-embed-text` models pulled.
- A free [Sanity account](https://sanity.io)

```bash
# 1. Start the Ollama background service (if not using the Mac/Windows desktop app)
ollama serve &

# 2. Open a new terminal and download the required local models
ollama pull llama3
ollama pull nomic-embed-text
```

---

### 1. Start the Python AI Backend

The service requires a shared secret (`PARSER_SERVICE_TOKEN`) and refuses to start without one. The Next.js server sends it as the `X-Internal-Token` header on every request — the browser never talks to this service directly, so bind it to localhost.

```bash
cd parser-service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
export PARSER_SERVICE_TOKEN="dev-secret-change-me"   # must match web/.env.local
uvicorn main:app --host 127.0.0.1 --port 8000
```

---

### 2. Install and run Next.js Frontend

Open a new terminal window:

```bash
cd web
npm install
npm run db:migrate   # creates web/prisma/dev.db on first run
npm run dev
# http://localhost:3000
```

> `dev.db` is gitignored — run `npm run db:migrate` once after every fresh clone to recreate it.

---

### 3. Connect Sanity

1. Go to [sanity.io/manage](https://sanity.io/manage) → **Create new project** → copy the **Project ID**
2. Update `web/.env` with your project ID:

```env
NEXT_PUBLIC_SANITY_PROJECT_ID="your-project-id"
NEXT_PUBLIC_SANITY_DATASET="production"
DATABASE_URL="file:./prisma/dev.db"
```

3. Create `web/.env.local` with your secrets:

```env
SANITY_API_TOKEN="your-editor-token"
PARSER_SERVICE_URL="http://localhost:8000"           # AI backend (Ollama host) base URL
PARSER_SERVICE_TOKEN="dev-secret-change-me"          # must match the parser-service token
```

#### CORS Origins
In **sanity.io/manage → your project → API → CORS Origins**, add with **Allow credentials** checked:

| Origin | Purpose |
|--------|---------|
| `http://localhost:3000` | Embedded Studio + learner player |

#### API Token
In **sanity.io/manage → your project → API → Tokens** → **Add API token** → Permissions: **Editor**

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

Where instructional designers create and publish course content. Now includes the **Course Uploader** component, allowing admins to upload `.pdf`, `.docx`, and `.pptx` directly into the local ChromaDB for the AI to learn from.

### Instructor Dashboard — analytics
`http://localhost:3000/analytics`

Server-rendered dashboard reading directly from SQLite:
- **Summary cards** — total sessions, features explored, avg quiz score, quiz attempts
- **Top Features bar chart** — top 8 most-visited hotspots with CSS progress bars
- **Recent Sessions table** — last 12 sessions with lesson count, hotspot count, status, and relative time

---

## API Routes

### Python FastAPI (`localhost:8000` — internal only, requires `X-Internal-Token`)
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/upload` | Parses DOCX/PDF/PPTX and upserts into ChromaDB. |
| `POST` | `/api/chat` | Queries ChromaDB context + `llama3` to answer course questions. |
| `POST` | `/api/generate-quiz` | Analyzes weak topics and generates a JSON adaptive quiz via `llama3`. |
| `GET`  | `/health` | Readiness probe (Ollama reachability + ChromaDB dir writable). No auth. |

### Next.js (`localhost:3000`)
The browser only ever calls these routes; the AI routes proxy server-to-server to the FastAPI service.

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/progress?sessionId=` | Returns lesson progress for a session |
| `POST` | `/api/progress` | Upserts lesson progress and hotspot visits |
| `POST` | `/api/chat` | Proxies course Q&A to the parser service |
| `POST` | `/api/quiz` | Generates an AI quiz; answer key stays server-side |
| `POST` | `/api/quiz/grade` | Grades AI or CMS quizzes server-side and records the attempt |
| `POST` | `/api/upload` | Proxies course-material uploads (50MB cap) |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| CMS | Sanity (headless) + embedded Studio via `next-sanity` |
| Frontend | Next.js 16, React 19, TypeScript (strict) |
| Styling | Tailwind CSS v4, `tw-animate-css`, shadcn/ui v4, MotoSans font |
| AI Backend | Python 3.9+, FastAPI, Uvicorn |
| AI Models | Ollama (`llama3`), Langchain, ChromaDB, `markitdown` |
| Database | SQLite + Prisma ORM v5 (progress tracking, quiz attempts) |
