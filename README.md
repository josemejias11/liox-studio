# Moto Tutor AI — eLearning Platform

An AI-powered eLearning platform that replaces traditional authoring tools (Articulate Storyline, Adobe Captivate) with a modern CMS-driven system. Lionbridge instructional designers create Motorola learning masters in the embedded Course Studio authoring workspace and manage course assets in Sanity. Learners interact with a 16:9 interactive course player featuring a localized AI course assistant and adaptive quiz generation based on their analytics.

---

## Architecture

The platform consists of a Next.js/Sanity web app, a durable Node job worker, shared internal TypeScript packages, and a Python FastAPI service for localized AI workloads.

The repository is an npm workspace for the Node applications and shared TypeScript packages. Run npm commands from the repository root; the Python parser remains an independently installable service under `services/parser-service`.

```text
Sanity CMS (headless) ───────────────┐
                                     ▼
apps/web (Next.js 16) ───────► apps/job-worker ───────► services/parser-service
  /course library                     │                    /api/upload
  /course/[slug]                      │                    /api/document
  /analytics                          │                    /api/chat
  /studio (Sanity + Course Studio)    │                    /api/generate-quiz
                                     ▼
                              packages/database (PostgreSQL)
```

**Data flow:**

1. Content is authored in Sanity Studio. Course files (PDF, PPTX, DOCX, **XLSX**) are uploaded through a persistent file library. Next.js writes each upload to a durable PostgreSQL job artifact, and the worker sends it to the Python `/api/upload` endpoint for ChromaDB indexing. Re-uploading the same filename replaces its chunks; deleting a file purges its chunks via `/api/document`.
2. The Python backend uses `markitdown` to parse the file and `langchain` + `ChromaDB` to embed and store the chunks locally.
3. Learner explores hotspots. A floating AI Assistant (`CourseAIFab`) queries the Python `/api/chat` endpoint to get course-specific answers generated locally by `llama3`.
4. Learner enters a Quiz phase. The Next.js app queues the learner's **weak topics** (hotspots not yet visited); the worker sends them to the parser service's `/api/generate-quiz` endpoint. The Python backend searches ChromaDB for those topics and uses `llama3` to dynamically generate a structured adaptive quiz. The course-level quiz always uses the AI path — no CMS-authored quiz required.
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

### Interaction presentations and learning cues

The player keeps one shared hotspot and progress model while adapting the visual presentation to the lesson family:

- **Interaction** and content hotspots use the classic pulsing hotspot and discovery panel.
- **Product Stage** hotspots show persistent labeled callouts on desktop and fall back to the classic hotspot treatment on smaller screens.
- **Canvas Product Inspection** hotspots use a reticle presentation while the learner explores the image and opens the existing discovery surface.
- **Split Screen**, **Scroll Story**, and content body copy can use inline **Learning Cue** annotations. In Studio, select text, choose **Learning Cue**, and set **Linked Feature Label** to the exact name of a hotspot or covered feature in that lesson. Learners can activate the cue inline; its visited state is shared with the lesson's existing progress tracking.

Learning cues are additive: text whose label does not resolve to a hotspot or covered feature remains ordinary body copy, and existing hotspot content keeps its current behavior.

### Quick Recall authoring

Any lesson can include a short **Quick Recall** activity. Set an optional **Quick Recall Topic**, then add **Quick Recall Features**. Each **Recall Prompt** is shown first; its **Revealed Answer** stays hidden until the learner selects **Reveal answer**. For lessons that use progress-based navigation, the learner can continue after every configured answer has been revealed.

Leave **Quick Recall Features** empty for lessons that do not need a recall moment. When a prompt refers to a hotspot or Canvas target, use the same label so the shared progress stays aligned.

The codebase is organized into focused modules with clear boundaries:

### Web app (`apps/web/src/`; entries below are relative to this directory)

| Module                    | Purpose                                                    |
| ------------------------- | ---------------------------------------------------------- |
| `lib/course-flow.ts`      | Course flow derivation and navigation item generation      |
| `lib/course-structure.ts` | Course structure types and helpers                         |
| `lib/course-content.ts`   | Sanity payload normalization to flat sections array        |
| `lib/quiz-session.ts`     | Quiz state reducer (answer selection, reveal, submission)  |
| `lib/quiz-grading.ts`     | Server-side quiz grading logic                             |
| `lib/progress-store.ts`   | Prisma progress persistence (hotspots, lessons, quizzes)   |
| `lib/chat-client.ts`      | Chat transport to `/api/chat` with response validation     |
| `lib/contracts/`          | Web-only Zod schemas for Sanity and API contracts          |
| `lib/server/http.ts`      | Shared server-side request parsing and API error responses |

### Shared packages

