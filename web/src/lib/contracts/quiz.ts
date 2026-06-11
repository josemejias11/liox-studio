import { z } from 'zod';

// ── Quiz wire contracts ───────────────────────────────────────────────────────
// Grading is server-side: the browser never receives `isCorrect` /
// `correct_answer`. Three surfaces share these schemas:
//   1. /api/quiz        — generates an AI quiz, persists the full payload
//                         (ServerAiQuizSchema) in Prisma, returns ClientQuizSchema.
//   2. /api/quiz/grade  — grades a single question or a full submission against
//                         the server-side source of truth (Prisma for AI quizzes,
//                         Sanity for CMS quizzes) and records the attempt.
//   3. QuizLesson.tsx   — consumes ClientQuizSchema and the grade responses.

// ── Server-side AI quiz (full payload — NEVER sent to the browser) ────────────

export const ServerAiQuizSchema = z.object({
  title: z.string().max(200),
  instructions: z.string().max(2000).optional(),
  questions: z
    .array(
      z.object({
        question: z.string().max(500),
        options: z.array(z.string().max(200)).length(4),
        correct_answer: z.string().max(200),
        explanation: z.string().max(500),
        image_url: z.string().max(2000).optional(),
      }),
    )
    .min(1)
    .max(20),
});

export type ServerAiQuiz = z.infer<typeof ServerAiQuizSchema>;

// ── Client-safe quiz (what the browser renders) ───────────────────────────────

export const ClientQuizQuestionSchema = z.object({
  question: z.string().max(500),
  options: z.array(z.string().max(200)).min(2).max(8),
  image_url: z.string().max(2000).optional(),
});

export type ClientQuizQuestion = z.infer<typeof ClientQuizQuestionSchema>;

export const QuizSourceSchema = z.enum(['ai', 'sanity']);
export type QuizSource = z.infer<typeof QuizSourceSchema>;

export const ClientQuizSchema = z.object({
  /** GeneratedQuiz.id (ai) or the Sanity quiz document _id (sanity). */
  quizId: z.string().min(1).max(100),
  source: QuizSourceSchema,
  title: z.string().max(200),
  instructions: z.string().max(2000).optional(),
  questions: z.array(ClientQuizQuestionSchema).min(1).max(20),
});

export type ClientQuiz = z.infer<typeof ClientQuizSchema>;

// ── Grade requests ────────────────────────────────────────────────────────────

const gradeIdentity = {
  source: QuizSourceSchema,
  quizId: z.string().min(1).max(100),
} as const;

/** Per-question feedback while the learner plays through the quiz. */
export const GradeQuestionRequestSchema = z.object({
  action: z.literal('question'),
  ...gradeIdentity,
  questionIndex: z.number().int().min(0).max(19),
  selectedIndex: z.number().int().min(0).max(7),
});

/**
 * Final submission — the server re-grades every answer, derives `passed` from
 * the server-side passing score, and records the QuizAttempt itself when a
 * sessionId/courseId pair is provided (omitted when consent was declined).
 */
export const SubmitQuizRequestSchema = z.object({
  action: z.literal('submit'),
  ...gradeIdentity,
  /** Selected option index per question, in question order. */
  answers: z.array(z.number().int().min(0).max(7)).min(1).max(20),
  sessionId: z.string().uuid().optional(),
  courseId: z.string().min(1).max(100).optional(),
});

export const QuizGradeRequestSchema = z.discriminatedUnion('action', [
  GradeQuestionRequestSchema,
  SubmitQuizRequestSchema,
]);

export type QuizGradeRequest = z.infer<typeof QuizGradeRequestSchema>;

// ── Grade responses ───────────────────────────────────────────────────────────

export const QuestionResultSchema = z.object({
  correct: z.boolean(),
  correctIndex: z.number().int().min(0),
  explanation: z.string(),
});

export type QuestionResult = z.infer<typeof QuestionResultSchema>;

export const SubmitQuizResponseSchema = z.object({
  score: z.number().int().min(0),
  total: z.number().int().min(1),
  passed: z.boolean(),
  passingScore: z.number().min(0).max(100),
  results: z.array(QuestionResultSchema),
});

export type SubmitQuizResponse = z.infer<typeof SubmitQuizResponseSchema>;
