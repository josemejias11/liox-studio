-- AlterTable
ALTER TABLE "LessonProgress" ADD COLUMN     "courseId" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "viewCount" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "LessonProgress_courseId_lessonId_idx" ON "LessonProgress"("courseId", "lessonId");
