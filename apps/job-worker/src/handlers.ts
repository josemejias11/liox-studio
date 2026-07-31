import { createHash } from 'node:crypto';
import { type ClientQuiz, type ServerAiQuiz } from '@moto-ai/contracts/quiz';
import { GeneratedCourseGraphSchema } from '@moto-ai/contracts/course-generation';
import {
  CourseGenerationPayloadSchema,
  DocumentIndexPayloadSchema,
  QuizGenerationPayloadSchema,
  type JobKind,
} from '@moto-ai/contracts/jobs';
import {
  getCourseGeneration,
  getCourseSource,
  markCourseGenerationFailed,
  markCourseGenerationRunning,
  markSourceFailed,
  markSourceIndexed,
  persistGeneratedCourse,
  prisma,
} from '@moto-ai/database';
import {
  generateCourseDraft,
  generateCourseQuiz,
  RagServiceError,
  uploadCourseDocument,
} from '@moto-ai/parser-client';
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
    const retryable = isRetryableJobError(error);
    if (!retryable || job.attempts >= job.maxAttempts) {
      await markSourceFailed(
        courseId,
        sourceId,
        retryable
          ? 'This source could not be indexed after multiple attempts. Upload it again to retry.'
          : 'This source could not be indexed. Check the file contents and format, then upload it again.',
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

async function generateCourse(job: ClaimedJob): Promise<unknown> {
  const payload = CourseGenerationPayloadSchema.safeParse(job.payload);
  if (!payload.success) {
    throw new NonRetryableJobError(
      'The queued course request is invalid. Create a fresh generation request to retry.',
    );
  }
  const generation = await getCourseGeneration(payload.data.generationId);
  if (!generation) {
    throw new NonRetryableJobError(
      'The course generation request no longer exists. Create a fresh request to retry.',
    );
  }
  if (generation.status === 'succeeded' && generation.result) return generation.result;

  const sourceRevision = await prisma.courseRevision.findUnique({
    where: { id: generation.sourceRevisionId },
    select: { courseId: true },
  });
  if (!sourceRevision) {
    throw new NonRetryableJobError(
      'The frozen source revision no longer exists. Create a fresh request to retry.',
    );
  }
  await markCourseGenerationRunning(generation.id);
  try {
    const response = await generateCourseDraft(
      sourceRevision.courseId,
      generation.requestedSources.map((source) => source.sourceId),
      generation.brief,
      generation.promptTemplateVersion,
    );
    const graph = GeneratedCourseGraphSchema.safeParse(response.graph);
    if (!graph.success || response.promptTemplateVersion !== generation.promptTemplateVersion) {
      throw new NonRetryableJobError(
        'The generated course was incomplete. Create a fresh request to retry.',
      );
    }
    return persistGeneratedCourse(generation.id, {
      graph: graph.data,
      modelIdentifier: response.modelIdentifier,
      promptTemplateVersion: response.promptTemplateVersion,
    });
  } catch (error: unknown) {
    if (!isRetryableJobError(error) || job.attempts >= job.maxAttempts) {
      await markCourseGenerationFailed(
        generation.id,
        'Course generation failed. Create a fresh request when you are ready to retry.',
      );
    }
    throw error;
  }
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
  if (CourseGenerationPayloadSchema.safeParse(job.payload).success) return generateCourse(job);
  throw new NonRetryableJobError('This AI operation is not registered with the worker.');
}

export function isRetryableJobError(error: unknown): boolean {
  if (error instanceof NonRetryableJobError) return false;
  if (error instanceof RagServiceError && error.status && error.status < 500) return false;
  return true;
}
