-- Drop the QUIZ_GENERATE background-job kind: it was never enqueued or
-- handled anywhere (no databaseKind mapping produced it, no executeJob
-- case handled it), and the parser-service/parser-client backend it would
-- have called has been removed too. Postgres has no direct "drop enum
-- value" statement, so recreate the type without it and repoint the column.
BEGIN;

ALTER TYPE "BackgroundJobKind" RENAME TO "BackgroundJobKind_old";

CREATE TYPE "BackgroundJobKind" AS ENUM ('DOCUMENT_INDEX', 'AI_OPERATION', 'SCORM_EXPORT', 'COURSE_DUPLICATE');

ALTER TABLE "BackgroundJob" ALTER COLUMN "kind" TYPE "BackgroundJobKind" USING ("kind"::text::"BackgroundJobKind");

DROP TYPE "BackgroundJobKind_old";

COMMIT;
