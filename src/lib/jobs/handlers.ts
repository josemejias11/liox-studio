import { type ClientQuiz, type ServerAiQuiz } from '@/lib/contracts/quiz';
import {
  DocumentIndexPayloadSchema,
  QuizGenerationPayloadSchema,
  type JobKind,
} from '@/lib/jobs/contracts';
import { prisma } from '@/lib/db';
import { generateCourseQuiz, RagServiceError, uploadCourseDocument } from '@/lib/parser-service';
import { NonRetryableJobError, type ClaimedJob } from '@/lib/jobs/queue';

async function persistAndStrip(quiz: ServerAiQuiz): Promise<ClientQuiz> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  await prisma.generatedQuiz
    .deleteMany({ where: { createdAt: { lt: sevenDaysAgo } } })
    .catch((error) => console.error('Failed to cleanup old quizzes', error));

  const record = await prisma.generatedQuiz.create({ data: { payload: JSON.stringify(quiz) } });
  return {
    quizId: record.id,
    source: 'ai',
    title: quiz.title,
    ...(quiz.instructions !== undefined ? { instructions: quiz.instructions } : {}),
    questions: quiz.questions.map((question) => ({
      question: question.question,
      options: question.options,
      ...(question.image_url !== undefined ? { image_url: question.image_url } : {}),
    })),
  };
}

async function indexDocument(job: ClaimedJob): Promise<{ filename: string; chunksStored: number }> {
  const payload = DocumentIndexPayloadSchema.safeParse(job.payload);
  if (!payload.success || !job.artifact) {
    throw new NonRetryableJobError('The queued document is incomplete. Upload it again to retry.');
  }

  const file = new File([new Uint8Array(job.artifact.bytes)], job.artifact.filename, {
    type: job.artifact.contentType ?? 'application/octet-stream',
  });
  const result = await uploadCourseDocument(payload.data.courseId, file);
  return { filename: result.filename, chunksStored: result.chunksStored };
}

async function generateQuiz(job: ClaimedJob): Promise<ClientQuiz> {
  const payload = QuizGenerationPayloadSchema.safeParse(job.payload);
  if (!payload.success) {
    throw new NonRetryableJobError(
      'The queued quiz request is invalid. Generate a new quiz to retry.',
    );
  }

  const result = await generateCourseQuiz(payload.data.courseId, payload.data.weakTopics);
  const quiz: ServerAiQuiz = {
    title: 'Knowledge Check',
    questions: result.questions.map((question) => {
      const correct = question.options[question.correctAnswerIndex];
      return {
        question: question.question,
        options: question.options,
        correct_answer: correct,
        explanation: `The correct answer is “${correct}”.`,
      };
    }),
  };
  return persistAndStrip(quiz);
}

export async function executeJob(job: ClaimedJob): Promise<unknown> {
  const kind: JobKind =
    job.kind === 'DOCUMENT_INDEX'
      ? 'document_index'
      : job.kind === 'QUIZ_GENERATE'
        ? 'quiz_generate'
        : 'ai_operation';

  if (kind === 'document_index') return indexDocument(job);
  if (kind === 'quiz_generate') return generateQuiz(job);
  throw new NonRetryableJobError('This AI operation is not registered with the worker.');
}

export function isRetryableJobError(error: unknown): boolean {
  if (error instanceof NonRetryableJobError) return false;
  if (error instanceof RagServiceError && error.status && error.status < 500) return false;
  return true;
}
