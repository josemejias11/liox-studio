# Codebase Assessment — Bloat & Dead Code Audit

Date: 2026-09-07 · Commit: `80345353` (branch `dev`)

## How this was done

Full read-through of every workspace (`apps/web`, `apps/job-worker`,
`packages/contracts`, `packages/database`, `packages/jobs`,
`packages/parser-client`, `packages/scorm-export`, `packages/storage`,
`services/parser-service`) plus root tooling, CI, and both docs files
(`README.md`, `GUIDE.md`), cross-checked against `git log` and actual
import/call-site grep across the repo — not just reading doc claims at
face value.

**Bottom line up front: this is a lean codebase, not a bloated one.** Every
package earns its place, dependencies are all in active use, and there's no
graveyard of half-finished features. The real findings are a handful of
concrete, verifiable items below, plus two stale-doc lines that are already
fixed.

---

## 1. Done: deleted

### `apps/web/src/authoring/inspectors/lesson/QuizQuestionsField.tsx` — deleted
100-line component, zero import sites anywhere in the repo (every sibling
field component in that directory had at least one real caller; this one
had none). It was the editable counterpart to the inline-quiz lesson type
that `LegacyInlineQuizInspector` now renders as a read-only "migrate to the
guided assessment editor" screen. Left behind when inline-quiz editing was
replaced by the chapter-quick-check / final-assessment flow.

### `packages/contracts/src/jobs.ts` — `CourseDuplicateLegacyPayloadSchema` / `CourseDuplicateFingerprintLegacyPayloadSchema` — deleted
Removed both schemas and their type exports. Collapsed
`normalizeCourseDuplicatePayload()` in `packages/jobs/src/queue.ts` to the
single current-schema path (dropped the `legacy` result flag along with the
two fallback-parse branches), and removed the now-unreachable claim-time
payload-migration block in the job-lease transaction that only fired when
`legacy` was true. This product has never carried production traffic and
`BackgroundJob` retention is 7 days, so no surviving job row could still be
in the old shape. `npm run typecheck` and `npm run lint` both pass clean
after the change.

---

## 2. Done: `BackgroundJobKind.QUIZ_GENERATE` and its backend — removed

Turned out to be bigger than the enum: a full, working backend existed with
zero callers (`services/parser-service`'s `POST /api/generate-quiz` +
`rag.py::generate_quiz`, and `packages/parser-client`'s `generateCourseQuiz()`
wrapper). Decision was to remove rather than finish it. Removed, in order:

- **Database**: dropped `QUIZ_GENERATE` from the `BackgroundJobKind` Prisma
  enum via a hand-written migration (Postgres has no direct "drop enum
  value," so it recreates the type and repoints the column) — confirmed zero
  existing `BackgroundJob` rows used it before altering.
- **`packages/jobs/src/queue.ts`**: removed the `QUIZ_GENERATE` entry from
  the `publicKind` map.
- **`packages/parser-client`**: removed `generateCourseQuiz()`,
  `ParserQuizResponseSchema`, `RagQuizQuestion`, `RagQuizResponse`.
- **`packages/contracts/src/quiz.ts`**: removed the unused
  `GenerateQuizRequestSchema` / `GenerateQuizRequest` (zero consumers even
  before this).
- **`services/parser-service`**: removed the `/api/generate-quiz` route,
  `rag.py::generate_quiz()`, its `QuizRequest`/`QuizQuestion`/`QuizResponse`/
  `QuizQuestionPayload`/`QuizPayload` pydantic models, and the
  `RETRIEVAL_K_PER_TOPIC` / `QUIZ_MAX_CONTEXT_DOCS` settings that only it
  used. Updated its README's endpoint table and description.
- **Docs**: removed the "Supplemental parser quiz generation" product-status
  row, the `/api/generate-quiz` HTTP-surfaces row, and the "Parser quiz
  generation is not registered" current-limitation bullet from root
  `README.md`.

`npm run typecheck` and `npm run lint` pass clean after the change.

## 3. Done: the `'ai'`-source quiz-grading path — removed

Follow-up decision: this feature is confirmed gone for good, so the related
finding above was removed too rather than left as permanent dead weight.
`apps/web/src/learning/server/quiz-grading.ts` had a `source === 'ai'`
branch reading a `GeneratedQuiz` Prisma row — but nothing in the codebase
ever wrote one, even before the `QUIZ_GENERATE` removal, so it was already
unreachable and had no path to ever become reachable.

Removed, since only the `'course'` source was ever actually exercised (the
only `ClientQuiz` constructor, `CourseQuizPlayer.tsx`'s `toClientQuiz`,
always hardcoded `source: 'course'`):

- **Database**: dropped the `GeneratedQuiz` model/table via migration
  (confirmed zero existing rows first; no FK pointed at it, so a plain
  `DROP TABLE` was safe). Updated `QuizAttempt`'s comment, which used to
  describe `quizId` as "`GeneratedQuiz.id` for AI quizzes or `CourseQuiz.id`
  for authored quizzes" — now just `CourseQuiz.id`.
- **`packages/contracts/src/quiz.ts`**: removed `ServerAiQuizSchema` and
  `QuizSourceSchema`/`QuizSource` entirely, and dropped the now-single-value
  `source` field from `ClientQuizSchema` and the grade/submit request
  schemas — it was never anything but `'course'` on the wire in practice.
- **`quiz-grading.ts`**: `loadQuizAnswerKey` dropped its `source` parameter
  and the whole `'ai'` branch; `AnswerKey.courseId` narrowed from
  `string | null` to `string` (only ever null on the removed branch).
- **`apps/api/quiz/grade/route.ts`**: dropped `body.source` plumbing.
- **`CourseQuizPlayer.tsx`**: dropped the hardcoded `source: 'course'` from
  `toClientQuiz` and both grade-request bodies.

`npm run typecheck` and `npm run lint` pass clean after the change.

---

## 4. Confirmed non-issues (checked because they looked suspicious, ruled out)

These were the strongest bloat *candidates* going in; all turned out to be
legitimate, wired-up architecture:

- **`packages/storage` vs `apps/web/src/server/storage`** — not a
  duplicate. `packages/storage` is the low-level local-filesystem object
  client (deliberately shaped like an S3/R2 SDK response —
  `Body.transformToWebStream()`, `$metadata.httpStatusCode` — so callers
  don't need to change if storage ever moves to real object storage);
  `apps/web/src/server/storage` is a thin, app-specific wrapper
  (`course-assets.ts`, `asset-signatures.ts`) around it. Both are actively
  imported by `apps/web`, `apps/job-worker`, `packages/database`, and
  `packages/scorm-export`.
- **`packages/scorm-export`** — fully wired: enqueued as `SCORM_EXPORT`
  jobs, built via `apps/job-worker`'s own `build` script and a dedicated
  CI step, downloaded through
  `apps/web/src/app/api/course-studio/exports/[exportId]/download`. Not
  documented in `CLAUDE.md`'s architecture table before this audit — now
  fixed (see §5).
- **`MotoSans` font + `Motorola`/`Yamaha` themes** — not leftover
  branding. `packages/contracts/src/course-themes.ts` implements
  deliberate multi-client theming (`unbranded` is now the default per a
  recent commit; `moto-theme` and `yamaha-theme` are selectable per-course
  options, with a code comment flagging the Yamaha palette as a
  placeholder pending real brand colors). The font file and CSS blocks are
  actively `@import`ed in both `apps/web/src/app/globals.css` and the SCORM
  player bundle's own stylesheet.
- **`services/parser-service` endpoints** — 4 authenticated routes
  (`generate-assistant-qa`, `upload`, `generate-course`, `document` delete)
  plus `/health`, after `generate-quiz` was removed in §2;
  `packages/parser-client` calls exactly those 4 paths and no others. 1:1,
  no orphans either direction.
- **`packages/database`'s repository files** — all nine repository modules
  are re-exported through the single `index.ts` barrel and consumed by
  `apps/web`/`apps/job-worker`; no module bypasses the repositories to hit
  Prisma directly, no repository is unused.
- **Root tooling** (`package.json`, `tsconfig.base.json`, `eslint.config.mjs`,
  `prisma.config.ts`, `.github/workflows/validate.yml`) — every dependency
  and script is in active use; nothing configures a tool the repo doesn't
  actually run. `zod`/`typescript` versions are consistent across
  workspaces, no version drift.
- **`apps/web` dependencies** (`framer-motion`, `lucide-react`,
  `next-themes`, `swr`, `tw-animate-css`, both `@portabletext/*` packages)
  — all have real call sites, including the CSS-only `tw-animate-css`
  import in `globals.css` that a source-only grep would have missed.
- **`apps/web/public/`** — only two files (the two `MotoSans` font
  weights), both referenced. No stray images.
- **`apps/web/src/app/course/[slug]/layout.tsx`** — exists with no sibling
  `page.tsx`, so the route 404s today. This matches CLAUDE.md's explicit
  statement that the public learner-delivery page doesn't exist yet; it's
  an intentional scaffold, not dead code.

---

## 5. Documentation fixes applied during this audit

- **`CLAUDE.md`** — its architecture table was missing `packages/scorm-export`
  and `packages/storage` entirely (both real, both wired up — see §4).
  Added both rows, and added the `npm run build
  --workspace=@lb-studio/scorm-export` command (run in CI, previously only
  documented in README) to the Commands section.
- **`README.md`** — its "Repository structure" tree still listed
  `docs/superpowers/` ("Historical implementation plans and design
  records"), a directory removed by commit `77a39bb9 chore: remove
  docs/superpowers planning records`. Removed the stale line.
- **`GUIDE.md`** — read in full; it's accurate, and it's not redundant with
  README. README is the architecture/setup/ops reference; GUIDE is a
  task-oriented "how do I actually use Course Studio" walkthrough (URLs,
  passwords, click-paths). No changes needed.

---

## 6. Lower-priority observations (not action items, just noted)

- **Parser-service test coverage**: only `tests/test_retrieval.py` and
  `tests/test_settings.py` exist against 10 source modules; none of the 5
  HTTP routes in `main.py` has an endpoint-level test. This is a coverage
  gap, not bloat — flagging since you asked for an honest assessment, and
  test debt is the inverse failure mode of code bloat.
- **Local, gitignored, non-repo disk usage** (informational only — none of
  this is tracked in git, so it isn't "bloat" in the codebase sense):
  `services/parser-service/venv/` (731M), `node_modules/` (910M),
  `services/parser-service/chroma_db/` (19M), `.mypy_cache/` (11M),
  `.ruff_cache/` (36K). Normal for a Python venv + two Node/Next
  installs; nothing to clean up in the repo itself.
- **`r2Key` / `r2KeyFor` naming** in `packages/storage` — vestigial naming
  from when the storage abstraction was presumably modeled after
  Cloudflare R2/S3, even though the only implementation today is local
  filesystem. Harmless, but a naming trap for a future reader expecting an
  actual R2 integration. Worth a rename only if you're touching that file
  anyway — not worth a dedicated pass.

---

## Net assessment

No graveyard of abandoned features, no forgotten packages, no dependency
cruft, no accidentally-committed build artifacts. All three findings (§1–§3)
are resolved — the dead component and legacy schemas deleted, and the whole
AI-quiz feature (job kind, parser-service route, `rag.py` function,
parser-client method, `GeneratedQuiz` model, and the `'ai'`-source grading
branch it fed) removed end to end rather than left half-wired.
`typecheck`/`lint` pass clean throughout. If you're looking for "where did
we overbuild," the honest answer is: you mostly didn't — the codebase is
smaller and more consistent than the amount of documented functionality
would suggest.

## Status

| Item | Status |
| --- | --- |
| `QuizQuestionsField.tsx` | Deleted |
| Legacy course-duplicate payload schemas | Deleted, `normalizeCourseDuplicatePayload` collapsed |
| `QUIZ_GENERATE` job kind + parser-service/parser-client backend | Deleted (all layers, incl. migration) |
| `'ai'`-source quiz grading (`GeneratedQuiz` model, `quiz-grading.ts` branch, `source` field) | Deleted (all layers, incl. migration) |
| Parser-service endpoint test coverage | Not started — lower priority |
| `r2Key` naming in `packages/storage` | Not started — rename opportunistically only |