| Package                   | Purpose                                                     |
| ------------------------- | ----------------------------------------------------------- |
| `packages/database/`      | Prisma schema, migrations, and generated client             |
| `packages/contracts/`     | Shared TypeScript contracts                                 |
| `packages/jobs/`          | Durable queue persistence, claiming, leases, and retries    |
| `packages/parser-client/` | Typed client for the parser service                         |
| `apps/job-worker/src/`    | Standalone worker that executes queued document and AI jobs |

### Workspace commands

Run these from the repository root:

| Command               | Purpose                                                              |
| --------------------- | -------------------------------------------------------------------- |
| `npm install`         | Installs and links every npm workspace                               |
| `npm run dev`         | Starts the Next.js/Sanity web application                            |
| `npm run jobs:worker` | Starts the durable background-job worker                             |
| `npm run build`       | Applies Prisma migrations, then creates the production Next.js build |
| `npm run lint`        | Lints the applications, packages, and workspace runner               |
| `npm run typecheck`   | Type-checks every TypeScript workspace                               |
| `npm run db:generate` | Regenerates the Prisma client owned by `packages/database`           |
| `npm run db:migrate`  | Applies migrations from `packages/database/prisma/migrations`        |

`npm run build` requires the configured PostgreSQL server to be reachable because migrations run before Next.js compilation.

### Player (`apps/web/src/player/`)

| Module                                | Purpose                                                         |
| ------------------------------------- | --------------------------------------------------------------- |
| `MotoViewer.tsx`                      | Main course player shell                                        |
| `CoursePhaseScreen.tsx`               | Phase renderer (cover, lessons, quiz, disclaimer)               |
| `PlayerOverlays.tsx`                  | Course map, AI assistant, sync warning, and completion overlays |
| `NavMap.tsx`                          | Full-course navigation map                                      |
| `LessonRenderer.tsx`                  | Lesson type dispatcher                                          |
| `RefresherFeaturePanel.tsx`           | Shared Quick Recall prompt-and-answer panel                     |
| `hooks/useCourseNavigation.ts`        | Flow-based navigation state machine                             |
| `hooks/useLessonRuntime.ts`           | Current lesson completion, progress, and visit model            |
| `hooks/useCourseSession.ts`           | Session ID and consent persistence                              |
| `hooks/useWeakTopics.ts`              | Weak topic derivation and merge                                 |
| `lesson-types/InlineDiscoveryCue.tsx` | Inline rich-text learning cue and visited state                 |
| `lesson-types/registry.ts`            | Lesson type metadata and completion modes                       |

### Parser Service (`services/parser-service/`)

The parser service provides document indexing, course-grounded chat, and quiz
generation to the Node API routes and background worker. Its detailed module
ownership and operations guidance live in
[services/parser-service/docs](services/parser-service/docs/README.md).

### Authoring and discovery boundaries

- `apps/web/src/sanity/schemaTypes/lesson.ts` owns the Sanity lesson schema.
- `apps/web/src/components/course-ai/useChatConversation.ts` owns chat request cancellation, message state, and transport errors.
- `apps/web/src/components/discovery/` contains the learn-content and conversation views used by `DiscoveryPanel`.

---

## Performance & Privacy

- **Self-Hosted AI:** All chat and quiz generation runs on your own Ollama host (`llama3`). No proprietary course files or student queries are ever sent to third-party APIs (like OpenAI or Gemini).
- **Internal-Only AI Backend:** The browser never reaches the FastAPI service. Synchronous chat and deletion requests proxy through Next.js, while uploads and quiz generation run through the durable worker; both server paths carry a shared-secret `X-Internal-Token` header.
- **Server-Side Grading:** All quizzes (AI-generated and CMS-authored) are graded server-side; the answer key never reaches the browser.
- **Local Postgres:** Progress tracking and quiz attempts are stored in a local PostgreSQL database via Prisma. In production, swap for a managed PG instance (e.g. Supabase) by updating `DATABASE_URL` / `DIRECT_URL` in your environment.

---

## Getting Started

> **Five processes must run simultaneously.** The platform requires PostgreSQL, Ollama, the Python parser service, the background-job worker, and Next.js. Steps 2–4 below start the three application processes; keep PostgreSQL and Ollama running separately.

### Prerequisites

- Node.js 20+
- Python 3.11+
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
npm install
```

Copy the example env file and fill in your local values:

```bash
cp .env.example .env.local
```

The root `.env`/`.env.local` files are canonical for the Node workspaces. The parser service keeps its own `services/parser-service/.env` and `services/parser-service/chroma_db`.

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
cd services/parser-service
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -e '.[dev]'
cp .env.example .env            # one-time: token and tunables loaded automatically
python -m moto_parser
```

`python -m moto_parser` binds to `http://127.0.0.1:8000` by default. To use a different port set `PARSER_PORT`:

