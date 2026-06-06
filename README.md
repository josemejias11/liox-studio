# DeckTutor AI — eLearning Platform

An AI-powered eLearning platform that replaces traditional authoring tools (Articulate Storyline, Adobe Captivate) with a modern CMS-driven system. Instructional designers author content in a headless CMS; learners interact with it through a 16:9 interactive course player with AI-powered chat and quiz generation.

---

## Architecture

Two services run concurrently:

```
Sanity CMS (headless)
       │
       ▼
Next.js 16 (web/)              FastAPI (api/)
─────────────────              ──────────────
/                 course player     /chat    RAG + streaming chat (SSE)
/studio           authoring UI      /quiz    RAG + quiz generation
/api/chat         AI tutor (SSE)    /health  ChromaDB status
/api/quiz         quiz generation
```

**Data flow:**
1. Content is authored in Sanity Studio → published to the Sanity CDN
2. `page.tsx` fetches module + slides from Sanity at render time
3. Learner asks a question → Next.js `/api/chat` → Claude streaming response (SSE)
4. Quiz request → Next.js `/api/quiz` → Claude returns structured JSON
5. FastAPI `/chat` and `/quiz` are available for direct RAG queries against ChromaDB

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
npm run dev
# http://localhost:3000
```

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
2. Create `web/.env.local` with:

```env
NEXT_PUBLIC_SANITY_PROJECT_ID="your-project-id"
NEXT_PUBLIC_SANITY_DATASET="production"
SANITY_API_TOKEN="your-editor-token"
ANTHROPIC_API_KEY="sk-ant-..."
```

#### CORS Origins
In **sanity.io/manage → your project → API → CORS Origins**, add both with **Allow credentials** checked:

| Origin | Purpose |
|--------|---------|
| `http://localhost:3000` | Embedded Studio + learner player |

#### API Token
In **sanity.io/manage → your project → API → Tokens** → **Add API token**:
- Permissions: **Editor**

---

## Two UIs

### Sanity Studio — authoring tool
`http://localhost:3000/studio`

Where instructional designers create and publish course content. Embedded directly in the Next.js app.

**Content model:**
- **Module** — top-level course (title, description, thumbnail, objectives, ordered lessons)
- **Lesson** — ordered collection of slides
- **Slide** — atomic content unit with:
  - `headline`, `body`, `media`, `speakerNotes`
  - `slideType`: `content` | `interaction` | `video` | `quiz`
  - `hotspots[]` — label, AI topic query, x/y position (%)

### Course Player — learner view
`http://localhost:3000`

Strict 16:9 interactive player:
- **SlideFrame** — locked aspect ratio, nav bar, progress bar, completion gating
- **Hotspot** — pulsing dot positioned by percentage; turns green when visited
- **SlideLayer** — bottom-sheet chat panel that streams AI explanation on open, then accepts follow-up questions scoped to the asset
- **Completion gating** — next slide locked until all hotspots are visited

---

## Authoring a Course

1. Open `http://localhost:3000/studio`
2. Create a **Lesson** — add slides, set types, upload images
3. Create a **Module** — reference your lessons, add thumbnail and objectives
4. Set **Published → true** on the Module
5. Refresh `http://localhost:3000` — your course appears immediately

For **interaction slides**:
- Set `slideType` to `Interaction`
- Add hotspot entries with label, AI topic query, and x/y position (0–100%)

---

## API Routes

### Next.js (used by the frontend)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/chat` | Streams AI tutor response (SSE). Body: `{ query, context_hint? }` |
| `POST` | `/api/quiz` | Generates multiple-choice quiz JSON. Body: `{ context?, num_questions? }` |

### FastAPI (direct RAG access — `localhost:8000`)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/chat` | RAG + Claude streaming chat (SSE) |
| `POST` | `/quiz` | RAG + Claude JSON quiz generation |
| `GET`  | `/health` | ChromaDB document count + status |

**Chat request example:**
```json
{ "query": "Is it waterproof?", "context_hint": "Built to Last" }
```

---

## Interaction Primitives

### `SlideFrame`
Enforces strict 16:9 aspect ratio with nav bar, progress bar, and completion hint.

```tsx
<SlideFrame
  currentSlide={2} totalSlides={5}
  onPrev={...} onNext={...}
  nextDisabled={!allHotspotsVisited}
  completionHint="Tap all 6 features to continue"
>
  {/* slide content */}
</SlideFrame>
```

### `Hotspot`
Pulsing dot positioned by percentage coordinates. Turns emerald green when visited.

```tsx
<Hotspot
  x={26} y={19}
  label="Snapdragon® 8 Gen 5"
  visited={visited.has("Snapdragon® 8 Gen 5")}
  onVisit={() => markVisited("Snapdragon® 8 Gen 5")}
  onOpen={() => setActiveLayer({ topic: "Snapdragon 8 Gen 5", title: "Snapdragon® 8 Gen 5" })}
/>
```

### `SlideLayer`
Bottom-sheet overlay with streaming AI chat.

```tsx
<SlideLayer
  open={activeLayer !== null}
  onClose={() => setActiveLayer(null)}
  title={activeLayer?.title ?? ""}
  topic={activeLayer?.topic}
  animation="up"
/>
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | Yes | From sanity.io/manage |
| `NEXT_PUBLIC_SANITY_DATASET` | No (default: `production`) | Sanity dataset name |
| `SANITY_API_TOKEN` | Yes (for Studio mutations) | Editor-level Sanity token |
| `ANTHROPIC_API_KEY` | No | Claude API key — omit for mock mode |
| `DATABASE_URL` | No (default: `file:./dev.db`) | SQLite path for progress tracking |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| CMS | Sanity (headless) + embedded Studio via `next-sanity` |
| Frontend | Next.js 16, React 19, TypeScript |
| Styling | Tailwind CSS v4, `tw-animate-css`, shadcn/ui v4 |
| AI | Anthropic Claude API (`claude-sonnet-4-6` chat · `claude-opus-4-8` quiz) |
| Backend | Python FastAPI, ChromaDB (vector store / RAG) |
| Database | SQLite + Prisma ORM (progress tracking, quiz attempts) |