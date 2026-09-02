-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "theme" TEXT NOT NULL DEFAULT 'moto-theme';

-- Backfill legacy Motorola-literal coverButtonColor values to theme-relative
-- semantic slots, so existing courses render identically after this change.
UPDATE "Course"
SET "cover" = jsonb_set(cover::jsonb, '{coverButtonColor}', '"primary"')
WHERE cover->>'coverButtonColor' = 'moto-indigo';

UPDATE "Course"
SET "cover" = jsonb_set(cover::jsonb, '{coverButtonColor}', '"secondary"')
WHERE cover->>'coverButtonColor' = 'moto-frost';

UPDATE "Course"
SET "cover" = jsonb_set(cover::jsonb, '{coverButtonColor}', '"tertiary"')
WHERE cover->>'coverButtonColor' = 'moto-pearl';

-- Same mapping inside already-frozen CourseRevision.snapshot, which mirrors
-- the CourseGraph shape (snapshot.cover.coverButtonColor). This preserves
-- exactly what a reviewer already approved rendered as; it does not change
-- any content, only the internal representation of the same visual choice.
UPDATE "CourseRevision"
SET "snapshot" = jsonb_set(snapshot::jsonb, '{cover,coverButtonColor}', '"primary"')
WHERE snapshot->'cover'->>'coverButtonColor' = 'moto-indigo';

UPDATE "CourseRevision"
SET "snapshot" = jsonb_set(snapshot::jsonb, '{cover,coverButtonColor}', '"secondary"')
WHERE snapshot->'cover'->>'coverButtonColor' = 'moto-frost';

UPDATE "CourseRevision"
SET "snapshot" = jsonb_set(snapshot::jsonb, '{cover,coverButtonColor}', '"tertiary"')
WHERE snapshot->'cover'->>'coverButtonColor' = 'moto-pearl';
