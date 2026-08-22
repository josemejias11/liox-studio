ALTER TYPE "BackgroundJobKind" ADD VALUE 'COURSE_DUPLICATE';
ALTER TABLE "Course"
  ADD COLUMN "createdFromTemplateKey" TEXT,
  ADD COLUMN "createdFromTemplateVersion" INTEGER,
  ADD COLUMN "templateChecklist" JSONB,
  ADD COLUMN "creationJobId" TEXT,
  ADD COLUMN "duplicatedFromCourseId" TEXT;
CREATE UNIQUE INDEX "Course_creationJobId_key" ON "Course"("creationJobId");
