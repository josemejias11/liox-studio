# Moto Tutor AI — eLearning Platform

An AI-powered eLearning platform that replaces traditional authoring tools (Articulate Storyline, Adobe Captivate) with a modern CMS-driven system. Instructional designers author content in a headless CMS and upload course files directly to the CMS. Learners interact with a 16:9 interactive course player featuring a localized AI course assistant and adaptive quiz generation based on their analytics.

---

## Architecture

The platform consists of a Next.js frontend and a Python FastAPI backend for localized AI workloads.

```text
Sanity CMS (headless) ───────┐ (uploads course files)
       │                     ▼
       ▼               Python FastAPI (parser-service)
Next.js 16 (root)      ─────────────────────────────
─────────────────      /api/upload      markitdown + ChromaDB
/ course library       /api/document   chunk deletion
/course/[slug]         /api/chat        local Llama 3 Chat
/analytics             /api/generate-quiz local Llama 3 Quiz Gen
/studio
```

**Data flow:**
1. Content is authored in Sanity Studio. Course files (PDF, PPTX, DOCX, **XLSX**) are uploaded via a persistent file library in the Studio. Each file is proxied through Next.js to the Python `/api/upload` endpoint and indexed into ChromaDB. Re-uploading the same filename replaces its chunks; deleting a file purges its chunks via `/api/document`.
2. The Python backend uses `markitdown` to parse the file and `langchain` + `ChromaDB` to embed and store the chunks locally.
3. Learner explores hotspots. A floating AI Assistant (`CourseAIFab`) queries the Python `/api/chat` endpoint to get course-specific answers generated locally by `llama3`.
4. Learner enters a Quiz phase. The Next.js app sends the learner's **weak topics** (hotspots not yet visited) to `/api/generate-quiz`. The Python backend searches ChromaDB for those topics and uses `llama3` to dynamically generate a structured adaptive quiz. The course-level quiz always uses the AI path — no CMS-authored quiz required.
5. Hotspot visits and lesson progress → `/api/progress` → local PostgreSQL via Prisma.

---

## Module Structure

### Course modes

Courses use the `courseMode` field in Sanity:

- `standard` (the default) uses the existing structured lesson flow.
- `canvas` adds spatial educational lessons while continuing to use the same player, navigation, and progress tracking.

The mode describes the authored learning experience; it is not a permission gate for legacy lesson types. Canvas lessons use the same route and player as Standard lessons.

### Canvas product inspection lesson

Canvas v1 focuses on one primary product image. In Sanity Studio, select **Canvas Product Inspection**, upload the image, and place feature targets using the visual map. Mark the targets learners must inspect as **Required for Completion**.

Learners can pan and zoom the image, explore targets in any order, and continue once all required features have been opened. Optional targets remain available without blocking progress.

### Refresher lesson authoring

Every lesson type can also be authored as a guided device refresher. Set **Device Name**, then add the lesson's **Covered Features** with a concise feature review for each one. The learner sees the device and review count on entry, can open each feature recap, and cannot continue until every listed feature has been reviewed.

Leave **Covered Features** empty for legacy or ungated lessons. When using hotspots or Canvas targets, use the same feature names so the visual exploration and refresher checklist stay aligned.

The codebase is organized into focused modules with clear boundaries:

### TypeScript (`src/`)

| Module | Purpose |
|--------|---------|
| `lib/course-flow.ts` | Course flow derivation and navigation item generation |
| `lib/course-structure.ts` | Course structure types and helpers |
| `lib/course-content.ts` | Sanity payload normalization to flat sections array |
| `lib/quiz-session.ts` | Quiz state reducer (answer selection, reveal, submission) |
| `lib/quiz-grading.ts` | Server-side quiz grading logic |
| `lib/progress-store.ts` | Prisma progress persistence (hotspots, lessons, quizzes) |
| `lib/chat-client.ts` | Chat transport to `/api/chat` with response validation |
| `lib/contracts/` | Zod schemas for Sanity, API, and quiz contracts |

### Player (`src/player/`)

