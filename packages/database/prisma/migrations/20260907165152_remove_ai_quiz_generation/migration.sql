-- Drop GeneratedQuiz: it was the server-side store for AI-generated quizzes,
-- but nothing ever wrote a row to it (QUIZ_GENERATE, the job kind that would
-- have populated it, was removed with zero rows in an earlier migration) and
-- the product no longer offers AI quiz generation as a feature. QuizAttempt
-- has no foreign key to this table (quizId is a plain string), so dropping
-- it is safe on its own.
DROP TABLE "GeneratedQuiz";
