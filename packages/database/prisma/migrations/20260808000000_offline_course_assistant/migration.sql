CREATE TYPE "CourseAssistantQaStatus" AS ENUM ('DRAFT', 'APPROVED');

CREATE TABLE "CourseAssistantQa" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "questionVariants" JSONB NOT NULL,
  "matchingKeywords" JSONB NOT NULL,
  "approvedAnswer" TEXT NOT NULL,
  "citations" JSONB NOT NULL,
  "status" "CourseAssistantQaStatus" NOT NULL DEFAULT 'DRAFT',
  "sourceIds" JSONB NOT NULL,
  "sourceHashes" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CourseAssistantQa_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CourseAssistantQa_courseId_status_updatedAt_idx" ON "CourseAssistantQa"("courseId", "status", "updatedAt");
ALTER TABLE "CourseAssistantQa" ADD CONSTRAINT "CourseAssistantQa_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CourseRevisionAssistantQa" (
  "revisionId" TEXT NOT NULL,
  "assistantQaId" TEXT NOT NULL,
  "questionVariants" JSONB NOT NULL,
  "matchingKeywords" JSONB NOT NULL,
  "approvedAnswer" TEXT NOT NULL,
  "citations" JSONB NOT NULL,
  CONSTRAINT "CourseRevisionAssistantQa_pkey" PRIMARY KEY ("revisionId", "assistantQaId")
);
ALTER TABLE "CourseRevisionAssistantQa" ADD CONSTRAINT "CourseRevisionAssistantQa_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "CourseRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
