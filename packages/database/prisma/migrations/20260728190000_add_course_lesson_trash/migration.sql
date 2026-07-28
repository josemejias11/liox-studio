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

-- CreateIndex
CREATE INDEX "CourseLessonTrash_courseId_deletedAt_idx" ON "CourseLessonTrash"("courseId", "deletedAt");

-- CreateIndex
CREATE INDEX "CourseLessonTrash_courseId_lessonId_idx" ON "CourseLessonTrash"("courseId", "lessonId");

-- AddForeignKey
ALTER TABLE "CourseLessonTrash" ADD CONSTRAINT "CourseLessonTrash_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
