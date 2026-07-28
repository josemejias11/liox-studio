import { randomUUID } from 'node:crypto';
import { type ClientQuiz, type ServerAiQuiz } from '@moto-ai/contracts/quiz';
import {
  DocumentIndexPayloadSchema,
  QuizGenerationPayloadSchema,
  type JobKind,
} from '@moto-ai/contracts/jobs';
import { prisma } from '@moto-ai/database';
import { generateCourseQuiz, RagServiceError, uploadCourseDocument } from '@moto-ai/parser-client';
import { NonRetryableJobError, type ClaimedJob } from '@moto-ai/jobs';

async function getCourse(courseId: string) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, sourceFiles: true },
  });
  if (!course) throw new NonRetryableJobError('The course no longer exists.');
  return course;
}

async function persistIndexedDocument(courseId: string, filename: string, chunks: number) {
  const course = await getCourse(courseId);
  const current = Array.isArray(course.sourceFiles) ? course.sourceFiles : [];
  const remaining = current.filter(
    (item) =>
      !item ||
      typeof item !== 'object' ||
      Array.isArray(item) ||
      !('filename' in item) ||
      item.filename !== filename,
  );
  await prisma.course.update({
    where: { id: courseId },
    data: {
      sourceFiles: [
        ...remaining,
        {
          id: randomUUID(),
          filename,
          chunks,
          uploadedAt: new Date().toISOString(),
        },
      ],
    },
  });
}

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
  await getCourse(payload.data.courseId);
  const result = await uploadCourseDocument(payload.data.courseId, file);
  await persistIndexedDocument(payload.data.courseId, result.filename, result.chunksStored);
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
