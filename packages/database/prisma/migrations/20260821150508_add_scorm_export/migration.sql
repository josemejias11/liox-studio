-- AlterEnum
ALTER TYPE "BackgroundJobKind" ADD VALUE 'SCORM_EXPORT';

-- CreateTable
CREATE TABLE "CourseScormExport" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "r2Key" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseScormExport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CourseScormExport_jobId_key" ON "CourseScormExport"("jobId");

-- CreateIndex
CREATE INDEX "CourseScormExport_revisionId_createdAt_idx" ON "CourseScormExport"("revisionId", "createdAt");

-- AddForeignKey
ALTER TABLE "CourseScormExport" ADD CONSTRAINT "CourseScormExport_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "CourseRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseScormExport" ADD CONSTRAINT "CourseScormExport_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "BackgroundJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
