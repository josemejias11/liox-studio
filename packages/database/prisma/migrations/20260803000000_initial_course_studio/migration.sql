-- CreateEnum
CREATE TYPE "CourseRevisionStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CourseFeedbackStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "CourseSourceIndexStatus" AS ENUM ('PENDING', 'INDEXED', 'FAILED', 'DELETING');

-- CreateEnum
CREATE TYPE "CourseGenerationStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "BackgroundJobKind" AS ENUM ('DOCUMENT_INDEX', 'QUIZ_GENERATE', 'AI_OPERATION');

-- CreateEnum
CREATE TYPE "BackgroundJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "learningObjectives" JSONB,
    "cover" JSONB,
    "specifications" JSONB,
    "disclaimer" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseChapter" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "estimatedDuration" INTEGER,
    "quickCheckId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseChapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseLesson" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "lessonType" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "body" JSONB,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseLesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseLessonTrash" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "chapterTitle" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "lessonType" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "body" JSONB,
    "payload" JSONB NOT NULL,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseLessonTrash_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseQuiz" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT,
    "instructions" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseQuiz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseAsset" (
    "id" TEXT NOT NULL,
    "r2Key" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "contentType" TEXT,
    "byteSize" INTEGER,
    "publicUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseAsset_pkey" PRIMARY KEY ("id")
);

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
CREATE TABLE "CourseSourceBinding" (
    "courseId" TEXT NOT NULL,
    "sourceFileId" TEXT NOT NULL,

    CONSTRAINT "CourseSourceBinding_pkey" PRIMARY KEY ("courseId","sourceFileId")
);

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

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonProgress" (
    "sessionId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL DEFAULT '',
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "viewCount" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonProgress_pkey" PRIMARY KEY ("sessionId","lessonId")
);

-- CreateTable
CREATE TABLE "HotspotVisit" (
    "sessionId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "layerId" TEXT NOT NULL DEFAULT '',
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HotspotVisit_pkey" PRIMARY KEY ("sessionId","lessonId","layerId","label")
);

-- CreateTable
CREATE TABLE "GeneratedQuiz" (
    "id" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeneratedQuiz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizAttempt" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "quizId" TEXT NOT NULL DEFAULT '',
    "courseId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "answers" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizAttempt_pkey" PRIMARY KEY ("id")
);

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
CREATE UNIQUE INDEX "Course_slug_key" ON "Course"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "CourseChapter_quickCheckId_key" ON "CourseChapter"("quickCheckId");

-- CreateIndex
CREATE INDEX "CourseChapter_courseId_idx" ON "CourseChapter"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseChapter_courseId_position_key" ON "CourseChapter"("courseId", "position");

-- CreateIndex
CREATE INDEX "CourseLesson_chapterId_idx" ON "CourseLesson"("chapterId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseLesson_chapterId_position_key" ON "CourseLesson"("chapterId", "position");

-- CreateIndex
CREATE INDEX "CourseLessonTrash_courseId_deletedAt_idx" ON "CourseLessonTrash"("courseId", "deletedAt");

-- CreateIndex
CREATE INDEX "CourseLessonTrash_courseId_lessonId_idx" ON "CourseLessonTrash"("courseId", "lessonId");

-- CreateIndex
CREATE INDEX "CourseQuiz_courseId_idx" ON "CourseQuiz"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseAsset_r2Key_key" ON "CourseAsset"("r2Key");

-- CreateIndex
CREATE UNIQUE INDEX "CourseSourceFile_r2Key_key" ON "CourseSourceFile"("r2Key");

-- CreateIndex
CREATE INDEX "CourseSourceFile_courseId_indexStatus_idx" ON "CourseSourceFile"("courseId", "indexStatus");

-- CreateIndex
CREATE INDEX "CourseSourceFile_courseId_createdAt_idx" ON "CourseSourceFile"("courseId", "createdAt");

-- CreateIndex
CREATE INDEX "CourseSourceBinding_sourceFileId_idx" ON "CourseSourceBinding"("sourceFileId");

-- CreateIndex
CREATE INDEX "CourseRevision_courseId_createdAt_idx" ON "CourseRevision"("courseId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CourseRevision_courseId_version_key" ON "CourseRevision"("courseId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "CourseRevision_courseId_sourceHash_key" ON "CourseRevision"("courseId", "sourceHash");

-- CreateIndex
CREATE UNIQUE INDEX "CourseGeneration_jobId_key" ON "CourseGeneration"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseGeneration_createdCourseId_key" ON "CourseGeneration"("createdCourseId");

-- CreateIndex
CREATE INDEX "CourseGeneration_sourceRevisionId_createdAt_idx" ON "CourseGeneration"("sourceRevisionId", "createdAt");

-- CreateIndex
CREATE INDEX "CourseGeneration_status_createdAt_idx" ON "CourseGeneration"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CourseReview_revisionId_key" ON "CourseReview"("revisionId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseReview_accessTokenHash_key" ON "CourseReview"("accessTokenHash");

-- CreateIndex
CREATE INDEX "CourseReviewFeedback_reviewId_status_createdAt_idx" ON "CourseReviewFeedback"("reviewId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "LessonProgress_courseId_lessonId_idx" ON "LessonProgress"("courseId", "lessonId");

-- CreateIndex
CREATE INDEX "HotspotVisit_label_idx" ON "HotspotVisit"("label");

-- CreateIndex
CREATE INDEX "GeneratedQuiz_createdAt_idx" ON "GeneratedQuiz"("createdAt");

-- CreateIndex
CREATE INDEX "QuizAttempt_sessionId_idx" ON "QuizAttempt"("sessionId");

-- CreateIndex
CREATE INDEX "QuizAttempt_sessionId_passed_idx" ON "QuizAttempt"("sessionId", "passed");

-- CreateIndex
CREATE INDEX "QuizAttempt_createdAt_idx" ON "QuizAttempt"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "QuizAttempt_sessionId_quizId_key" ON "QuizAttempt"("sessionId", "quizId");

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
ALTER TABLE "CourseChapter" ADD CONSTRAINT "CourseChapter_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseChapter" ADD CONSTRAINT "CourseChapter_quickCheckId_fkey" FOREIGN KEY ("quickCheckId") REFERENCES "CourseQuiz"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseLesson" ADD CONSTRAINT "CourseLesson_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "CourseChapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseLessonTrash" ADD CONSTRAINT "CourseLessonTrash_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseQuiz" ADD CONSTRAINT "CourseQuiz_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseSourceFile" ADD CONSTRAINT "CourseSourceFile_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseSourceBinding" ADD CONSTRAINT "CourseSourceBinding_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseSourceBinding" ADD CONSTRAINT "CourseSourceBinding_sourceFileId_fkey" FOREIGN KEY ("sourceFileId") REFERENCES "CourseSourceFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseRevision" ADD CONSTRAINT "CourseRevision_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "CourseReview" ADD CONSTRAINT "CourseReview_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "CourseRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseReviewFeedback" ADD CONSTRAINT "CourseReviewFeedback_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "CourseReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotspotVisit" ADD CONSTRAINT "HotspotVisit_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobArtifact" ADD CONSTRAINT "JobArtifact_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "BackgroundJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
