# Task 9: reset baseline and retained-flow verification

## Outcome

The single Prisma baseline, production build, authenticated Studio
persistence, embedded preview, immutable frozen review, and review feedback
passed with observed command, browser, and database evidence. The repository
does not expose a public learner page, so persisted learner progress could not
be verified through a user-visible browser flow. README now states that current
surface accurately.

No automated test files were created and no unit-test command was run.

## Fresh database and build

Before browser verification, a direct count against the named local
`moto_ai_dev` database returned one `_prisma_migrations` row and zero courses,
revisions, reviews, feedback, sessions, progress rows, quiz attempts, generated
quizzes, and jobs.

| Check                               | Observed result                                                                                                                                                                                                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Checked-in migration count          | Exactly one `migration.sql`: `20260803000000_initial_course_studio`.                                                                                                                                                                                                |
| `npm ci --dry-run --ignore-scripts` | Passed; npm reported the dry-run package operation with exit 0.                                                                                                                                                                                                     |
| `npm run typecheck`                 | Passed for all six TypeScript workspaces.                                                                                                                                                                                                                           |
| `npm run lint`                      | Passed for `apps`, `packages`, and `scripts`.                                                                                                                                                                                                                       |
| `git diff --check`                  | Passed before runtime verification.                                                                                                                                                                                                                                 |
| `git status --short`                | Empty before runtime verification.                                                                                                                                                                                                                                  |
| `npm run db:migrate`                | Host run passed: one migration found and no pending migrations. The first sandboxed run returned Prisma P1001; host inspection showed PostgreSQL PID 816 listening on IPv4 and IPv6 port 5432, confirming sandbox isolation rather than a database-service failure. |
| `npm run build`                     | Passed: migration pre-step passed, Next.js 16.2.12 compiled, TypeScript completed, and 17/17 static pages generated.                                                                                                                                                |

### Format-command discrepancy

The requested `npm run format -- --check` is not a read-only check. The root
script expands to `prettier --write . --check`; it warned on 100 files and
rewrote 84 tracked files while exiting 0. Because the worktree was confirmed
clean immediately before the command, only those command-created edits were
reverted. This result is recorded as a script/configuration defect, not a
passing format check.

## Authenticated Studio persistence and preview

Verification ran with `agent-browser` against `http://localhost:3000` and the
fresh database.

- Authenticated `/studio/login` to `/studio`; the login POST and resulting
  Studio document request were observed. Browser page errors were empty and the
  console contained only development React/HMR messages.
- Created `Task 9 Retained Flow` from the empty library and opened its authoring
  workspace.
- Changed the description to `Task 9 persistence marker 2026-08-04` and saved.
  The browser displayed `Course saved`; the course PATCH returned HTTP 200.
- Reloaded the document. The description input retained the exact marker, the
  save button returned to its disabled clean state, and the embedded learner
  preview rendered the course cover and default `Welcome` content.
- Entered the embedded preview through the cover and chapter introduction. No
  progress API request was emitted. Database counts remained zero for sessions,
  lesson progress, hotspot visits, quiz attempts, generated quizzes, and jobs.
  Browser page errors were empty.

## Learner-progress requirement gap

Persisted learner progress is not browser-reachable in the current retained
surface:

- `README.md` already documented that there is no public `/course/[slug]` page.
- The Next.js page inventory contains only Studio, frozen review, analytics,
  and the root redirect.
- The only `PlayerViewport` consumers are Studio and frozen review, and
  `PlayerViewport` always starts `MotoViewer` in preview mode. Preview mode
  suppresses session and progress persistence.

Therefore no user-visible learner interaction could legitimately create and
reload persisted progress. The progress API still exists, but invoking it
directly would be API testing rather than the required browser learner flow.
README was clarified to avoid implying otherwise.

## Immutable review, feedback, and side-effect suppression

- Froze master revision 1. The revision POST returned HTTP 201, and Studio
  displayed that future authoring changes would not change it.
- Created and opened a tokenized review entirely inside the browser without
  adding the token to the report or a shell artifact. Revision lookup and
  review-link creation returned HTTP 200.
- Entered the frozen review player and reached the default `Welcome` lesson.
  No API side effect was emitted during the learner-style interaction.
- Submitted course-level feedback from `Task 9 Reviewer`. The browser displayed
  `Feedback submitted. Thank you.`; the sanitized feedback request returned
  HTTP 201.
- After freezing, changed the live authoring title to
  `Task 9 Live Draft After Freeze`, saved it, and reloaded the existing review.
  The review continued to render `Task 9 Retained Flow` as immutable revision 1.
- Final database evidence matched the browser: live title
  `Task 9 Live Draft After Freeze`, frozen source title
  `Task 9 Retained Flow`, one feedback row, and zero sessions, lesson progress,
  hotspot visits, quiz attempts, generated quizzes, and jobs.
- Browser page errors remained empty. Review-player console output contained
  only development React/HMR messages.

The temporary verification course remains because the product has no course
delete endpoint. A review token displayed by browser tab diagnostics was
immediately replaced after verification, invalidating that link; no token is
included in this report.

## Cleanup lineage and remaining risk

The preceding cleanup commits removed historical setup artifacts, obsolete
feature paths, duplicated Studio/player/server mechanics, unused runtime
configuration, the nine-migration history, orphaned source/exports, and stale
narrative comments. This task verified the resulting retained surfaces rather
than re-performing those deletion audits.

Remaining release risks are the misconfigured root format script and the lack
of a browser-reachable persisted learner flow. Parser, worker, R2 upload,
source indexing, grounded chat, and AI generation were not needed for the
retained flows above and were not started or claimed in this task.
