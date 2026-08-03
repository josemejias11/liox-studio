# Task 1 Report: Documentation and protected-surface cleanup

## Implementation

- Created `docs/architecture.md` with the current ownership model, dependency
  direction, every page/route-handler surface from the required inventory, and
  every root npm command.
- Created `docs/reset-database.md` with the destructive local reset procedure
  limited to the named `moto_ai_dev` database: stop Moto AI services, verify
  both connection URLs, recreate only that database, run `npm run db:migrate`,
  then start services.
- Replaced historical migration/release instructions in `README.md` and
  `DEPLOYMENT.md` with links to the current architecture and reset documents.
- Reduced `.gitignore` to local dependency installs, generated framework/Python
  cache state, and local environment files. It no longer hides source,
  migration SQL, plans, reports, or editor configuration.
- Deleted only the five historical reports/plans/specification named by the
  task brief.

## Commands and observed results

| Command | Result |
| --- | --- |
| `find apps/web/src/app -type f \\( -name page.tsx -o -name route.ts \\) \| sort` | Exit 0. Found 33 retained page and API route-handler files; their URLs are recorded in `docs/architecture.md`. |
| `npm run --silent --if-present` | Exit 0 with no output. Root script inventory was read from `package.json` and recorded in `docs/architecture.md`. |
| `rg -n --glob '!package-lock.json' --glob '!apps/web/.next/**' 'task-[235]-report|2026-07-30-course-studio-forward-authoring|20260728190000_add_course_lesson_trash' .` | Before edit, matches were historical documentation only: `README.md`, `DEPLOYMENT.md`, and the approved cleanup plan. After edit, only the approved 2026-08-03 cleanup plan retains historical names as task provenance. |
| `git diff --check` | Exit 0; no whitespace errors. |
| Scoped stale-term search over `README.md`, `DEPLOYMENT.md`, `docs/architecture.md`, and `docs/reset-database.md` | Exit 0 with no matches. |

No automated tests were added or run, per the task constraints.

## Files changed

- `.gitignore`
- `README.md`
- `DEPLOYMENT.md`
- `docs/architecture.md`
- `docs/reset-database.md`
- `.superpowers/sdd/2026-07-30-course-studio-forward-authoring/task-2-report.md` (deleted)
- `.superpowers/sdd/2026-07-30-course-studio-forward-authoring/task-3-report.md` (deleted)
- `.superpowers/sdd/2026-07-30-course-studio-forward-authoring/task-5-report.md` (deleted)
- `docs/superpowers/plans/2026-07-30-course-studio-forward-authoring.md` (deleted)
- `docs/superpowers/specs/2026-07-30-course-studio-forward-authoring-design.md` (deleted)

## Self-review

- Verified all required new documents are linked from both README or deployment
  guidance as applicable.
- Verified the active documentation has no historical forward-authoring task,
  migration-name, or deleted-report references.
- Verified the approved 2026-08-03 cleanup design and plan remain intact.
- Reviewed the diff for scope drift: no runtime source, migrations, package
  manifests, environment examples, or unrelated tracked files were changed.

## Concerns

- The repository had pre-existing untracked generated/local artifacts
  (`.playwright-mcp/`, `apps/web/next-env.d.ts`,
  `apps/web/tsconfig.tsbuildinfo`, and `services/parser-service/chroma_db/`).
  They were preserved and excluded from this commit.
- The database reset is documented only. No database was reset and no service
  was stopped or started for this task.

## Fix round 1

### Changes

- Corrected the current product surface: `/` redirects to `/studio`; the
  app has no `/course/[slug]/page.tsx`; the shared Moto Player currently serves
  Studio preview and frozen review.
- Corrected preview behavior: preview/review prevents learner identity,
  progress persistence, and weak-topic analytics, while a supplied revision or
  review identity conditionally enables optional, identity-scoped Course AI.
- Replaced bare `dropdb` and `createdb` guidance with a `DIRECT_URL`-derived
  local-only procedure that verifies both configured URLs, does not print
  credentials, and refuses non-local or non-`moto_ai_dev` targets.
- Split web and worker restart instructions into separate terminals.
- Documented `postinstall` as a lifecycle script and corrected the route
  inventory count from 32 to 33 (7 pages and 26 API route handlers).
- Added narrow ignore rules for browser-inspection artifacts, generated Next
  type metadata, TypeScript build info, and the parser-service Chroma database.

### Commands and observed results

| Command | Result |
| --- | --- |
| `find apps/web/src/app -type f \\( -name page.tsx -o -name route.ts \\) \| sort \| wc -l` | Exit 0; 33 files (7 pages and 26 route handlers). |
| Focused `rg` across app/player/review and docs | Confirmed `/` redirects to `/studio`; no learner `page.tsx` exists; review passes `reviewToken`, Studio passes a `revisionId` when available, and previews suppress progress/weak-topic calls. |
| `git check-ignore -v` for `.playwright-mcp/`, `apps/web/next-env.d.ts`, `apps/web/tsconfig.tsbuildinfo`, and parser Chroma data | Exit 0; each path is ignored by a narrow Task 1 rule. |
| `git diff --check` | Exit 0; no whitespace errors. |
| `git status --short` | Only the six scoped Task 1 files before staging; generated local artifacts no longer appear. |

No database reset, service stop/start, or automated test command was run.
