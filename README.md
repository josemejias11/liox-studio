# DeckTutor AI — eLearning Platform

An AI-powered eLearning platform that replaces traditional authoring tools (Articulate Storyline, Adobe Captivate) with a modern CMS-driven system. Instructional designers author content directly in a headless CMS; learners interact with it through a 16:9 interactive course player with AI-powered chat and quiz generation.

---

## Architecture

```
Sanity CMS (headless)          Next.js 16 (single service)
─────────────────────          ───────────────────────────
Module                    →    /               course player
  └── Lesson              →    /studio         authoring UI
        └── Slide               /api/chat       AI tutor (streaming)
              └── Hotspots       /api/quiz       quiz generation

                                SQLite (Prisma)
                                └── UserProgress, QuizAttempt
```

**No separate backend.** The Python FastAPI service and PPTX ingestion pipeline exist on `main` for reference but are not used on this branch (`exp`). Everything runs from a single `npm run dev`.

---

## Two UIs

### 1. Sanity Studio — authoring tool
`http://localhost:3000/studio`

Where instructional designers create and publish course content. Built on Sanity's customized Studio UI, embedded directly in the Next.js app. No separate install or login beyond the initial project setup.

**Content model:**
- **Module** — top-level course (title, description, thumbnail, learning objectives, ordered lessons)
- **Lesson** — a collection of slides (title, estimated duration)
- **Slide** — the atomic content unit with:
  - `headline`, `body`, `media` (image from Sanity CDN), `speakerNotes`
  - `slideType`: `content` | `interaction` | `video` | `quiz`
  - `hotspots[]` — for interaction slides: label, AI topic query, x/y position (%)

### 2. Course Player — learner view
`http://localhost:3000`

Strict 16:9 interactive player with:
- **SlideFrame** — locked aspect ratio, nav bar, progress bar, all inside the frame
- **Hotspot** — pulsing dot positioned by percentage; turns green when visited
- **SlideLayer** — bottom-sheet chat panel that streams AI explanation on open, then accepts follow-up questions scoped to the asset
- **Completion gating** — next slide locked until all hotspots on the current slide are visited

---

## Getting Started

### Prerequisites
- Node.js 20+
- A free [Sanity account](https://sanity.io) (for the Studio)
- An Anthropic API key (optional — mock responses work without one)

### 1. Install dependencies
```bash
cd web
npm install
```

### 2. Connect Sanity
1. Go to [sanity.io/manage](https://sanity.io/manage) → **Create new project** → copy the **Project ID**
2. Open `web/.env` and set:
```env
NEXT_PUBLIC_SANITY_PROJECT_ID="your-project-id"
NEXT_PUBLIC_SANITY_DATASET="production"
```

#### CORS Origins
In **sanity.io/manage → your project → API → CORS Origins**, add both with **Allow credentials** checked:

| Origin | Purpose |
|--------|---------|
| `http://localhost:3000` | Embedded Studio + learner player |
| `http://localhost:3333` | Standalone Sanity Studio |

#### API Token (required for Studio mutations)
In **sanity.io/manage → your project → API → Tokens** → **Add API token**:
- Name: anything (e.g. `Studio dev`)
- Permissions: **Editor**

Paste the token into `web/.env`:
```env
SANITY_API_TOKEN="your-token-here"
```

#### Two Studios, one dataset
Both Studio URLs write to and read from the same Sanity project:

| URL | What it is |
|-----|-----------|
| `http://localhost:3333` | Standalone Sanity Studio (run separately) |
| `http://localhost:3000/studio` | Embedded Studio (built into this Next.js app) |

**Use `localhost:3000/studio`** for authoring — it has the Module/Lesson/Slide schema already wired in. The standalone Studio at `3333` uses Sanity's default schema unless you configure it separately.

### 3. (Optional) Add your Anthropic API key
```env
ANTHROPIC_API_KEY="sk-ant-..."
```
Without a key the platform runs in **mock mode** — all AI responses are keyword-matched from a built-in script, streamed word-by-word so the UI animation still works.

### 4. Start the dev server
```bash
npm run dev
```

| URL | What it is |
|-----|-----------|
| `http://localhost:3000` | Learner course player |
| `http://localhost:3000/studio` | Sanity Studio (authoring UI) |

---

## Authoring a Course

1. Open `http://localhost:3000/studio`
2. Create a **Lesson** first — add slides, set types, upload images
3. Create a **Module** — reference your lessons, add thumbnail and objectives
4. Set **Published → true** on the Module
5. Refresh `http://localhost:3000` — your course appears immediately

For **interaction slides**, define hotspots in the Slide editor:
- Set `slideType` to `Interaction`
- Add hotspot entries with label, AI topic query, and x/y position (0–100%)
- The player renders the pulsing dots automatically

---

## API Routes

Both routes are Next.js route handlers — no external service required.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/chat` | Streams AI tutor response (SSE). Body: `{ query, context_hint? }` |
| `POST` | `/api/quiz` | Generates multiple-choice quiz JSON. Body: `{ context?, num_questions? }` |

**Chat request example:**
```json
{ "query": "Is it waterproof?", "context_hint": "Built to Last" }
```
`context_hint` pins the AI system prompt to the asset spec sheet. Without it, the AI answers from general course context.

---

## Interaction Primitives

Three composable Tailwind-first components give you full design control:

### `SlideFrame`
Enforces strict 16:9 aspect ratio with black letterboxing, nav bar, progress bar, and completion hint — all inside the frame.

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
  onOpen={() => setActiveLayer({ topic: "Snapdragon 8 Gen 5 – Life at full speed", title: "Snapdragon® 8 Gen 5" })}
/>
```

### `SlideLayer`
Bottom-sheet overlay with streaming AI chat. Auto-sends an initial explanation on open, then accepts follow-up questions.

```tsx
<SlideLayer
  open={activeLayer !== null}
  onClose={() => setActiveLayer(null)}
  title={activeLayer?.title ?? ""}
  topic={activeLayer?.topic}
  animation="up" // "up" | "down" | "fade"
/>
```

All design decisions (colors, animation speed, position, sizing) are made through `className` props — never hardcoded inside the components.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | Yes (for Studio) | From sanity.io/manage |
| `NEXT_PUBLIC_SANITY_DATASET` | No (default: `production`) | Sanity dataset name |
| `ANTHROPIC_API_KEY` | No | Claude API key — omit to use mock mode |
| `DATABASE_URL` | No (default: `file:./dev.db`) | SQLite path for progress tracking |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| CMS | Sanity (headless) + embedded Studio via `next-sanity` |
| Frontend | Next.js 16, React 19, TypeScript |
| Styling | Tailwind CSS v4, `tw-animate-css`, shadcn/ui v4 |
| AI | Anthropic Claude API (`claude-sonnet-4-6` for chat, `claude-opus-4-8` for quiz) |
| Database | SQLite + Prisma ORM (progress tracking, quiz attempts) |
| Dev tool | Claude Code CLI |

---

## Database Schema

Prisma manages two layers:

**Legacy** (PPTX-era, kept for reference): `Course`, `Slide`, `Quiz`, `Chat`

**Sanity-backed** (active):
- `SanityModule` — mirrors the Sanity Module `_id` as primary key
- `UserProgress` — per-session visited slides and completed lessons
- `QuizAttempt` — score, answers snapshot, timestamp per attempt

Upgrade from SQLite to PostgreSQL: change `provider = "postgresql"` in `prisma/schema.prisma` and update `DATABASE_URL`. No other changes needed.
