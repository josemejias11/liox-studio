# Total Repository Cleanup Design

## Goal

Make Moto AI easier to extend by removing repository debt while preserving the
current Course Studio, learner, review, analytics, job-worker, and parser
behaviour. This is an internal architecture and hygiene change, not a product
redesign.

The cleanup includes runtime code, unused exports, duplicate implementations,
deprecated compatibility paths, comments, scripts, configuration, environment
examples, dependencies, lockfile entries, documentation, and database migration
history.

## Fixed decisions

- Retain all current public URLs, lesson IDs, progress keys, frozen-review
  semantics, authoring controls, learning interactions, and optional grounded
  AI boundaries.
- Do not create a migration, archive, export, fallback, or compatibility layer
  for removed code or existing database data.
- Reset every database environment. Replace the existing Prisma migration
  history with one baseline migration generated from the retained schema.
- Remove comments that only narrate obvious code. Keep concise comments only
  for non-obvious invariants, security boundaries, platform constraints, or
  deliberate tradeoffs.
- Do not add automated test files. Establish confidence with static checks,
  fresh database migration evidence, build evidence, and browser verification.

## Target architecture

`apps/web/src/app` remains the Next.js routing and composition boundary. It
contains pages, layouts, and route handlers only. Product logic is grouped by
stable ownership:

```text
app routes and pages
  -> authoring | learning | review | analytics
  -> shared contracts and use cases
  -> server infrastructure adapters
  -> database | jobs | R2 | parser client
```

- `authoring` owns Course Studio UI, authoring state, inspector logic,
  source/revision/generation workflows, and Studio server use cases.
- `learning` owns the moto tutor, lesson renderers, progress, quiz runtime and
  grading, and grounded learner assistance.
- `review` owns immutable-review presentation and feedback. It consumes
  learning rendering rather than recreating it.
- `analytics` owns reporting UI and server queries.
- `shared` contains only code that is genuinely cross-feature: stable browser
  contracts, generic presentation utilities, and transport helpers.
- `server` owns authentication, storage, job, and parser adapters. Browser
  components must not import those adapters.

The Python parser service remains its focused five-module runtime boundary:
`main.py`, `contracts.py`, `documents.py`, `rag.py`, and `settings.py`, with
only retained supporting modules when their callers require them.

## Cleanup method

1. Inventory every tracked module, route, export, script, dependency,
   configuration key, documentation claim, and migration.
2. Establish the current runtime call graph from Next.js routes, entrypoints,
   package exports, and parser-service commands.
3. Move retained web code to its feature owner mechanically, updating all
   callers in the same change. Do not leave re-exports or transitional aliases.
4. Consolidate only demonstrably duplicated behaviour behind a focused owner;
   preserve route payloads, status codes, and user-visible behaviour.
5. Remove everything without a retained runtime, build, operational, or
   documentation owner. Update manifests and lockfiles in the same change.
6. Replace documentation with concise current architecture, setup, reset, and
   operational instructions. Remove historical plans and reports that no
   longer explain the repository.
7. Delete all existing Prisma migrations and create one baseline migration
   from the final schema. The new setup instructions must require recreating
   databases before applying it.

## Completion evidence

The cleanup is complete only when the following have observed results:

- no stale imports, orphaned routes, unused package dependencies, deprecated
  configuration, compatibility shims, or historical documentation claims
  remain;
- `npm ci --dry-run --ignore-scripts`, formatting/diff checks, `npm run
  typecheck`, and `npm run lint` succeed;
- a freshly created local database accepts the single baseline migration;
- `npm run build` succeeds after the reset database is available;
- authenticated browser checks prove Studio save/reload/preview, learner
  delivery/progress, and immutable review/feedback remain functional.

Checks blocked by unavailable local services or credentials are reported as
unverified risks, never as completed work.
