# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**DeckTutor AI** is an AI-powered eLearning platform. It is split into two services that must run concurrently:

- **`api/`** — Python FastAPI backend: ChromaDB vector store (RAG), streaming Claude AI responses
- **`web/`** — Next.js 16 frontend: Sanity CMS-driven course player, shadcn/ui components

## Dev Commands

### Backend (FastAPI)
```bash
cd api
source venv/bin/activate
export ANTHROPIC_API_KEY="..."
uvicorn main:app --reload
# Runs at http://localhost:8000 — Swagger docs at /docs
```

### Frontend (Next.js)
```bash
cd web
npm install
npm run dev      # http://localhost:3000
npm run build
npm run lint
```

## Architecture

### Data Flow
1. Course content is authored in Sanity CMS Studio (`/studio`)
2. `page.tsx` fetches module + slides from Sanity at render time via `sanityClient`
3. User asks a question → Next.js `/api/chat` → Claude streaming chat (SSE); the FastAPI `/chat` route remains available for direct RAG queries against ChromaDB
4. Quiz request → Next.js `/api/quiz` → Claude returns structured JSON

### Storage
- **Sanity CMS** — authoritative course content (modules, lessons, slides, hotspots)
- **ChromaDB** (`api/chroma_data/`) — vector embeddings for RAG, used by FastAPI chat/quiz routes

### Frontend Architecture
- `page.tsx` is a **server component** that fetches from Sanity via `sanityClient`
- `DeckViewer.tsx` is a **client component** — handles slide navigation state and the AI chat panel UI
- UI uses **shadcn/ui v4** components (in `src/components/ui/`) + **Tailwind CSS v4** + **tw-animate-css**
- Custom font: `MotoSans` loaded from `web/public/fonts/`

### API Routes (FastAPI — for direct RAG access)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/chat` | RAG + Claude streaming chat (SSE) |
| POST | `/quiz` | RAG + Claude JSON quiz generation |

### API Routes (Next.js — used by the frontend)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/chat` | Claude streaming chat (SSE) |
| POST | `/api/quiz` | Claude JSON quiz generation |

### Key Next.js Notes
This project uses **Next.js 16** with **React 19** — both contain breaking changes from earlier versions. Before editing framework-level code (layouts, routing, data fetching), check `node_modules/next/dist/docs/` for current API conventions (see `web/AGENTS.md`).

## Environment

- `ANTHROPIC_API_KEY` — used by both the FastAPI backend and the Next.js `/api/chat` and `/api/quiz` routes. Omit to run in mock mode.
- `NEXT_PUBLIC_SANITY_PROJECT_ID` — Sanity project ID (required for Studio and content fetching)
- `NEXT_PUBLIC_SANITY_DATASET` — Sanity dataset name (default: `production`)
- `SANITY_API_TOKEN` — Sanity editor token (required for Studio mutations)
Claude models in use: `claude-sonnet-4-6` (chat, in `web/src/app/api/chat/route.ts`), `claude-opus-4-8` (quiz, in `web/src/app/api/quiz/route.ts`), `claude-3-5-sonnet-20241022` (FastAPI RAG, in `api/services/claude_service.py`)
