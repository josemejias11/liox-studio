import { prisma } from '@lb-studio/database';
import {
  ServerAiQuizSchema,
  type QuestionResult,
  type QuizSource,
  type SubmitQuizResponse,
} from '@lb-studio/contracts/quiz';
import { z } from 'zod';

export interface GradableQuestion {
  options: string[];
  correctIndex: number;
  explanation: string;
}

const DEFAULT_PASSING_SCORE = 80;

export class CourseConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CourseConfigurationError';
  }
}

const courseGradingSchema = z.object({
  questions: z
    .array(
      z.object({
        answers: z
          .array(
            z.object({
              text: z.string().catch(''),
              isCorrect: z.boolean().catch(false),
              feedback: z
                .string()
                .nullish()
                .transform((value) => value ?? undefined),
            }),
          )
          .catch([]),
        explanation: z
          .string()
          .nullish()
          .transform((value) => value ?? undefined),
      }),
    )
    .catch([]),
  passingScore: z
    .number()
    .nullish()
    .transform((value) => value ?? undefined),
});

interface AnswerKey {
  questions: GradableQuestion[];
  passingScore: number;
  courseId: string | null;
}

export async function loadQuizAnswerKey(
  source: QuizSource,
  quizId: string,
): Promise<AnswerKey | null> {
  if (source === 'ai') {
    const record = await prisma.generatedQuiz.findUnique({ where: { id: quizId } });
    if (!record) return null;
    let payload: unknown;
    try {
      payload = JSON.parse(record.payload);
    } catch {
      return null;
    }
    const parsed = ServerAiQuizSchema.safeParse(payload);
    if (!parsed.success) return null;
    return {
      questions: parsed.data.questions.map((question) => ({
        options: question.options,
        correctIndex: question.options.indexOf(question.correct_answer),
        explanation: question.explanation,
      })),
      passingScore: DEFAULT_PASSING_SCORE,
      courseId: null,
    };
  }

  const record = await prisma.courseQuiz.findUnique({
    where: { id: quizId },
    select: { payload: true, courseId: true },
  });
  if (!record) return null;
  const parsed = courseGradingSchema.safeParse(record.payload);
  if (!parsed.success || parsed.data.questions.length === 0) return null;
  return {
    questions: parsed.data.questions.map((question, index) => {
      const correctIndex = question.answers.findIndex((answer) => answer.isCorrect);
      if (correctIndex === -1) {
        throw new CourseConfigurationError(
          `Course quiz misconfigured: Question ${index + 1} has no correct answer marked.`,
        );
      }
      return {
        options: question.answers.map((answer) => answer.text),
        correctIndex,
        explanation: question.explanation ?? question.answers[correctIndex]?.feedback ?? '',
      };
    }),
    passingScore: parsed.data.passingScore ?? DEFAULT_PASSING_SCORE,
    courseId: record.courseId,
  };
}

export async function recordQuizAttempt({
  sessionId,
  courseId,
  quizId,
  result,
  answers,
}: {
  sessionId: string;
  courseId: string;
  quizId: string;
  result: SubmitQuizResponse;
  answers: number[];
}) {
  await prisma.$transaction(async (tx) => {
    await tx.session.upsert({
      where: { id: sessionId },
      update: { updatedAt: new Date() },
      create: { id: sessionId },
    });
    await tx.quizAttempt.upsert({
      where: { sessionId_quizId: { sessionId, quizId } },
      update: {
        score: result.score,
        total: result.total,
        passed: result.passed,
        answers: JSON.stringify(
          answers.map((selectedIndex, questionIndex) => ({
            questionIndex,
            selectedIndex,
            correct: result.results[questionIndex]?.correct ?? false,
          })),
        ),
      },
      create: {
        sessionId,
        quizId,
        courseId,
        score: result.score,
        total: result.total,
        passed: result.passed,
        answers: JSON.stringify(
          answers.map((selectedIndex, questionIndex) => ({
            questionIndex,
            selectedIndex,
            correct: result.results[questionIndex]?.correct ?? false,
          })),
        ),
      },
    });
  });
}

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
