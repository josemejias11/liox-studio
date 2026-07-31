-- Generated drafts inherit their frozen source identities without duplicating
-- R2 objects. A DELETING lifecycle state keeps cleanup locators durable until
-- both external stores have accepted deletion.
ALTER TYPE "CourseSourceIndexStatus" ADD VALUE IF NOT EXISTS 'DELETING';

CREATE TABLE "CourseSourceBinding" (
    "courseId" TEXT NOT NULL,
    "sourceFileId" TEXT NOT NULL,

    CONSTRAINT "CourseSourceBinding_pkey" PRIMARY KEY ("courseId", "sourceFileId")
);

CREATE INDEX "CourseSourceBinding_sourceFileId_idx" ON "CourseSourceBinding"("sourceFileId");

ALTER TABLE "CourseSourceBinding" ADD CONSTRAINT "CourseSourceBinding_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CourseSourceBinding" ADD CONSTRAINT "CourseSourceBinding_sourceFileId_fkey"
    FOREIGN KEY ("sourceFileId") REFERENCES "CourseSourceFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
