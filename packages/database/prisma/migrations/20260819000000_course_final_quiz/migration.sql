ALTER TABLE "Course" ADD COLUMN "finalQuizId" TEXT;

CREATE UNIQUE INDEX "Course_finalQuizId_key" ON "Course"("finalQuizId");

ALTER TABLE "Course"
ADD CONSTRAINT "Course_finalQuizId_fkey"
FOREIGN KEY ("finalQuizId") REFERENCES "CourseQuiz"("id") ON DELETE SET NULL ON UPDATE CASCADE;
