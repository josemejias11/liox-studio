# Web Modular Monolith Architecture

## Decision

Keep `apps/web/src/app` as the Next.js App Router boundary. Route files remain
transport and composition adapters only; product behavior belongs to feature
modules and server use cases.

The web app is one modular monolith with four product boundaries:

- `authoring`: Course Studio library, editor, sources, revisions, and AI draft generation.
- `learning`: learner player, lesson contracts, progress, quizzes, and grounded assistance.
- `review`: frozen master review and feedback. Review may consume the learning player, but never authoring UI.
- `analytics`: author-facing reporting and weak-topic queries.

Cross-cutting code belongs in `shared` or `server` only when it is genuinely
cross-feature. `lib` is not a domain boundary and should not grow new feature
logic.

## Target dependency direction

```text
app routes/pages
  -> feature UI and server use cases
    -> contracts / repositories / infrastructure adapters
```

Allowed product dependencies:

- `authoring -> learning` for the shared player viewport and lesson rendering.
- `review -> learning` for rendering frozen snapshots.
- `analytics -> learning` for learner telemetry shapes.
- `authoring` and `review` do not depend on each other's UI.

Database, R2, jobs, parser, and authentication are infrastructure adapters and
must not be imported directly by browser components.

## Target layout

```text
apps/web/src/
  app/                         # Next pages/layouts/route.ts only
  authoring/                   # Course Studio UI, model, client, server use cases
  learning/                    # Player UI, lesson model, learner server use cases
  review/                      # Review UI and review server use cases
  analytics/                   # Analytics UI and queries
  shared/                      # Cross-feature UI, HTTP, and utilities
  server/                      # Auth, storage, jobs, and infrastructure adapters

packages/contracts/            # Browser/API/job contracts
packages/database/             # Persistence repositories/adapters
packages/jobs/                 # Durable queue adapter
packages/parser-client/       # Parser-service adapter
```

## Migration rules

1. Preserve public URLs, lesson IDs, progress keys, and frozen revision hashes.
2. Move modules mechanically before changing behavior; retain temporary re-exports where needed.
3. Extract source/revision/generation commands before moving their route files.
4. Extract the shared learner viewport so author preview and external review do not depend on one another.
5. Remove obsolete Sanity code/configuration; do not add an archive or compatibility layer.
6. Treat any revision-lifecycle schema change as a separate migration decision. The current frozen-review behavior remains until its data migration is designed and verified.

## First implementation slice

- Declare `@moto-ai/contracts` explicitly in `@moto-ai/database`.
- Remove the empty obsolete `src/sanity` namespace.
- Establish feature/server directories with compatibility-preserving moves.
- Add import-boundary checks after the first moves.

