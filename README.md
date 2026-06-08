# DeckTutor AI — eLearning Platform

An AI-powered eLearning platform that replaces traditional authoring tools (Articulate Storyline, Adobe Captivate) with a modern CMS-driven system. Instructional designers author content in a headless CMS; learners interact with it through a 16:9 interactive course player with AI-powered chat, quiz generation, and an instructor analytics dashboard.

---

## Architecture

Two services run concurrently:

```
Sanity CMS (headless)
       │
       ▼
Next.js 16 (web/)
─────────────────
/                 course player
/analytics        instructor dashboard
/studio           authoring UI
/api/chat         AI tutor (Anthropic API route)
/api/quiz         AI quiz generation
/api/progress     lesson + quiz progress (SQLite)
```

**Data flow:**
1. Content is authored in Sanity Studio → published to the Sanity CDN
2. `page.tsx` fetches module + lessons from Sanity at render time
3. Learner asks a question → Next.js `/api/chat` → Claude streaming response (SSE)
4. Quiz request → Next.js `/api/quiz` → Claude returns structured JSON
5. Hotspot visits and quiz results → `/api/progress` → SQLite via Prisma
6. FastAPI `/chat` and `/quiz` are available for direct RAG queries against ChromaDB

---

## Getting Started

### Prerequisites
- Node.js 20+
- Python 3.11+
- A free [Sanity account](https://sanity.io)
- An Anthropic API key (optional — mock mode works without one)

---

### 1. Frontend (Next.js)

```bash
cd web
npm install
npm run db:migrate   # creates web/prisma/dev.db on first run
npm run dev
# http://localhost:3000
```

> `dev.db` is gitignored — run `npm run db:migrate` once after every fresh clone to recreate it.

---

### 2. Backend (FastAPI)

```bash
cd api
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
export ANTHROPIC_API_KEY="sk-ant-..."
uvicorn main:app --reload
# http://localhost:8000 — Swagger docs at /docs
```

---

### 3. Connect Sanity

1. Go to [sanity.io/manage](https://sanity.io/manage) → **Create new project** → copy the **Project ID**
2. Update `NEXT_PUBLIC_SANITY_PROJECT_ID` in `web/.env` with your project ID
3. Create `web/.env.local` with your secrets:

```env
SANITY_API_TOKEN="your-editor-token"
ANTHROPIC_API_KEY="sk-ant-..."
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
| `LessonFrame` | 16:9 locked frame, nav bar, progress bar, speaker notes panel, course map toggle |
| `Hotspot` / `PulseHotspot` | Pulsing dot positioned by %; turns emerald when visited |
| `LessonLayer` | Bottom-sheet AI chat — auto-fires on open, multi-turn follow-ups |
| `ProductStage` | 3D-style product view with floating hotspots and a completion burst animation |
| `VideoLesson` | YouTube / Vimeo embed or native `<video>` with continue-gating |
| `QuizLesson` | Claude-generated multiple-choice quiz with animated score screen |
| `CourseComplete` | Completion screen with rotating rings and stats (lessons, hotspots, %) |
| `NavMap` | Lesson-over course map with type icons and completion dots |
| `DiscoveryPanel` | Collapsible feature list for stage lessons |

### Sanity Studio — authoring tool
`http://localhost:3000/studio`

Where instructional designers create and publish course content.

**Content model:**
- **Module** — top-level course (title, description, thumbnail, objectives, ordered chapters)
- **Chapter** — ordered collection of lessons
- **Lesson** — atomic content unit with:
  - `headline`, `body`, `media`, `speakerNotes`
  - `lessonType`: `content` | `interaction` | `stage` | `video` | `quiz`
  - `hotspots[]` — label, AI topic query, x/y position (%)
  - `videoUrl` / `videoFile` — YouTube, Vimeo, or uploaded video (video lessons)

### Instructor Dashboard — analytics
`http://localhost:3000/analytics`

Server-rendered dashboard reading directly from SQLite:
- **Summary cards** — total sessions, features explored, avg quiz score, quiz attempts
- **Top Features bar chart** — top 8 most-visited hotspots with CSS progress bars
- **Quiz Breakdown** — large avg% display + Perfect / Great / Good / Below-60% distribution
- **Recent Sessions table** — last 12 sessions with lesson count, hotspot count, status, and relative time

---

## Authoring a Course

1. Open `http://localhost:3000/studio`
2. Go to **Content > Modules** and click **Create new Module** (or click the + icon).
3. Enter a **Title** (e.g., "Test Module") and click **Generate** for the Slug.
4. Under the **Chapters** array, click **Add item**.
5. In the reference search dropdown, click **Create** to create a new nested Chapter.
6. Enter a **Title** for the new Chapter (e.g., "Chapter 1") and click **Generate** for the Slug.
7. Under the **Lessons** array in the Chapter, click **Add item** to create lessons (e.g., add 2 lessons).
8. Fill out the **Headline** and lesson content, then close the lesson dialog.
9. Click **Publish** on the Chapter, then click **Publish** on the parent Module.
10. Refresh `http://localhost:3000` — your course appears immediately.

**Lesson types:**

| Type | Description |
|------|-------------|
| `content` | Image or text lesson; optional hotspots |
| `interaction` | Hotspot-gated lesson — next locked until all hotspots visited |
| `stage` | 3D product view with floating discovery hotspots |
| `video` | YouTube/Vimeo URL or uploaded video file |
| `quiz` | Claude generates questions from your course context at runtime |

---

## API Routes

### Next.js (used by the frontend)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/chat` | Streams AI tutor response (SSE). Body: `{ query, context_hint? }` |
| `POST` | `/api/quiz` | Generates multiple-choice quiz JSON. Body: `{ context?, num_questions? }` |
| `GET`  | `/api/progress?sessionId=` | Returns lesson progress for a session |
| `POST` | `/api/progress` | Upserts lesson progress or records a quiz attempt |

### FastAPI (direct RAG access — `localhost:8000`)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/chat` | RAG + Claude streaming chat (SSE) |
| `POST` | `/quiz` | RAG + Claude JSON quiz generation |
| `GET`  | `/health` | ChromaDB document count + status |

---

## Keyboard Shortcuts (Course Player)

| Key | Action |
|-----|--------|
| `N` | Toggle speaker notes panel |
| `Escape` | Close NavMap or AI chat panel |

---

## Progress Tracking

Anonymous sessions are identified by a UUID stored in `localStorage` under the key `decktutor_session`. All progress is tied to this ID and persisted in SQLite.

| Table | Records |
|-------|---------|
| `LessonProgress` | Per-session, per-lesson: visited hotspots + completion flag |
| `QuizAttempt` | Per-session, per-module: score, total, timestamp |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | Yes | From sanity.io/manage — set in `web/.env` |
| `NEXT_PUBLIC_SANITY_DATASET` | No (default: `production`) | Sanity dataset name |
| `SANITY_API_TOKEN` | Yes (for Studio mutations) | Editor-level Sanity token — set in `web/.env.local` |
| `ANTHROPIC_API_KEY` | No | Claude API key — omit for mock mode — set in `web/.env.local` |
| `DATABASE_URL` | No (default: `file:./dev.db`) | SQLite path — pre-set in `web/.env` |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| CMS | Sanity (headless) + embedded Studio via `next-sanity` |
| Frontend | Next.js 16, React 19, TypeScript |
| Styling | Tailwind CSS v4, `tw-animate-css`, shadcn/ui v4 |
| AI | Anthropic Claude API (`claude-sonnet-4-6` chat · `claude-opus-4-8` quiz) |
| Backend | Python FastAPI, ChromaDB (vector store / RAG) |
| Database | SQLite + Prisma ORM v5 (progress tracking, quiz attempts) |
| Fonts | MotoSans (custom, loaded from `web/public/fonts/`) |