| Module | Purpose |
|--------|---------|
| `MotoViewer.tsx` | Main course player shell |
| `CoursePhaseScreen.tsx` | Phase renderer (cover, lessons, quiz, disclaimer) |
| `NavMap.tsx` | Full-course navigation map |
| `LessonRenderer.tsx` | Lesson type dispatcher |
| `RefresherFeaturePanel.tsx` | Shared device and covered-feature review panel |
| `hooks/useCourseNavigation.ts` | Flow-based navigation state machine |
| `hooks/useCourseSession.ts` | Session ID and consent persistence |
| `hooks/useWeakTopics.ts` | Weak topic derivation and merge |
| `lesson-types/registry.ts` | Lesson type metadata and completion modes |

### Parser Service (`parser-service/`)

| Module | Purpose |
|--------|---------|
| `settings.py` | Configuration constants from environment |
| `runtime.py` | Runtime state, Ollama clients, LRU vectorstore cache |
| `vectorstore.py` | ChromaDB helpers (collection checks, retrieval, chunking) |
| `documents.py` | Document parsing and upload logic |
| `rag_chat.py` | RAG chat answer generation |
| `quiz_generation.py` | Quiz generation from weak topics |
| `main.py` | FastAPI routes (HTTP adapters only) |

---

## Performance & Privacy

- **Self-Hosted AI:** All chat and quiz generation runs on your own Ollama host (`llama3`). No proprietary course files or student queries are ever sent to third-party APIs (like OpenAI or Gemini).
- **Internal-Only AI Backend:** The browser never reaches the FastAPI service — all AI traffic proxies through Next.js route handlers carrying a shared-secret `X-Internal-Token` header.
- **Server-Side Grading:** All quizzes (AI-generated and CMS-authored) are graded server-side; the answer key never reaches the browser.
- **Local Postgres:** Progress tracking and quiz attempts are stored in a local PostgreSQL database via Prisma. In production, swap for a managed PG instance (e.g. Supabase) by updating `DATABASE_URL` / `DIRECT_URL` in your environment.

---

## Getting Started

> **Four processes must run simultaneously.** The platform requires PostgreSQL, Ollama, the Python parser-service, and Next.js all running at once. Steps 2–4 below each start one process; open a new terminal for each.

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
cp .env.example .env.local
```

Edit `.env.local` — the minimum required for local dev:

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
cp .env.example .env            # one-time: token and tunables loaded automatically
python main.py
```

`python main.py` always binds to `http://127.0.0.1:8000`. To use a different port set `PARSER_PORT` (not `PORT`, which collides with Node):

```bash
PARSER_PORT=9000 python main.py
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
npm install
npm run db:migrate   # applies Prisma migrations to local PostgreSQL
npm run dev
# → http://localhost:3000
```

---

### 4. Connect Sanity Studio

The Sanity project ID is already set in `.env` (`e7l925v5`). You only need to:

1. Add your **API Token** to `.env.local` (see step 1 above).
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
| `CourseQuiz` | Adaptive AI quiz — always shown at course completion, steered by the learner's unvisited hotspot topics |
| `SanityQuizPlayer` | Static CMS-authored quiz — shown only when a quiz document is explicitly attached to the course |
| `NavMap` | Full-course map with type icons and completion dots; Knowledge Check entry always visible |

### Sanity Studio — authoring tool
`http://localhost:3000/studio`

Where instructional designers create and publish course content.

**Course Material file library** — the Course document includes a persistent, additive file library. Upload `.pdf`, `.docx`, `.pptx`, and `.xlsx` files directly into ChromaDB for the AI to learn from. Each upload appends an entry; re-uploading the same filename replaces its chunks without adding a duplicate row. The ✕ button removes the Sanity record **and** purges the file's chunks from ChromaDB in one action.

> **Before uploading files from Studio:** you must first log in to the Instructor Dashboard at `http://localhost:3000/analytics/login` (password = `ANALYTICS_PASSWORD` from your `.env.local`). The upload endpoint shares the same auth cookie as the analytics dashboard. Once logged in the cookie lasts 7 days — you will not need to repeat this unless it expires or you clear your cookies.

**Lesson types** — each Lesson document has a `Lesson Type` field that controls which player component renders:

| Type | Component | Use for |
|------|-----------|---------|
| `content` | `ContentLesson` | Headline + body text, optional background image and hotspots |
| `interaction` | `ContentLesson` | Same as content but hotspots are required; drives the discovery flow |
| `stage` | `ProductStage` | Full-bleed product image with floating hotspots and optional completion animation |
| `video` | `ContentLesson` | MP4 playback; supports 16:9, 1:1, 4:5, 9:16 aspect ratios |
| `splitScreen` | `SplitScreenLesson` | Left/right split — text on one side, video on the other |
| `quiz` | in-lesson quiz | CMS-authored quiz embedded inside the lesson flow |
| `colorSwitcher` | `ContentLesson` | Up to 4 color variants with swappable product images |
| `dragDrop` | `DragDropLesson` | Drag chip to drop zone interaction with correctness feedback |
| `scrollStory` | `ScrollStoryLesson` | Scroll-driven chapters with parallax image pan/zoom/rotate |
| `canvas` | `CanvasInspectionLesson` | Pan-and-zoom product inspection with feature targets |

**Shared refresher fields** — use `Device Name` and `Covered Features` on any lesson type to add a device-focused review. Each feature needs a name and a concise review; learners must open every listed feature before the Next button unlocks.

**Rich text** — all body fields support standard decorators (bold, italic, underline, strike, code) plus **superscript** (`x²`, spec callouts like `5G¹`). Use the `Sup` button in the toolbar.

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
| `GET`    | `/health` | Readiness probe — Ollama reachability + ChromaDB writable. No auth. |
| `POST`   | `/api/upload` | Parses DOCX/PDF/PPTX/XLSX and upserts into ChromaDB. Re-uploading replaces previous chunks for that filename. |
| `DELETE` | `/api/document` | Removes all ChromaDB chunks for a given `course_id` + `filename`. |
| `POST`   | `/api/chat` | Queries ChromaDB context + `llama3` to answer course questions. |
| `POST`   | `/api/generate-quiz` | Analyzes weak topics and generates a JSON adaptive quiz via `llama3`. |

### Next.js (`localhost:3000`)
The browser only ever calls these routes; the AI routes proxy server-to-server to the FastAPI service.

| Method | Path | Description |
|--------|------|-------------|
| `GET`    | `/api/progress?sessionId=` | Returns lesson progress for a session |
| `POST`   | `/api/progress` | Upserts lesson progress and hotspot visits |
| `POST`   | `/api/chat` | Proxies course Q&A to the parser service |
| `POST`   | `/api/quiz` | Generates an AI quiz; answer key stays server-side |
| `POST`   | `/api/quiz/grade` | Grades AI or CMS quizzes server-side and records the attempt |
| `POST`   | `/api/upload` | Proxies course-material uploads to the parser service (50 MB cap per file) |
| `DELETE` | `/api/upload` | Proxies chunk deletion to the parser service |

---

## Testing

```bash
# Run all TypeScript tests
npm run test

# Run specific test suites
npm run test -- src/lib/quiz-session.test.ts
npm run test -- src/lib/course-content.test.ts
npm run test -- src/player/hooks/useCourseNavigation.test.ts

# Type checking
npm run typecheck

# Python parser-service tests (requires venv)
cd parser-service && pytest tests/ -v
```

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

## Full Reset

`reset-all.sh` (repo root) is the canonical one-command teardown for a clean content-entry run. It wipes the PostgreSQL database, deletes all Sanity documents, and removes `parser-service/chroma_db`. Run it before starting a fresh authoring session:

```bash
./reset-all.sh
```

Loads credentials from `.env` + `.env.local`. After reset: restart the parser-service (so ChromaDB is recreated), run `npm run db:migrate`, then author and upload fresh content.

---

## Dev vs Production

| Config | Dev (local) | Production |
|--------|-------------|------------|
| PostgreSQL | Local instance (`localhost:5432`) | Managed PG, e.g. Supabase (update `DATABASE_URL`/`DIRECT_URL`) |
| AI backend | Local Ollama (`localhost:11434`) | Self-hosted Ollama server (update `PARSER_SERVICE_URL`) |
| Rate limiting | Disabled (empty Upstash env vars) | Upstash Redis (`UPSTASH_REDIS_REST_URL` + `_TOKEN`) |
| Analytics password | Any value | Strong secret in hosting env vars |
