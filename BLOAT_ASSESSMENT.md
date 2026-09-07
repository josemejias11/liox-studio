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

## 2. Open: `BackgroundJobKind.QUIZ_GENERATE` — bigger than it first looked, holding for a product decision

Deeper look past the enum itself: this isn't just an idle `BackgroundJobKind`
value carried through `packages/jobs/src/queue.ts`'s `publicKind`
exhaustiveness map (line 45) with no `databaseKind` producer and no
`executeJob` case in `apps/job-worker/src/handlers.ts` — there's a full,
working backend for it that nothing calls:

- `services/parser-service/src/lb_studio_parser/main.py` exposes
  `POST /api/generate-quiz`, backed by `rag.py::generate_quiz(course_id,
  source_ids, weak_topics)`.
- `packages/parser-client/src/index.ts` has a typed `generateCourseQuiz()`
  wrapper for that exact route.
- **Zero callers of `generateCourseQuiz` anywhere in `apps/job-worker` or
  `apps/web`.**

The `weak_topics` parameter lines up with the "weak-topic indicators" the
Analytics dashboard already computes (per README) — this reads like a
designed remediation loop (analytics flags a weak topic → AI drafts a
supplemental quiz targeting it → worker runs the job) whose backend got
built and whose trigger never did. Already self-documented as a gap in
README's "Current limitations."

**Recommendation:** this is a product call, not a cleanup call:
- **Finish it** — add a `QUIZ_GENERATE` handler to `handlers.ts` calling
  `generateCourseQuiz`, wire a UI trigger (Analytics is the natural home,
  next to the weak-topic data). The backend is already done, so this is
  smaller than it looks.
- **Remove it** — if superseded by the guided chapter/final-assessment
  editor, remove all three layers together (Prisma enum value via
  migration, the parser-client method, the parser-service route and
  `rag.py` function) — not just the enum, or two dead layers get left
  behind instead of one.

Holding open until that direction is decided.

---

## 3. Confirmed non-issues (checked because they looked suspicious, ruled out)

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
  fixed (see §4).
- **`MotoSans` font + `Motorola`/`Yamaha` themes** — not leftover
  branding. `packages/contracts/src/course-themes.ts` implements
  deliberate multi-client theming (`unbranded` is now the default per a
  recent commit; `moto-theme` and `yamaha-theme` are selectable per-course
  options, with a code comment flagging the Yamaha palette as a
  placeholder pending real brand colors). The font file and CSS blocks are
  actively `@import`ed in both `apps/web/src/app/globals.css` and the SCORM
  player bundle's own stylesheet.
- **`services/parser-service` endpoints** — exactly 5 authenticated routes
  (`generate-assistant-qa`, `upload`, `generate-quiz`, `generate-course`,
  `document` delete) plus `/health`; `packages/parser-client` calls exactly
  those 5 paths and no others. 1:1, no orphans either direction.
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

## 4. Documentation fixes applied during this audit

- **`CLAUDE.md`** — its architecture table was missing `packages/scorm-export`
  and `packages/storage` entirely (both real, both wired up — see §3).
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

## 5. Lower-priority observations (not action items, just noted)

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
cruft, no accidentally-committed build artifacts. The two real deletions
(§1) are done — ~150 lines removed, `typecheck`/`lint` clean. The one open
design question (§2, `QUIZ_GENERATE`) is a known, self-documented gap, not
a surprise — held open pending a product decision on whether to finish or
remove the weak-topic quiz feature. If you're looking for "where did we
overbuild," the honest answer is: you didn't — the codebase is smaller and
more consistent than the amount of documented functionality would suggest.

## Status

| Item | Status |
| --- | --- |
| `QuizQuestionsField.tsx` | Deleted |
| Legacy course-duplicate payload schemas | Deleted, `normalizeCourseDuplicatePayload` collapsed |
| `QUIZ_GENERATE` / weak-topic quiz feature | Open — pending product decision (finish vs. remove all 3 layers) |
| Parser-service endpoint test coverage | Not started — lower priority |
| `r2Key` naming in `packages/storage` | Not started — rename opportunistically only |
