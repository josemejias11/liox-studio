import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  GenerateQuizRequestSchema,
  type ClientQuiz,
  type ServerAiQuiz,
} from '@/lib/contracts/quiz';
import { generateCourseQuiz, RagServiceError } from '@/lib/parser-service';
import { jsonError, readJson, unexpectedApiError } from '@/lib/server/http';

// Generates an AI quiz via the self-hosted parser/RAG service (server-to-server),
// persists the full payload — correct answers included — in Prisma, and returns
// only the client-safe projection. The browser never sees the answer key;
// grading happens in /api/quiz/grade against the stored record.

/**
 * Persist the full quiz (answer key included) server-side and return only the
 * client-safe projection — the browser never sees `correct_answer` /
 * `explanation`.
 */
async function persistAndStrip(quiz: ServerAiQuiz): Promise<ClientQuiz> {
  // Cleanup generated quizzes older than 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  await prisma.generatedQuiz
    .deleteMany({ where: { createdAt: { lt: sevenDaysAgo } } })
    .catch((err) => console.error('Failed to cleanup old quizzes', err));

  const record = await prisma.generatedQuiz.create({
    data: { payload: JSON.stringify(quiz) },
  });
  return {
    quizId: record.id,
    source: 'ai',
    title: quiz.title,
    ...(quiz.instructions !== undefined ? { instructions: quiz.instructions } : {}),
    questions: quiz.questions.map((q) => ({
      question: q.question,
      options: q.options,
      ...(q.image_url !== undefined ? { image_url: q.image_url } : {}),
    })),
  };
}

export async function POST(req: NextRequest) {
  const parsed = await readJson(req, GenerateQuizRequestSchema, {
    invalidJsonMessage: 'Invalid request payload',
  });
  if (!parsed.success) return parsed.response;

  let result;
  try {
    result = await generateCourseQuiz(parsed.data.courseId, parsed.data.weakTopics ?? []);
  } catch (err: unknown) {
    if (err instanceof RagServiceError) {
      return jsonError(err.message, 502);
    }
    return unexpectedApiError('api/quiz', err);
  }

  // Map the parser wire shape onto the persisted ServerAiQuiz shape. The parser
  // contract has no title/explanation fields, so we synthesize neutral ones.
  const quiz: ServerAiQuiz = {
    title: 'Knowledge Check',
    questions: result.questions.map((q) => {
      const correct = q.options[q.correctAnswerIndex];
      return {
        question: q.question,
        options: q.options,
        correct_answer: correct,
        explanation: `The correct answer is “${correct}”.`,
      };
    }),
  };

  try {
    return NextResponse.json(await persistAndStrip(quiz));
  } catch (err: unknown) {
    console.error('[api/quiz] failed to persist quiz:', err);
    return jsonError('Internal server error', 500);
  }
}
