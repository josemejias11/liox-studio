-- CreateTable
CREATE TABLE "GeneratedQuiz" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "payload" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "GeneratedQuiz_createdAt_idx" ON "GeneratedQuiz"("createdAt");
