import { createHash } from 'node:crypto';
import { type ClientQuiz, type ServerAiQuiz } from '@moto-ai/contracts/quiz';
import {
  DocumentIndexPayloadSchema,
  QuizGenerationPayloadSchema,
  type JobKind,
} from '@moto-ai/contracts/jobs';
import { getCourseSource, markSourceFailed, markSourceIndexed, prisma } from '@moto-ai/database';
import { generateCourseQuiz, RagServiceError, uploadCourseDocument } from '@moto-ai/parser-client';
import { NonRetryableJobError, type ClaimedJob } from '@moto-ai/jobs';

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
  if (!payload.success) {
    throw new NonRetryableJobError('The queued document is incomplete. Upload it again to retry.');
  }

  const { courseId, sourceId, sha256, filename, contentType } = payload.data;
  if (!job.artifact) {
    const message = 'The queued source bytes are missing. Upload it again to retry.';
    await markSourceFailed(courseId, sourceId, message);
    throw new NonRetryableJobError(message);
  }

  let source: Awaited<ReturnType<typeof getCourseSource>>;
  try {
    source = await getCourseSource(courseId, sourceId);
  } catch {
    throw new NonRetryableJobError('The source record no longer exists. Upload it again to retry.');
  }

  const artifactSha256 = createHash('sha256').update(job.artifact.bytes).digest('hex');
  if (
    source.sha256 !== sha256 ||
    artifactSha256 !== sha256 ||
    source.filename !== filename ||
    source.contentType !== contentType
  ) {
    const message = 'The queued source does not match its stored record. Upload it again to retry.';
    await markSourceFailed(courseId, sourceId, message);
    throw new NonRetryableJobError(message);
  }

  const file = new File([new Uint8Array(job.artifact.bytes)], job.artifact.filename, {
    type: job.artifact.contentType ?? 'application/octet-stream',
  });
  try {
    const result = await uploadCourseDocument(courseId, sourceId, sha256, file);
    if (result.sourceId !== sourceId || result.filename !== filename) {
      throw new NonRetryableJobError(
        'The indexing service returned a mismatched source. Upload it again to retry.',
      );
    }
    await markSourceIndexed(courseId, sourceId, result.chunksStored);
    return { filename: result.filename, chunksStored: result.chunksStored };
  } catch (error: unknown) {
    if (
      error instanceof NonRetryableJobError ||
      (error instanceof RagServiceError && error.status !== undefined && error.status < 500)
    ) {
      await markSourceFailed(
        courseId,
        sourceId,
        'This source could not be indexed. Check the file contents and format, then upload it again.',
      );
    }
    throw error;
  }
}

async function generateQuiz(job: ClaimedJob): Promise<ClientQuiz> {
  const payload = QuizGenerationPayloadSchema.safeParse(job.payload);
  if (!payload.success) {
    throw new NonRetryableJobError(
      'The queued quiz request is invalid. Generate a new quiz to retry.',
    );
  }

  const result = await generateCourseQuiz(
    payload.data.courseId,
    payload.data.sourceIds,
    payload.data.weakTopics,
  );
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
