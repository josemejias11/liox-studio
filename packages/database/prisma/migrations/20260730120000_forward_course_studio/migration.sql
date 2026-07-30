-- CreateEnum
CREATE TYPE "CourseSourceIndexStatus" AS ENUM ('PENDING', 'INDEXED', 'FAILED');

-- CreateEnum
CREATE TYPE "CourseGenerationStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "CourseSourceFile" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "r2Key" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "indexStatus" "CourseSourceIndexStatus" NOT NULL DEFAULT 'PENDING',
    "chunksStored" INTEGER,
    "indexError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseSourceFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseRevisionSource" (
    "revisionId" TEXT NOT NULL,
    "sourceFileId" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "filename" TEXT NOT NULL,

    CONSTRAINT "CourseRevisionSource_pkey" PRIMARY KEY ("revisionId","sourceFileId")
);

-- CreateTable
CREATE TABLE "CourseGeneration" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "sourceRevisionId" TEXT NOT NULL,
    "brief" TEXT NOT NULL,
    "promptTemplateVersion" TEXT NOT NULL,
    "requestedSourceIds" JSONB NOT NULL,
    "requestedSourceHashes" JSONB NOT NULL,
    "modelIdentifier" TEXT,
    "status" "CourseGenerationStatus" NOT NULL DEFAULT 'QUEUED',
    "result" JSONB,
    "error" TEXT,
    "createdCourseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CourseSourceFile_r2Key_key" ON "CourseSourceFile"("r2Key");

-- CreateIndex
CREATE INDEX "CourseSourceFile_courseId_indexStatus_idx" ON "CourseSourceFile"("courseId", "indexStatus");

-- CreateIndex
CREATE INDEX "CourseSourceFile_courseId_createdAt_idx" ON "CourseSourceFile"("courseId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CourseGeneration_jobId_key" ON "CourseGeneration"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseGeneration_createdCourseId_key" ON "CourseGeneration"("createdCourseId");

-- CreateIndex
CREATE INDEX "CourseGeneration_sourceRevisionId_createdAt_idx" ON "CourseGeneration"("sourceRevisionId", "createdAt");

-- CreateIndex
CREATE INDEX "CourseGeneration_status_createdAt_idx" ON "CourseGeneration"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "CourseSourceFile" ADD CONSTRAINT "CourseSourceFile_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseRevisionSource" ADD CONSTRAINT "CourseRevisionSource_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "CourseRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseRevisionSource" ADD CONSTRAINT "CourseRevisionSource_sourceFileId_fkey" FOREIGN KEY ("sourceFileId") REFERENCES "CourseSourceFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseGeneration" ADD CONSTRAINT "CourseGeneration_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "BackgroundJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseGeneration" ADD CONSTRAINT "CourseGeneration_sourceRevisionId_fkey" FOREIGN KEY ("sourceRevisionId") REFERENCES "CourseRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseGeneration" ADD CONSTRAINT "CourseGeneration_createdCourseId_fkey" FOREIGN KEY ("createdCourseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DropIndex
DROP INDEX "Course_status_createdAt_idx";

-- AlterTable
ALTER TABLE "Course" DROP COLUMN "status",
DROP COLUMN "sourceFiles";

-- DropEnum
DROP TYPE "CoursePublicationStatus";
