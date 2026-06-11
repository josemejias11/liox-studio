# Moto Tutor AI — eLearning Platform

An AI-powered eLearning platform that replaces traditional authoring tools (Articulate Storyline, Adobe Captivate) with a modern CMS-driven system. Instructional designers author content in a headless CMS; learners interact with it through a 16:9 interactive course player with AI-powered chat, quiz generation, and an instructor analytics dashboard.

---

## Architecture

A single Next.js 16 application — no separate backend service required.

```text
Sanity CMS (headless)
       │
       ▼
Next.js 16 (web/)
─────────────────
/                 course library
/course/[slug]    16:9 interactive course player
/analytics        instructor dashboard
/studio           Sanity authoring UI (embedded)
/api/chat         AI tutor — xAI Grok streaming (SSE)
/api/quiz         AI quiz generation — Google Gemini 2.0 Flash
/api/quiz/grade   Server-side quiz grading
/api/progress     lesson + layer progress (SQLite via Prisma)
```

**Data flow:**
1. Content is authored in Sanity Studio → published to the Sanity CDN.
2. `page.tsx` fetches course + lessons from Sanity at render time via the CDN read client.
3. Learner asks a question → `/api/chat` → xAI Grok streams a response (SSE).
4. Quiz request → `/api/quiz` → Google Gemini 2.0 Flash generates a structured JSON quiz, safely stores the correct answers server-side, and returns a client-safe version.
5. Quiz grading → `/api/quiz/grade` → verifies the submission securely server-side and automatically logs the attempt.
6. Hotspot visits and lesson progress → `/api/progress` → SQLite via Prisma.

---

## Performance & Security

Recent updates to the backend architecture include essential optimizations:
- **Rate Limiting:** A custom in-memory rate limiter protects AI endpoints (10 requests/minute for chat, 5 requests/minute for quiz generation) to prevent abuse.
- **TTL Cleanup:** Automatically drops generated quizzes older than 7 days during new quiz generation to prevent SQLite bloat.
- **SQLite WAL Mode:** Enabled Write-Ahead Logging (WAL) and increased `busy_timeout` (5000ms) on the Prisma SQLite connection to smoothly handle concurrent telemetry and progress writes without database locks.
- **Server-Side Grading:** The correct answers to both generated quizzes and Sanity-authored quizzes are never serialized to the client browser. Submissions are instead posted to the `/api/quiz/grade` endpoint to calculate scores and commit attempts securely.
- **Image Optimization & Layout Stability:** All images use Next.js `<Image />` with properly configured intrinsic dimensions to eliminate Cumulative Layout Shift (CLS) while retaining dynamic per-case design layouts.

---

## Getting Started

