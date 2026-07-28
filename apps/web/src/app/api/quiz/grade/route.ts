import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@moto-ai/database';
import { QuizGradeRequestSchema, ServerAiQuizSchema, type QuizSource } from '@moto-ai/contracts/quiz';
import {
  DEFAULT_PASSING_SCORE,
  gradeQuestion,
  gradeSubmission,
  type GradableQuestion,
} from '@/lib/quiz-grading';
import { jsonError, readJson, unexpectedApiError } from '@/lib/server/http';

class CourseConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CourseConfigurationError';
  }
}

// ── Server-side answer key — never serialized to the browser ─────────────────

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
                .transform((v) => v ?? undefined),
            }),
          )
          .catch([]),
        explanation: z
          .string()
          .nullish()
          .transform((v) => v ?? undefined),
      }),
    )
    .catch([]),
  passingScore: z
    .number()
    .nullish()
    .transform((v) => v ?? undefined),
});

interface AnswerKey {
  questions: GradableQuestion[];
  passingScore: number;
}

async function loadAnswerKey(source: QuizSource, quizId: string): Promise<AnswerKey | null> {
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
      questions: parsed.data.questions.map((q) => ({
        options: q.options,
        correctIndex: q.options.indexOf(q.correct_answer),
        explanation: q.explanation,
      })),
      passingScore: DEFAULT_PASSING_SCORE,
    };
  }

  const record = await prisma.courseQuiz.findUnique({
    where: { id: quizId },
    select: { payload: true },
  });
  if (!record) return null;
  const parsed = courseGradingSchema.safeParse(record.payload);
  if (!parsed.success || parsed.data.questions.length === 0) return null;

  return {
    questions: parsed.data.questions.map((q, index) => {
      const correctIndex = q.answers.findIndex((a) => a.isCorrect);
      if (correctIndex === -1) {
        throw new CourseConfigurationError(
          `Course quiz misconfigured: Question ${index + 1} has no correct answer marked.`,
        );
      }
      return {
        options: q.answers.map((a) => a.text),
        correctIndex,
        explanation: q.explanation ?? q.answers[correctIndex]?.feedback ?? '',
      };
    }),
    passingScore: parsed.data.passingScore ?? DEFAULT_PASSING_SCORE,
  };
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const parsed = await readJson(req, QuizGradeRequestSchema);
  if (!parsed.success) return parsed.response;
  const body = parsed.data;

  try {
    const key = await loadAnswerKey(body.source, body.quizId);
    if (!key) {
      return jsonError('Quiz not found', 404);
    }

    if (body.action === 'question') {
      const question = key.questions[body.questionIndex];
      if (!question || body.selectedIndex >= question.options.length) {
        return jsonError('Question or answer out of range', 400);
      }
      return NextResponse.json(gradeQuestion(question, body.selectedIndex));
    }

    // action === "submit"
    if (body.answers.length !== key.questions.length) {
      return jsonError('Answer count does not match question count', 400);
    }

    const result = gradeSubmission(key.questions, body.answers, key.passingScore);

    // Record the attempt server-side — `passed` is server-derived, never
    // client-supplied. sessionId/courseId are absent in preview mode; in that
    // case nothing is persisted.
    if (body.sessionId && body.courseId) {
      const { sessionId, courseId } = body;
      await prisma.$transaction(async (tx) => {
        await tx.session.upsert({
          where: { id: sessionId },
          update: { updatedAt: new Date() },
          create: { id: sessionId },
        });
        await tx.quizAttempt.upsert({
          where: { sessionId_quizId: { sessionId, quizId: body.quizId } },
          update: {
            score: result.score,
            total: result.total,
            passed: result.passed,
            answers: JSON.stringify(
              body.answers.map((selectedIndex, questionIndex) => ({
                questionIndex,
                selectedIndex,
                correct: result.results[questionIndex]?.correct ?? false,
              })),
            ),
          },
          create: {
            sessionId,
            quizId: body.quizId,
            courseId,
            score: result.score,
            total: result.total,
            passed: result.passed,
            answers: JSON.stringify(
              body.answers.map((selectedIndex, questionIndex) => ({
                questionIndex,
                selectedIndex,
                correct: result.results[questionIndex]?.correct ?? false,
              })),
            ),
          },
        });
      });
    }

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof CourseConfigurationError) {
      return jsonError(err.message, 422);
    }
    return unexpectedApiError('api/quiz/grade', err);
  }
}
