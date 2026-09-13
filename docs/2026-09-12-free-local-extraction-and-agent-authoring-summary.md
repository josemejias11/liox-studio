# Free Local Extraction + Agent-Packaged Course Authoring — Summary

**Date:** 2026-09-12
**Branch:** `dev` (pushed to `origin/dev` at `617653ff`)
**Spec:** [`docs/superpowers/specs/2026-09-12-free-local-extraction-and-agent-authoring-design.md`](superpowers/specs/2026-09-12-free-local-extraction-and-agent-authoring-design.md)
**Plan:** [`docs/superpowers/plans/2026-09-12-free-local-extraction-and-agent-authoring.md`](superpowers/plans/2026-09-12-free-local-extraction-and-agent-authoring.md)

## Why

The parser-service's existing authoring pipeline (source upload → chunk →
embed via OpenAI → retrieve for AI drafting) requires a real, billed OpenAI
API key. This project has no confirmed budget or company go-ahead yet, so
taking on that billed-API risk wasn't acceptable — but the product's
freeze/SCORM-export pipeline was hard-gated on successful *embedding-based*
indexing, meaning a course could never be exported without paying for
embeddings, even when every fact in it was hand-authored and verified
against real source documents.

Separately, the existing `course-studio-content-engineer` Claude Code
subagent was already a working, unpaid way to author a course (it runs on
the maintainer's own Claude Code plan, no separate metered key) — but it was
only usable by manually writing a custom dispatch prompt each time.

## What shipped

**A new `EXTRACTED` source-index status.** A source can now reach a
free, local-only "extracted" state — markitdown-based text extraction and
chunking, no embedding call — controlled by a new `EMBEDDINGS_ENABLED`
setting on the parser-service (default `false`). The revision-freeze gate
now accepts `EXTRACTED` **or** `INDEXED`, so a course built entirely from
free extraction can freeze and export to SCORM normally. The paid,
embedding-based `INDEXED` path — and everything downstream of it (Assistant
Q&A drafting, AI course generation) — is completely unchanged and still
available the moment there's a real budget; it just isn't required anymore.

**`/create-course <folder-path> [brief]`.** A new Claude Code slash command
that packages the existing `course-studio-content-engineer` agent into a
one-line, repeatable entry point: point it at a folder of source/media
files and a brief, and it inventories the folder, classifies files
(AI/citation source vs. lesson media vs. irrelevant), uploads sources
through the real Studio UI (browser-driven, never a bypass), and hand-authors
the course from the extracted text — since AI drafting is now the expected
unavailable case, not an edge case.

**Two real application bugs**, found and fixed while dry-running the whole
flow end-to-end:
1. `CourseInspector` (course-settings panel) was silently discarding
   unsaved edits whenever *any* unrelated save elsewhere in the course
   resolved while the panel was dirty.
2. Trashing a template-required lesson left a dangling
   `templateChecklist` reference that permanently blocked freezing —
   `trashLesson()` now prunes stale requirements in the same transaction.
   (The same bug class likely also affects chapter deletion and
   quick-check/final-assessment removal — not reproduced or fixed here,
   flagged as a follow-up.)

**One security-hardening fix**, from the final review: the new local
chunk-storage code turned `source_id`/`course_id` into literal filesystem
path components. `course_id` was already validated by the app; `source_id`
wasn't. Both are now validated against a safe charset before any path is
built (defense-in-depth — in the real app these IDs are always
server-generated `cuid()`s, so this wasn't exploitable through normal use,
but the new code no longer relies on that as its only protection).

## Where the pieces live

| Area | Change |
|---|---|
| `packages/database/prisma/schema.prisma` | `CourseSourceIndexStatus` enum gains `EXTRACTED` (additive migration) |
| `packages/contracts/src/course-studio.ts`, `jobs.ts` | `'extracted'` added to the status list; `DocumentIndexResultSchema` carries the new status |
| `packages/database/src/course-source-repository.ts` | `markSourceExtracted()` |
| `packages/database/src/course-review-repository.ts` | Freeze gate accepts `INDEXED` or `EXTRACTED` |
| `services/parser-service/.../settings.py` | `EMBEDDINGS_ENABLED`, `EXTRACTED_DIR`, `validate_source_id()` |
| `services/parser-service/.../runtime.py` | Only requires `OPENAI_API_KEY` when `EMBEDDINGS_ENABLED=true` |
| `services/parser-service/.../extraction_store.py` | New — local, no-embedding chunk persistence |
| `services/parser-service/.../documents.py`, `main.py` | Branches on `EMBEDDINGS_ENABLED`; `/health` reports `embeddings_enabled` |
| `packages/parser-client/src/index.ts`, `apps/job-worker/src/handlers.ts` | Carry the `indexed`/`extracted` status through to `markSourceExtracted`/`markSourceIndexed` |
| `apps/web/src/authoring/SourcePanel.tsx` | Shows "extracted — ready to freeze, not searchable by AI drafting" |
| `.claude/commands/create-course.md` | The new slash command |
| `.claude/agents/course-studio-content-engineer.md` | Updated for folder-path mode and the new default assumption |
| `apps/web/src/authoring/inspectors/CourseInspector.tsx` | Bug fix #1 |
| `packages/database/src/course-trash-repository.ts` | Bug fix #2 |

## Verified

Every task was implemented and reviewed individually, then the whole branch
was reviewed as one broad pass — including live verification against a
running instance: uploaded a source and watched it reach `EXTRACTED`, froze
a revision on `EXTRACTED`-only sources, exported a working SCORM package,
and dry-ran the full `/create-course` workflow to build a real course
("Vantage Pro Wireless Earbuds Overview") from a folder of files, hand-authored
end to end, frozen, and exported. `npm run typecheck` / `npm run lint`
(all 8 workspaces) and the parser-service's `ruff check .` / `mypy src` /
`unittest` (16 tests) are all green.

## Known follow-ups (not done here, intentionally out of scope)

- The dangling-`templateChecklist` bug class for chapter deletion and
  quick-check/final-assessment removal (only the lesson-trash path was fixed).
- `services/parser-service`'s HTTP routes (`main.py`) still have no
  endpoint-level test coverage — a pre-existing gap, not introduced or
  closed by this work.
- If Lionbridge greenlights the project with a real budget: revisit
  `EMBEDDINGS_ENABLED`'s default, decide the real generation-model provider
  (OpenAI, Anthropic, or Microsoft Copilot if Lionbridge provides access),
  and re-embed any `EXTRACTED` sources built under free mode.
