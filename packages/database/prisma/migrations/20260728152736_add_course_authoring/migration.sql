-- CreateEnum
CREATE TYPE "CoursePublicationStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CourseReleaseStatus" AS ENUM ('DRAFT', 'READY', 'DELIVERED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "courseMode" TEXT NOT NULL DEFAULT 'standard',
    "status" "CoursePublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "learningObjectives" JSONB,
    "cover" JSONB,
    "specifications" JSONB,
    "disclaimer" JSONB,
    "sourceFiles" JSONB,
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
CREATE TABLE "CourseRelease" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "sourceTitle" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "CourseReleaseStatus" NOT NULL DEFAULT 'DRAFT',
    "snapshot" JSONB NOT NULL,
    "notes" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseRelease_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Course_slug_key" ON "Course"("slug");

-- CreateIndex
CREATE INDEX "Course_status_createdAt_idx" ON "Course"("status", "createdAt");

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
CREATE INDEX "CourseQuiz_courseId_idx" ON "CourseQuiz"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseAsset_r2Key_key" ON "CourseAsset"("r2Key");

-- CreateIndex
CREATE INDEX "CourseRelease_courseId_createdAt_idx" ON "CourseRelease"("courseId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CourseRelease_courseId_version_key" ON "CourseRelease"("courseId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "CourseRelease_courseId_sourceHash_key" ON "CourseRelease"("courseId", "sourceHash");

-- AddForeignKey
ALTER TABLE "CourseChapter" ADD CONSTRAINT "CourseChapter_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseChapter" ADD CONSTRAINT "CourseChapter_quickCheckId_fkey" FOREIGN KEY ("quickCheckId") REFERENCES "CourseQuiz"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseLesson" ADD CONSTRAINT "CourseLesson_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "CourseChapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseQuiz" ADD CONSTRAINT "CourseQuiz_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseRelease" ADD CONSTRAINT "CourseRelease_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
