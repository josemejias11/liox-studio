# Task 7: Prisma reset baseline

## Scope and target safety

- Examined the current Prisma schema and retained repository consumers for
  course authoring, frozen reviews and feedback, learner progress, authored and
  generated quizzes, assets, sources, generations, and durable jobs.
- Before reset, `ps -Ao pid=,command=` found no Moto AI web, job-worker, or
  parser process. The only matches were the process scan itself.
- Sanitized configuration inspection confirmed both `DATABASE_URL` and
  `DIRECT_URL` target `localhost:5432/moto_ai_dev`. No credentials were printed.
- Recreated only `moto_ai_dev`; no server-wide PostgreSQL reset was used.

## Baseline result

- Removed nine historical migration directories and retained the PostgreSQL
  `migration_lock.toml` unchanged.
- Prisma created the migration natively with
  `npm run db:migrate:dev -- --name initial_course_studio --create-only`.
  The generated directory was renamed to the plan's stable baseline name:
  `20260803000000_initial_course_studio`.
- Inspected the SQL. It contains six enum creations, twenty table creations,
  indexes, and foreign-key `ALTER TABLE ... ADD CONSTRAINT` statements only;
  it contains no data mutations, drops, or schema-altering transformations.
- `npm run db:migrate` applied exactly one migration to the fresh
  `moto_ai_dev` database.

## Independent empty-database proof

- Created the controlled temporary target
  `localhost:5432/moto_ai_baseline_verify` from the already validated local
  connection, applied the checked-in baseline with `npm run db:migrate`, and
  observed 21 public tables (20 application tables plus `_prisma_migrations`)
  and one migration-ledger record.
- Removed `moto_ai_baseline_verify` after inspection.

## Verification

- `npm run db:generate` — passed; Prisma Client v5.22.0 generated.
- `npm run typecheck` — passed for all workspaces.
- `git diff --check` — passed.
- `find packages/database/prisma/migrations -mindepth 2 -maxdepth 2 -name migration.sql | wc -l` — `1`.

## Changed paths

- Deleted: the nine historical `packages/database/prisma/migrations/*/migration.sql` files.
- Created: `packages/database/prisma/migrations/20260803000000_initial_course_studio/migration.sql`.
- Created: this Task 7 report.

## Remaining risks

- The authorized reset intentionally removed all local `moto_ai_dev` data and
  migration ledger entries. R2 objects remain outside this database reset.
- No automated tests were created or run, per the cleanup plan constraint.
- Browser/user-flow verification is deferred to Task 9.
