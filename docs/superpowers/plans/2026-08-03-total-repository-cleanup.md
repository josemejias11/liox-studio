# Total Repository Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** Remove stale and duplicated repository code while retaining current Moto AI behavior and replacing all Prisma history with a clean reset baseline.

**Architecture:** Retain the Next.js App Router as the transport boundary. Move retained code into authoring, learning, review, analytics, shared, and server ownership areas; replace real duplicate behavior with one owner and remove obsolete paths rather than leaving compatibility shims.

**Tech Stack:** Next.js 16, React 19, TypeScript 6, Zod 4, Prisma 5/PostgreSQL, npm workspaces, FastAPI/Python 3.11.

## Global Constraints

- Preserve public URLs, lesson IDs, progress keys, frozen-review semantics, authoring controls, learning interactions, and optional grounded-AI boundaries.
- Reset every database environment; retain no existing data or Prisma migration ledger.
- Add no automated test files and run no unit-test command.
- Remove obsolete code, scripts, configuration, dependencies, comments, and documentation end-to-end. No re-exports, archives, fallbacks, or compatibility layers.
- Retain only comments that express a non-obvious invariant, security boundary, platform constraint, or deliberate tradeoff.
- Preserve unrelated user changes.

---

## Target ownership

| Area | Owner |
| --- | --- |
| Routing | \`apps/web/src/app\`: pages, layouts, route handlers, route-local parsing only |
| Authoring | \`apps/web/src/authoring\`: Studio UI, editor state, inspector logic, source/revision/generation use cases |
| Learning | \`apps/web/src/learning\`: player, lesson rendering, progress, quizzes, learner assistant |
| Review | \`apps/web/src/review\`: frozen revision rendering and feedback |
| Analytics | \`apps/web/src/analytics\`: reporting UI and queries |
| Shared | \`apps/web/src/shared\`: genuinely cross-feature presentation and transport utilities |
| Infrastructure | \`apps/web/src/server\`: auth, storage, jobs, parser, HTTP adapters |
| Persistence | \`packages/contracts\` and \`packages/database\`: browser-safe contracts and repositories |
| Parser | \`services/parser-service/src/moto_parser\`: live FastAPI parser modules only |

## Task 1: Preserve the product surface and replace historical docs

**Files:**
- Create: \`docs/architecture.md\`, \`docs/reset-database.md\`
- Modify: \`README.md\`, \`DEPLOYMENT.md\`, \`.gitignore\`
- Delete: \`.superpowers/sdd/2026-07-30-course-studio-forward-authoring/task-{2,3,5}-report.md\`
- Delete: \`docs/superpowers/plans/2026-07-30-course-studio-forward-authoring.md\`
- Delete: \`docs/superpowers/specs/2026-07-30-course-studio-forward-authoring-design.md\`

**Interfaces:** Consume existing routes and package commands. Produce current architecture and reset guidance with no historical migration-specific operational instructions.

- [ ] **Step 1: Inventory protected URLs and commands.** Run \`find apps/web/src/app -type f \\( -name page.tsx -o -name route.ts \\) | sort\` and \`npm run --silent --if-present\`. Record every retained surface in \`docs/architecture.md\`.
- [ ] **Step 2: Prove historical docs/reports are not runtime inputs.** Run \`rg -n --glob '!package-lock.json' --glob '!apps/web/.next/**' 'task-[235]-report|2026-07-30-course-studio-forward-authoring|20260728190000_add_course_lesson_trash' .\`. Matches must be historical content only.
- [ ] **Step 3: Write concise final docs.** \`docs/architecture.md\` defines ownership and dependency direction; \`docs/reset-database.md\` defines stop service, recreate only the named Moto AI database, \`npm run db:migrate\`, then service startup. Link these from README/deployment and remove old migration/release claims.
- [ ] **Step 4: Delete listed reports/plans and update ignore rules.** Ignore generated local state only: \`.next/\`, Python caches, and local env files. Do not hide source or migration SQL.
- [ ] **Step 5: Verify and commit.** Run \`git diff --check\`, then the stale-reference search across README, DEPLOYMENT, docs, and .superpowers. Commit with \`docs: replace historical setup guidance\`.

## Task 2: Complete the web feature-boundary move

**Files:**
- Create: \`apps/web/src/{authoring,analytics,shared}/\`, \`apps/web/src/{learning,review}/server/\`
- Move: \`course-studio/** -> authoring/**\`; \`player/** -> learning/player/**\`; review UI -> \`review/**\`; \`services/analytics.service.ts -> analytics/server/analytics.service.ts\`
- Modify: imports under \`apps/web/src/app/**\`
- Delete: \`apps/web/src/sanity/**\` and empty old roots

**Interfaces:** Routes import feature UI/use cases; feature server modules import \`server\` adapters; browser components never import Prisma, R2, jobs, or parser clients.

- [ ] **Step 1: Capture import edges.** Run \`rg -n "from ['\\\"]@/(course-studio|player|review|services|lib)/" apps/web/src\`; use results as the mechanical caller checklist.
- [ ] **Step 2: Move authoring modules.** Move Studio components, inspectors, client/types/panel hook, and \`server/authoring/{generation,source}-commands.ts\` under \`authoring\`. Update pages/routes at the same time; create no old-path forwarding module.
- [ ] **Step 3: Move learning/review/analytics modules.** Retain \`learning/PlayerViewport.tsx\` as the shared learner-rendering entry point. Review consumes it; author preview consumes it. Move analytics queries under its feature.
- [ ] **Step 4: Move only generic code to shared.** Generic presentation, focus behavior, utilities, and HTTP helpers qualify. Auth, R2, jobs, and parser code remain server infrastructure.
- [ ] **Step 5: Delete old roots and verify.** Run \`rg -n "@/(course-studio|player|services|sanity)/" apps/web/src || true\`, \`find apps/web/src -type d -empty | sort\`, \`npm run typecheck\`, and \`npm run lint\`. Commit with \`refactor: complete web feature boundaries\`.

## Task 3: Consolidate Course Studio state and inspector mechanics

**Files:**
- Modify: \`apps/web/src/authoring/CourseStudioWorkspace.tsx\`, \`inspectors/{CourseInspector,LessonInspector}.tsx\`
- Modify: \`inspectors/lesson/{lesson-draft,lesson-serializer,RepeatableField,AssetCollectionField,HotspotsField,QuizQuestionsField,ScrollChaptersField,VariantsField}.tsx\` (use \`.ts\` for the first two)

**Interfaces:** Consume \`CourseGraph\` from \`@moto-ai/contracts/course-studio\`. Produce one lossless draft/serialization path that preserves Portable Text, asset metadata, hotspot removal, and \`layerLink\`.

- [ ] **Step 1: Identify real duplicates.** Run \`rg -n 'crypto\\.randomUUID|setDraft|onRemove|onAdd|onMove|mergeKnownFields|jsonObject' apps/web/src/authoring\`. Share collection mechanics only; retain type-specific validation/defaults.
- [ ] **Step 2: Reduce workspace responsibility.** Extract focused load/save, selection, and panel-layout hooks/components. Keep \`CourseStudioWorkspace\` as coordinator with identical route-facing props and command order.
- [ ] **Step 3: Centralize collection mechanics.** Make \`RepeatableField\` own append, replace-by-client-key, reorder, and remove. Concrete fields retain their labels and conversion semantics.
- [ ] **Step 4: Centralize persistence conversion.** \`lesson-draft.ts\` owns client keys/normalization; \`lesson-serializer.ts\` owns JSON serialization and explicit deletion. Remove direct spread/cleanup duplicates from inspectors.
- [ ] **Step 5: Remove narrative comments; retain lossless-data and storage failure invariants.** Verify each lesson type reaches shared draft/serializer with \`rg -n 'mergeKnownFields|serialize.*Lesson|createCourseStudioKey' apps/web/src/authoring\`, then run typecheck/lint. Commit \`refactor: consolidate studio editing state\`.

## Task 4: Simplify the learner player without merging distinct learning roles

**Files:**
- Modify: \`apps/web/src/learning/{PlayerViewport,player/LessonRenderer,player/LessonFrame,player/MotoViewer}.tsx\`
- Modify: \`apps/web/src/learning/player/hooks/{useCourseNavigation,useCourseSession,useLessonProgress,useLessonRuntime,useWeakTopics}.ts\`
- Modify: \`apps/web/src/learning/player/lesson-types/registry.ts\`
- Move/modify: learner-only files currently under \`apps/web/src/components/**\`

**Interfaces:** One renderer registry maps persisted lesson type to renderer. Session/persistence retains existing progress keys and preview/review side-effect suppression.

- [ ] **Step 1: Classify quiz/chat roles before sharing code.** Run \`rg -n 'CourseQuiz|CourseQuizPlayer|CourseChat|useChatConversation|quiz.*grade|/api/chat' apps/web/src\`. Keep authored quick checks, optional AI quizzes, and grounded chat separate when their privacy/persistence contracts differ.
- [ ] **Step 2: Give registry exclusive renderer ownership.** Remove duplicate lesson-type switches; retain the current safe unknown-type fallback.
- [ ] **Step 3: Separate navigation from persistence.** Keep transition rules in \`useCourseNavigation\`; progress reads/writes and preview/review suppression in session/progress hooks. Extract one pure shared completion/next helper only if it replaces real duplicate calculations.
- [ ] **Step 4: Relocate learner-only components and delete retired branches.** Remove proven dead \`courseMode\`, legacy-payload, and fallback paths; retain preview/review guards.
- [ ] **Step 5: Verify.** Run \`rg -n 'switch \\(.*lessonType|COURSE_LESSON_TYPES' apps/web/src/learning\`, \`rg -n 'courseMode|sanity' apps/web/src || true\`, typecheck, lint. Commit \`refactor: simplify learner runtime\`.

## Task 5: Make API routes thin and server access single-owner

**Files:**
- Modify: every \`apps/web/src/app/api/**/route.ts\`
- Modify/Create: \`apps/web/src/{authoring,learning,review,analytics}/server/**\`
- Modify: \`apps/web/src/server/**\`

**Interfaces:** Preserve each route URL, method, request schema, authorization, response payload, success status, and error status. Routes delegate to one feature use case; adapters remain server-owned.

- [ ] **Step 1: Make a route-semantic matrix from source.** For every route record method, auth function, schema, use case, success status, and error paths. Similar names are not evidence of identical behavior.
- [ ] **Step 2: Extract actual duplicate orchestration.** Share identical auth/parse/repository/job/error logic in feature server modules; leave route-specific parsing/status rules intact.
- [ ] **Step 3: Enforce infrastructure direction.** Prisma, R2, jobs, parser-client, and token/password validation stay in \`server\`; feature server code may use them; browser TSX may not.
- [ ] **Step 4: Delete old helper/route paths only after caller and public-route review.** Verify \`find apps/web/src/app/api -name route.ts | sort\`, then \`rg -n '@moto-ai/(database|jobs|parser-client)|@aws-sdk/client-s3' apps/web/src --glob '*.tsx'\`, typecheck, lint. Commit \`refactor: centralize web server use cases\`.

## Task 6: Purge unused dependencies, scripts, configuration, and parser residue

**Files:**
- Modify: root/workspace \`package.json\`, \`package-lock.json\`, Next/PostCSS/ESLint/TypeScript config, \`.env.example\`, \`.env.local.example\`, parser env/readme/pyproject
- Modify/Delete: unused \`services/parser-service/src/moto_parser/**\`
- Modify/Delete: \`scripts/run-workspace.mjs\` only after proving native workspace scripts preserve its behavior

**Interfaces:** Every manifest item, env key, script, config key, and Python dependency has a retained caller/operational owner.

- [ ] **Step 1: Compare declarations to imports/entrypoints.** Run \`npm ls --all --depth=0\`, import scans across apps/packages/scripts, and Python import scans. Identify a retained caller before keeping a direct dependency.
- [ ] **Step 2: Remove unused direct dependencies via the owning npm workspace.** Use \`npm uninstall\`, then let npm regenerate lockfile; never hand-edit it.
- [ ] **Step 3: Remove un-read configuration/env keys.** Trace readers without printing local environment values. Retain placeholders only for active services.
- [ ] **Step 4: Reduce parser service to live FastAPI and worker paths.** Preserve authenticated revision/source-scoped retrieval; never restore a global legacy corpus.
- [ ] **Step 5: Decide runner fate from evidence.** Keep \`run-workspace.mjs\` only if \`npm --workspace\` cannot preserve root command behavior. Otherwise replace callers/docs and delete it.
- [ ] **Step 6: Verify and commit.** Run \`npm ci --dry-run --ignore-scripts\`, typecheck, lint, and stale-term scan. Commit \`chore: remove unused runtime configuration\`.

## Task 7: Replace Prisma history with one reset baseline

**Files:**
- Modify: \`packages/database/prisma/schema.prisma\`, \`migration_lock.toml\`, reset docs
- Delete: all nine current \`packages/database/prisma/migrations/*/migration.sql\` directories
- Create: \`packages/database/prisma/migrations/20260803000000_initial_course_studio/migration.sql\`

**Interfaces:** One migration creates the exact final schema from an empty PostgreSQL database. No previous data or Prisma migration ledger is supported.

- [ ] **Step 1: Inspect final schema and repository use.** Confirm every retained course, review, feedback, progress, quiz, asset, source, generation, and job repository field exists in the schema.
- [ ] **Step 2: Stop only Moto AI processes and confirm the reset target.** Read host/database name without emitting credentials. If the URL identifies shared/production infrastructure, stop for explicit operational confirmation.
- [ ] **Step 3: Drop/recreate only the named Moto AI database.** Do not use a broad PostgreSQL reset command.
- [ ] **Step 4: Delete old migration directories, retain lockfile, and generate the baseline.** Run \`npm run db:migrate:dev -- --name initial_course_studio\`. Inspect SQL: it must be creation-only for the final schema.
- [ ] **Step 5: Prove a second empty database can apply checked-in baseline.** Use a controlled disposable database and \`npm run db:migrate\`.
- [ ] **Step 6: Regenerate client/update docs/verify.** Run \`npm run db:generate\`, assert \`find packages/database/prisma/migrations -mindepth 2 -maxdepth 2 -name migration.sql | wc -l\` is 1, then typecheck and diff-check. Commit \`refactor: reset course studio database baseline\`.

## Task 8: Remove remaining orphaned source and comments

**Files:** Modify/Delete proven-unowned files and exports under \`apps/\`, \`packages/\`, \`services/\`, and \`scripts/\`.

**Interfaces:** A file is retained only if an import, route/entrypoint, package export, build/config reader, or current document owns it.

- [ ] **Step 1: Generate candidates.** Run tracked-file list, export scan, and \`find apps packages services scripts -type d -empty | sort\`.
- [ ] **Step 2: Check four ownership sources before deletion.** Search imports, Next.js routes/entrypoints, package exports, and runtime reflection/config references. Textual import absence alone never authorizes deletion of routes, schemas, or Python entry points.
- [ ] **Step 3: Delete genuine orphans and unused exports.** Update barrels to expose only public contracts; delete empty barrels/directories.
- [ ] **Step 4: Review comments by purpose.** Run \`rg -n '//|/\\*|#' apps packages services scripts --glob '*.{ts,tsx,js,mjs,py}'\`. Delete narration and stale legacy explanations; retain the explicitly allowed invariant categories.
- [ ] **Step 5: Verify and commit.** Run empty-dir scan, stale-term scan, typecheck, lint. Commit \`refactor: remove obsolete source paths\`.

## Task 9: Verify reset baseline and retained user flows

**Files:** Modify \`README.md\` or \`docs/reset-database.md\` only if observed behavior proves instructions inaccurate.

**Interfaces:** Produce observed evidence for static checks, fresh migration, build, Studio persistence, learner progress, and immutable review feedback.

- [ ] **Step 1: Run source integrity checks.** \`npm ci --dry-run --ignore-scripts\`, \`npm run format -- --check\`, \`npm run typecheck\`, \`npm run lint\`, \`git diff --check\`, and \`git status --short\` must be observed.
- [ ] **Step 2: Apply baseline and build.** Run \`npm run db:migrate\` and \`npm run build\`. On database connectivity failure, run \`pg_isready -h localhost -p 5432\` and report it as an external blocker.
- [ ] **Step 3: Verify Studio in browser.** Against the fresh database, authenticate at \`/studio/login\`, create/open a course, edit a supported field, save, reload, and inspect embedded preview. Capture console errors and failed requests.
- [ ] **Step 4: Verify learner and review in browser.** Complete one learner interaction and observe the existing progress behavior. Freeze/open a review, submit feedback, and verify immutable review suppresses progress/AI side effects.
- [ ] **Step 5: Fix root causes and rerun affected evidence.** Update docs only for observed discrepancies. Commit corrections with \`chore: verify cleaned course studio\`.
- [ ] **Step 6: Report release evidence.** State migration count, removed categories, observed commands, verified browser flows, and unavailable-service risk; never claim unobserved persistence/migration/browser success.
