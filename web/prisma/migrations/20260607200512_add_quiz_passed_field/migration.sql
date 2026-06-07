/*
  Warnings:

  - The primary key for the `LessonProgress` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `LessonProgress` table. All the data in the column will be lost.
  - You are about to drop the column `visitedHotspots` on the `LessonProgress` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LayerProgress" (
    "sessionId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "layerId" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("sessionId", "lessonId", "layerId"),
    CONSTRAINT "LayerProgress_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HotspotVisit" (
    "sessionId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "layerId" TEXT NOT NULL DEFAULT '',
    "label" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("sessionId", "lessonId", "layerId", "label"),
    CONSTRAINT "HotspotVisit_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_LessonProgress" (
    "sessionId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("sessionId", "lessonId"),
    CONSTRAINT "LessonProgress_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_LessonProgress" ("completed", "lessonId", "sessionId", "updatedAt") SELECT "completed", "lessonId", "sessionId", "updatedAt" FROM "LessonProgress";
DROP TABLE "LessonProgress";
ALTER TABLE "new_LessonProgress" RENAME TO "LessonProgress";
CREATE TABLE "new_QuizAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "answers" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuizAttempt_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_QuizAttempt" ("answers", "createdAt", "id", "moduleId", "score", "sessionId", "total") SELECT "answers", "createdAt", "id", "moduleId", "score", "sessionId", "total" FROM "QuizAttempt";
DROP TABLE "QuizAttempt";
ALTER TABLE "new_QuizAttempt" RENAME TO "QuizAttempt";
CREATE INDEX "QuizAttempt_sessionId_idx" ON "QuizAttempt"("sessionId");
CREATE INDEX "QuizAttempt_sessionId_passed_idx" ON "QuizAttempt"("sessionId", "passed");
CREATE INDEX "QuizAttempt_createdAt_idx" ON "QuizAttempt"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "HotspotVisit_label_idx" ON "HotspotVisit"("label");