```bash
PARSER_PORT=9000 python -m moto_parser
```

Verify it's healthy:

```bash
curl http://localhost:8000/health
# {"status":"ok","ollama_reachable":true,"chroma_dir_writable":true,...}
```

---

### 3. Start the Background Job Worker

Open a new terminal at the project root:

```bash
npm run jobs:worker
```

The worker claims durable PostgreSQL jobs for document parsing/embedding and AI quiz generation. Keep it running alongside the parser service; requests receive a job ID immediately and the UI polls until the work completes.

---

### 4. Start the Next.js Frontend

Open a new terminal:

```bash
npm run db:migrate   # applies Prisma migrations to local PostgreSQL
npm run dev
# → http://localhost:3000
```

---

### 5. Connect Sanity Studio

The Sanity project ID is already set in `.env` (`e7l925v5`). You only need to:

1. Add your **API Token** to `.env.local` (see step 1 above).
2. Add `http://localhost:3000` to **CORS Origins** in [sanity.io/manage](https://sanity.io/manage) → your project → **API → CORS Origins** with **Allow credentials** checked.

The embedded Studio is then available at `http://localhost:3000/studio`.

---

## The Three UIs

### Course Player — learner view

`http://localhost:3000`

Strict 16:9 interactive player with animated lesson transitions, hotspot-gated navigation, and an AI chat panel for every feature.

| Component          | What it does                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------- |
| `LessonFrame`      | 16:9 locked frame, nav bar, progress bar, course map toggle                                             |
| `Hotspot`          | Pulsing dot positioned by %; turns emerald when visited                                                 |
| `CourseAIFab`      | Floating AI Assistant powered by Python `llama3` — available anywhere                                   |
| `DiscoveryPanel`   | Shows learn content + allows chatting with AI about specific features                                   |
| `ProductStage`     | 3D-style product view with floating hotspots and a completion burst animation                           |
| `CourseQuiz`       | Adaptive AI quiz — always shown at course completion, steered by the learner's unvisited hotspot topics |
| `SanityQuizPlayer` | Static CMS-authored quiz — shown only when a quiz document is explicitly attached to the course         |
| `NavMap`           | Full-course map with type icons and completion dots; Knowledge Check entry always visible               |

### Sanity Studio and Course Studio — authoring tools

`http://localhost:3000/studio`

`http://localhost:3000/studio` is the Lionbridge-only authoring environment. It contains both the standard Sanity tools and the custom **Course Studio** tool.

**Course Studio** — use this canvas-first workspace to create a Course from the Lionbridge template, add Chapters and learning screens, select screens in the outline, and edit the selected Course, Chapter, or Lesson in the inspector. Its block library exposes the ten learner-supported lesson types: Content, Hotspot Exploration, Product Stage, Video, In-lesson Quiz, Canvas Inspection, Colour Switcher, Split Screen, Drag and Drop, and Scroll Story.

Course Studio also keeps a **Master history**. **Freeze master** records the complete authored Course, its source revision, and a SHA-256 fingerprint as an immutable Sanity snapshot linked to that Course. A master is an internal Lionbridge record; it is not a localization workflow, agency package, asset export, or learner-content publishing action.

Use the standard Sanity structure and document editors for existing content management tasks that are not part of the Course Studio workflow.

**Course Material file library** — the Course document includes a persistent, additive file library. Upload `.pdf`, `.docx`, `.pptx`, and `.xlsx` files directly into ChromaDB for the AI to learn from. Each upload appends an entry; re-uploading the same filename replaces its chunks without adding a duplicate row. The ✕ button removes the Sanity record **and** purges the file's chunks from ChromaDB in one action.

> **Before uploading files from Studio:** you must first log in to the Instructor Dashboard at `http://localhost:3000/analytics/login` (password = `ANALYTICS_PASSWORD` from your `.env.local`). The upload endpoint shares the same auth cookie as the analytics dashboard. Once logged in the cookie lasts 7 days — you will not need to repeat this unless it expires or you clear your cookies.

**Lesson types** — each Lesson document has a `Lesson Type` field that controls which player component renders:

| Type            | Component                | Use for                                                                           |
| --------------- | ------------------------ | --------------------------------------------------------------------------------- |
| `content`       | `ContentLesson`          | Headline + body text, optional background image and hotspots                      |
| `interaction`   | `ContentLesson`          | Same as content but hotspots are required; drives the discovery flow              |
| `stage`         | `ProductStage`           | Full-bleed product image with floating hotspots and optional completion animation |
| `video`         | `VideoLesson`            | MP4 playback; supports 16:9, 1:1, 4:5, 9:16 aspect ratios                         |
| `splitScreen`   | `SplitScreenLesson`      | Left/right split — text on one side, video on the other; supports learning cues   |
| `quiz`          | in-lesson quiz           | CMS-authored quiz embedded inside the lesson flow                                 |
| `colorSwitcher` | `ColorSwitcherLesson`    | Up to 4 color variants with swappable product images                              |
| `dragDrop`      | `DragDropLesson`         | Drag chip to drop zone interaction with correctness feedback                      |
| `scrollStory`   | `ScrollStoryLesson`      | Scroll-driven chapters with parallax image pan/zoom/rotate and learning cues      |
| `canvas`        | `CanvasInspectionLesson` | Pan-and-zoom product inspection with feature targets                              |

**Quick Recall fields** — use `Quick Recall Topic` and `Quick Recall Features` on non-manual lesson types to add a short recall activity. Each prompt needs a concise revealed answer; learners must reveal every answer before the Next button unlocks.

**Rich text** — all body fields support standard decorators (bold, italic, underline, strike, code) plus **superscript** (`x²`, spec callouts like `5G¹`). Use the `Sup` button in the toolbar. Body copy and Scroll Story chapter text also support the **Learning Cue** annotation described above.

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

| Method   | Path                 | Description                                                                                                   |
| -------- | -------------------- | ------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/health`            | Readiness probe — Ollama reachability + ChromaDB writable. No auth.                                           |
| `POST`   | `/api/upload`        | Parses DOCX/PDF/PPTX/XLSX and upserts into ChromaDB. Re-uploading replaces previous chunks for that filename. |
| `DELETE` | `/api/document`      | Removes all ChromaDB chunks for a given `course_id` + `filename`.                                             |
| `POST`   | `/api/chat`          | Queries ChromaDB context + `llama3` to answer course questions.                                               |
| `POST`   | `/api/generate-quiz` | Analyzes weak topics and generates a JSON adaptive quiz via `llama3`.                                         |

### Next.js (`localhost:3000`)

The browser only ever calls these routes. Chat and deletion proxy directly to FastAPI; upload and quiz routes enqueue work that the background worker sends to FastAPI.

| Method   | Path                       | Description                                                  |
| -------- | -------------------------- | ------------------------------------------------------------ |
| `GET`    | `/api/progress?sessionId=` | Returns lesson progress for a session                        |
| `POST`   | `/api/progress`            | Upserts lesson progress and hotspot visits                   |
| `POST`   | `/api/chat`                | Proxies course Q&A to the parser service                     |
| `POST`   | `/api/quiz`                | Queues an AI quiz job; answer key stays server-side          |
| `POST`   | `/api/quiz/grade`          | Grades AI or CMS quizzes server-side and records the attempt |
| `POST`   | `/api/upload`              | Queues course-material indexing (50 MB cap per file)         |
| `DELETE` | `/api/upload`              | Proxies chunk deletion to the parser service                 |
| `GET`    | `/api/jobs/[id]`           | Returns client-safe background job status, result, or error  |

---

## Verification

```bash
# Node workspace checks (requires PostgreSQL for the full build)
npm run lint
npm run typecheck
npm run build

# Python parser-service checks (requires venv)
cd services/parser-service
./venv/bin/ruff check src
./venv/bin/ruff format --check src
./venv/bin/mypy src
./venv/bin/python -m compileall -f src/moto_parser
./venv/bin/python -m pip check
```

---

## Tech Stack

| Layer         | Technology                                                                |
| ------------- | ------------------------------------------------------------------------- |
| CMS           | Sanity (headless) + embedded Studio via `next-sanity`                     |
| Frontend      | Next.js 16, React 19, TypeScript (strict)                                 |
| Styling       | Tailwind CSS v4, `tw-animate-css`, shadcn/ui v4                           |
| AI Backend    | Python 3.11+, FastAPI, Uvicorn                                            |
| AI Models     | Ollama (`llama3` + `nomic-embed-text`), LangChain, ChromaDB, `markitdown` |
| Database      | PostgreSQL (local dev) + Prisma ORM v5                                    |
| Rate Limiting | Upstash Redis (gracefully disabled when env vars are unset)               |

---

## Dev vs Production

| Config             | Dev (local)                       | Production                                                     |
| ------------------ | --------------------------------- | -------------------------------------------------------------- |
| PostgreSQL         | Local instance (`localhost:5432`) | Managed PG, e.g. Supabase (update `DATABASE_URL`/`DIRECT_URL`) |
| AI backend         | Local Ollama (`localhost:11434`)  | Self-hosted Ollama server (update `PARSER_SERVICE_URL`)        |
| Rate limiting      | Disabled (empty Upstash env vars) | Upstash Redis (`UPSTASH_REDIS_REST_URL` + `_TOKEN`)            |
| Analytics password | Any value                         | Strong secret in hosting env vars                              |
