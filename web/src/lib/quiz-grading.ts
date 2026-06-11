import type { QuestionResult, SubmitQuizResponse } from '@/lib/contracts/quiz';

// ── Pure server-side grading ──────────────────────────────────────────────────
// Both quiz sources (Prisma-persisted AI quizzes, Sanity CMS quizzes) are
// normalized into GradableQuestion[] by the /api/quiz/grade route; everything
// below is pure and source-agnostic.

export interface GradableQuestion {
  options: string[];
  correctIndex: number;
  explanation: string;
}

export const DEFAULT_PASSING_SCORE = 80;

export function gradeQuestion(question: GradableQuestion, selectedIndex: number): QuestionResult {
  return {
    correct: selectedIndex === question.correctIndex,
    correctIndex: question.correctIndex,
    explanation: question.explanation,
  };
}

export function gradeSubmission(
  questions: GradableQuestion[],
  answers: number[],
  passingScore: number = DEFAULT_PASSING_SCORE,
): SubmitQuizResponse {
  const results = questions.map((q, i) => gradeQuestion(q, answers[i] ?? -1));
  const score = results.filter((r) => r.correct).length;
  const total = questions.length;
  const pct = total > 0 ? (score / total) * 100 : 0;
  return { score, total, passed: pct >= passingScore, passingScore, results };
}
