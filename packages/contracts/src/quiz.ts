import { z } from 'zod';

export const GenerateQuizRequestSchema = z.object({
  courseId: z.string().min(1).max(100),
  weakTopics: z.array(z.string().min(1).max(200)).max(20).optional(),
});

export type GenerateQuizRequest = z.infer<typeof GenerateQuizRequestSchema>;

// The server-only schema retains answer keys; browser responses use ClientQuizSchema.
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

export const ClientQuizQuestionSchema = z.object({
  question: z.string().max(500),
  options: z.array(z.string().max(200)).min(2).max(8),
  image_url: z.string().max(2000).optional(),
});

export type ClientQuizQuestion = z.infer<typeof ClientQuizQuestionSchema>;

export const QuizSourceSchema = z.enum(['ai', 'course']);
export type QuizSource = z.infer<typeof QuizSourceSchema>;

export const ClientQuizSchema = z.object({
  quizId: z.string().min(1).max(100),
  source: QuizSourceSchema,
  title: z.string().max(200),
  instructions: z.string().max(2000).optional(),
  questions: z.array(ClientQuizQuestionSchema).min(1).max(20),
});

export type ClientQuiz = z.infer<typeof ClientQuizSchema>;

const gradeIdentity = {
  source: QuizSourceSchema,
  quizId: z.string().min(1).max(100),
} as const;

export const GradeQuestionRequestSchema = z.object({
  action: z.literal('question'),
  ...gradeIdentity,
  questionIndex: z.number().int().min(0).max(19),
  selectedIndex: z.number().int().min(0).max(7),
});

export const SubmitQuizRequestSchema = z.object({
  action: z.literal('submit'),
  ...gradeIdentity,
  answers: z.array(z.number().int().min(0).max(7)).min(1).max(20),
  sessionId: z.string().uuid().optional(),
  courseId: z.string().min(1).max(100).optional(),
});

export const QuizGradeRequestSchema = z.discriminatedUnion('action', [
  GradeQuestionRequestSchema,
  SubmitQuizRequestSchema,
]);

export type QuizGradeRequest = z.infer<typeof QuizGradeRequestSchema>;

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
