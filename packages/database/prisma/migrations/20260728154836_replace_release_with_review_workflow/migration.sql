/*
  Warnings:

  - You are about to drop the `CourseRelease` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "CourseRevisionStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CourseFeedbackStatus" AS ENUM ('OPEN', 'RESOLVED');

-- DropForeignKey
ALTER TABLE "CourseRelease" DROP CONSTRAINT "CourseRelease_courseId_fkey";

-- DropTable
DROP TABLE "CourseRelease";

-- DropEnum
DROP TYPE "CourseReleaseStatus";

-- CreateTable
CREATE TABLE "CourseRevision" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "sourceTitle" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "CourseRevisionStatus" NOT NULL DEFAULT 'DRAFT',
    "snapshot" JSONB NOT NULL,
    "notes" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseReview" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "accessTokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseReviewFeedback" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "lessonId" TEXT,
    "anchor" JSONB,
    "authorName" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "CourseFeedbackStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "CourseReviewFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseRevision_courseId_createdAt_idx" ON "CourseRevision"("courseId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CourseRevision_courseId_version_key" ON "CourseRevision"("courseId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "CourseRevision_courseId_sourceHash_key" ON "CourseRevision"("courseId", "sourceHash");

-- CreateIndex
CREATE UNIQUE INDEX "CourseReview_revisionId_key" ON "CourseReview"("revisionId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseReview_accessTokenHash_key" ON "CourseReview"("accessTokenHash");

-- CreateIndex
CREATE INDEX "CourseReviewFeedback_reviewId_status_createdAt_idx" ON "CourseReviewFeedback"("reviewId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "CourseRevision" ADD CONSTRAINT "CourseRevision_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseReview" ADD CONSTRAINT "CourseReview_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "CourseRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseReviewFeedback" ADD CONSTRAINT "CourseReviewFeedback_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "CourseReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