### Prerequisites
- Node.js 20+
- A free [Sanity account](https://sanity.io)
- An [xAI API key](https://x.ai) for the AI chat tutor (optional — mock mode works without one)
- A [Google AI Studio](https://aistudio.google.com) API key for quiz generation (optional — mock mode works without one)

---

### 1. Install and run

```bash
cd web
npm install
npm run db:migrate   # creates web/prisma/dev.db on first run
npm run dev
# http://localhost:3000
```

> `dev.db` is gitignored — run `npm run db:migrate` once after every fresh clone to recreate it.

---

### 2. Connect Sanity

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
XAI_API_KEY="your-xai-key"
GOOGLE_AI_STUDIO_API_KEY="your-gemini-key"
```

#### CORS Origins
In **sanity.io/manage → your project → API → CORS Origins**, add with **Allow credentials** checked:

| Origin | Purpose |
|--------|---------|
| `http://localhost:3000` | Embedded Studio + learner player |

#### API Token
In **sanity.io/manage → your project → API → Tokens** → **Add API token** → Permissions: **Editor**

---

### 3. Development & Testing

```bash
npm run test     # Run Vitest unit tests (e.g. course navigation, quiz grading)
npm run format   # Format the codebase with Prettier
npm run build    # Automatically deploys Prisma migrations before building
```

---

## The Three UIs

### Course Player — learner view
`http://localhost:3000`

Strict 16:9 interactive player with animated lesson transitions, hotspot-gated navigation, and an AI chat panel for every feature.

| Component | What it does |
|-----------|-------------|
| `LessonFrame` | 16:9 locked frame, nav bar, progress bar, course map toggle |
| `Hotspot` / `PulseHotspot` | Pulsing dot positioned by %; turns emerald when visited |
| `DiscoveryPanel` | Single-pane AI assistant — shows learn content + live Grok chat with upfront prompt suggestions |
| `ProductStage` | 3D-style product view with floating hotspots and a completion burst animation |
| `VideoLesson` | Native `<video>` with continue-gating |
| `QuizLesson` | Gemini-generated multiple-choice quiz with animated score screen |
| `CourseComplete` | Completion screen with rotating rings and stats (lessons, hotspots, %) |
| `NavMap` | Full-course map with type icons and completion dots |
| `LayerFrame` | Slide-in panel for hotspot layer content (video, images, interactions) |

### Sanity Studio — authoring tool
`http://localhost:3000/studio`

Where instructional designers create and publish course content.

**Content model:**
- **Course** — top-level unit (title, description, thumbnail, cover image, objectives, ordered chapters)
- **Chapter** — ordered collection of lessons
- **Lesson** — atomic content unit with:
  - `headline`, `body`, `media`
  - `lessonType`: `content` | `interaction` | `stage` | `video`
  - `hotspots[]` — label, AI topic query, x/y position (%)
  - `videoFile` — uploaded video (video lessons)
- **Specification** — product spec sheet attached to a course
- **Quiz** — Sanity-authored question bank (used as the course gate quiz)
- **Disclaimer** — legal/compliance page shown before course completion

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
2. Go to **Content > Courses** and click **Create new Course**.
3. Enter a **Title** and click **Generate** for the Slug.
4. Under the **Chapters** array, click **Add item**.
5. In the reference search, click **Create** to create a new nested Chapter.
6. Enter a **Title** for the Chapter and click **Generate** for the Slug.
7. Under **Lessons** in the Chapter, click **Add item** to create lessons.
8. Fill out the **Headline** and lesson content, then close the lesson dialog.
9. Click **Publish** on the Chapter, then click **Publish** on the parent Course.
10. Refresh `http://localhost:3000` — your course appears immediately.

**Lesson types:**

| Type | Description |
|------|-------------|
| `content` | Image or text lesson; optional hotspots |
| `interaction` | Hotspot-gated lesson — next locked until all hotspots visited |
| `stage` | 3D product view with floating discovery hotspots |
| `video` | Uploaded video file |

---

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/chat` | Streams xAI Grok tutor response (SSE). Body: `{ messages?, query?, lesson_content?, course_title?, course_description? }` |
| `POST` | `/api/quiz` | Generates multiple-choice quiz JSON via Gemini 2.0 Flash. Returns a safe version without answers. Body: `{ context?, num_questions? }` |
| `POST` | `/api/quiz/grade` | Grades quiz submissions securely against server-stored answers and logs the attempt. |
| `GET`  | `/api/progress?sessionId=` | Returns lesson and layer progress for a session |
| `POST` | `/api/progress` | Upserts lesson/layer progress or hotspot visits |

---

## Progress Tracking

Anonymous sessions are identified by a UUID stored in `localStorage` under the key `mototutor_session`. All progress is tied to this ID and persisted in SQLite.

| Table | Records |
|-------|---------|
| `Session` | One row per anonymous learner session |
| `LessonProgress` | Per-session, per-lesson: completion flag |
| `LayerProgress` | Per-session, per-layer: completion flag |
| `HotspotVisit` | Per-session, per-hotspot: visited label |
| `QuizAttempt` | Per-session, per-course: score, total, answers, timestamp |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | Yes | Sanity project ID — set in `web/.env` |
| `NEXT_PUBLIC_SANITY_DATASET` | No (default: `production`) | Sanity dataset name |
| `SANITY_API_TOKEN` | Yes (for Studio) | Editor-level Sanity token — set in `web/.env.local` |
| `XAI_API_KEY` | No | xAI API key for `/api/chat` — omit for mock mode |
| `GOOGLE_AI_STUDIO_API_KEY` | No | Gemini API key for `/api/quiz` — omit for mock mode |
| `DATABASE_URL` | No (default: `file:./prisma/dev.db`) | SQLite path — pre-set in `web/.env` |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| CMS | Sanity (headless) + embedded Studio via `next-sanity` |
| Frontend | Next.js 16, React 19, TypeScript (strict) |
| Styling | Tailwind CSS v4, `tw-animate-css`, shadcn/ui v4, MotoSans font |
| AI — Chat | xAI Grok (`grok-3-mini`) via OpenAI-compatible SDK |
| AI — Quiz | Google Gemini 2.0 Flash (`@google/generative-ai`) |
| Database | SQLite + Prisma ORM v5 (progress tracking, quiz attempts) |
| Testing & DX | Vitest, Prettier, TypeScript (strict with noUncheckedIndexedAccess) |
| Animations | Framer Motion |
