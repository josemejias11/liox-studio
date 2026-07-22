-- CreateEnum
CREATE TYPE "BackgroundJobKind" AS ENUM ('DOCUMENT_INDEX', 'QUIZ_GENERATE', 'AI_OPERATION');

-- CreateEnum
CREATE TYPE "BackgroundJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "BackgroundJob" (
    "id" TEXT NOT NULL,
    "kind" "BackgroundJobKind" NOT NULL,
    "status" "BackgroundJobStatus" NOT NULL DEFAULT 'QUEUED',
    "dedupeKey" TEXT,
    "payload" JSONB NOT NULL,
    "progress" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseExpiresAt" TIMESTAMP(3),
    "leaseToken" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "result" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackgroundJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobArtifact" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "contentType" TEXT,
    "bytes" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BackgroundJob_dedupeKey_key" ON "BackgroundJob"("dedupeKey");

-- CreateIndex
CREATE INDEX "BackgroundJob_status_runAfter_idx" ON "BackgroundJob"("status", "runAfter");

-- CreateIndex
CREATE INDEX "BackgroundJob_leaseExpiresAt_idx" ON "BackgroundJob"("leaseExpiresAt");

-- CreateIndex
CREATE INDEX "BackgroundJob_completedAt_idx" ON "BackgroundJob"("completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "JobArtifact_jobId_key" ON "JobArtifact"("jobId");

-- AddForeignKey
ALTER TABLE "JobArtifact" ADD CONSTRAINT "JobArtifact_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "BackgroundJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
