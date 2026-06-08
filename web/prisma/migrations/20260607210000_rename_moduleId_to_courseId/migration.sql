-- Rename moduleId to courseId on QuizAttempt (SQLite requires table recreation)
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_QuizAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "answers" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuizAttempt_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_QuizAttempt" ("id", "sessionId", "courseId", "score", "total", "passed", "answers", "createdAt")
SELECT "id", "sessionId", "moduleId", "score", "total", "passed", "answers", "createdAt" FROM "QuizAttempt";
DROP TABLE "QuizAttempt";
ALTER TABLE "new_QuizAttempt" RENAME TO "QuizAttempt";
CREATE INDEX "QuizAttempt_sessionId_idx" ON "QuizAttempt"("sessionId");
CREATE INDEX "QuizAttempt_sessionId_passed_idx" ON "QuizAttempt"("sessionId", "passed");
CREATE INDEX "QuizAttempt_createdAt_idx" ON "QuizAttempt"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
