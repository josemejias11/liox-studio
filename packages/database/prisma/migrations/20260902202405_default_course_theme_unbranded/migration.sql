-- Change the default for new courses from the Motorola theme to a neutral,
-- no-client-brand placeholder. Authors must now explicitly opt a course into
-- a client's palette via the theme picker; existing courses keep whatever
-- theme they already have (this only changes the column default applied
-- when a new row omits the field).
ALTER TABLE "Course" ALTER COLUMN "theme" SET DEFAULT 'unbranded';
