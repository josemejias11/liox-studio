import { createHash, randomUUID } from 'node:crypto';

import {
  BackgroundJobKind,
  BackgroundJobStatus,
  createCourseGeneration,
  getCourseGeneration,
  Prisma,
  type BackgroundJob,
} from '@moto-ai/database';
import { prisma } from '@moto-ai/database';
import {
  type AiOperationPayload,
  type CourseDuplicateArtifact,
  type CourseDuplicateCurrentPayload,
  type CourseDuplicatePayload,
  CourseDuplicateArtifactSchema,
  CourseDuplicatePayloadSchema,
  isCurrentCourseDuplicatePayload,
  type CourseGenerationPayload,
  type DocumentIndexPayload,
  type JobAcceptedResponse,
  type JobKind,
  type JobStatus,
  type JobStatusResponse,
  type AssistantQaGenerationPayload,
} from '@moto-ai/contracts/jobs';

const DEFAULT_MAX_ATTEMPTS = 3;
const LEASE_MS = 10 * 60 * 1000;
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

const databaseKind: Record<JobKind, BackgroundJobKind> = {
  document_index: BackgroundJobKind.DOCUMENT_INDEX,
  assistant_qa_generate: BackgroundJobKind.AI_OPERATION,
  course_generate: BackgroundJobKind.AI_OPERATION,
  ai_operation: BackgroundJobKind.AI_OPERATION,
  scorm_export: BackgroundJobKind.SCORM_EXPORT,
  course_duplicate: BackgroundJobKind.COURSE_DUPLICATE,
};

const publicKind: Record<BackgroundJobKind, Exclude<JobKind, 'course_generate'>> = {
  DOCUMENT_INDEX: 'document_index',
  QUIZ_GENERATE: 'ai_operation',
  AI_OPERATION: 'ai_operation',
  SCORM_EXPORT: 'scorm_export',
  COURSE_DUPLICATE: 'course_duplicate',
};

function jobKind(job: Pick<BackgroundJob, 'kind' | 'payload'>): JobKind {
  if (
    job.kind === BackgroundJobKind.AI_OPERATION &&
    job.payload &&
    typeof job.payload === 'object' &&
    !Array.isArray(job.payload) &&
    typeof (job.payload as { generationId?: unknown }).generationId === 'string'
  ) {
    return 'course_generate';
  }
  if (
    job.kind === BackgroundJobKind.AI_OPERATION &&
    job.payload &&
    typeof job.payload === 'object' &&
    !Array.isArray(job.payload) &&
    Array.isArray((job.payload as { sourceIds?: unknown }).sourceIds)
  )
    return 'assistant_qa_generate';
  return publicKind[job.kind];
}

const publicStatus: Record<BackgroundJobStatus, JobStatus> = {
  QUEUED: 'queued',
  RUNNING: 'running',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
};

export type ClaimedJob = BackgroundJob & {
  artifact: { filename: string; contentType: string | null; bytes: Buffer } | null;
  leaseToken: string;
};

export class NonRetryableJobError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NonRetryableJobError';
  }
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function accepted(job: BackgroundJob): JobAcceptedResponse {
  return { jobId: job.id, status: 'queued' };
}

async function enqueue(
  kind: JobKind,
  payload: unknown,
  dedupeKey: string,
  artifact?: { filename: string; contentType?: string; bytes: Buffer },
  jobId?: string,
  findExistingJob?: () => Promise<JobAcceptedResponse | null>,
): Promise<JobAcceptedResponse> {
  if (jobId) {
    if (findExistingJob) {
      const existingById = await findExistingJob();
      if (existingById) return existingById;
    } else {
      const existingById = await prisma.backgroundJob.findUnique({ where: { id: jobId } });
      if (existingById) return accepted(existingById);
    }
  }
  const existing = await prisma.backgroundJob.findUnique({ where: { dedupeKey } });
  if (existing) {
    if (findExistingJob) {
      const existingById = await findExistingJob();
      if (existingById) return existingById;
      throw new Error('COURSE_DUPLICATE_REQUEST_CONFLICT');
    }
    return accepted(existing);
  }

  try {
    const job = await prisma.backgroundJob.create({
      data: {
        ...(jobId ? { id: jobId } : {}),
        kind: databaseKind[kind],
        dedupeKey,
        payload: jsonValue(payload),
        maxAttempts: DEFAULT_MAX_ATTEMPTS,
        ...(artifact
          ? {
              artifact: {
                create: {
                  filename: artifact.filename,
                  ...(artifact.contentType ? { contentType: artifact.contentType } : {}),
                  bytes: artifact.bytes,
                },
              },
            }
          : {}),
      },
    });
    return accepted(job);
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      if (jobId) {
        if (findExistingJob) {
          const duplicateById = await findExistingJob();
          if (duplicateById) return duplicateById;
        } else {
          const duplicateById = await prisma.backgroundJob.findUnique({ where: { id: jobId } });
          if (duplicateById) return accepted(duplicateById);
        }
      }
      const duplicate = await prisma.backgroundJob.findUnique({ where: { dedupeKey } });
      if (duplicate) {
        if (findExistingJob) {
          const duplicateById = await findExistingJob();
          if (duplicateById) return duplicateById;
          throw new Error('COURSE_DUPLICATE_REQUEST_CONFLICT');
        }
        return accepted(duplicate);
      }
    }
    throw error;
  }
}

function duplicateRequestConflict(): never {
  throw new Error('COURSE_DUPLICATE_REQUEST_CONFLICT');
}

function duplicateRequestFingerprint(sourceCourseId: string, requestedTitle: string): string {
  return createHash('sha256')
    .update(JSON.stringify([sourceCourseId, requestedTitle.trim()]))
    .digest('hex');
}

export async function findExistingCourseDuplicateJob(input: {
  requestId: string;
  sourceCourseId: string;
  requestedTitle: string;
}): Promise<JobAcceptedResponse | null> {
  const job = await prisma.backgroundJob.findUnique({
    where: { id: input.requestId },
    include: { artifact: true },
  });
  if (!job) return null;
  if (job.kind !== BackgroundJobKind.COURSE_DUPLICATE) duplicateRequestConflict();

  let payload: CourseDuplicatePayload;
  try {
    payload = CourseDuplicatePayloadSchema.parse(job.payload);
  } catch {
    duplicateRequestConflict();
  }

  if (
    payload.sourceCourseId !== input.sourceCourseId ||
    payload.destinationCourseId !== `course.duplicate.${input.requestId}`
  ) {
    duplicateRequestConflict();
  }

  const normalizedTitle = input.requestedTitle.trim();
  if (isCurrentCourseDuplicatePayload(payload)) {
    if (
      payload.requestedTitle !== normalizedTitle ||
      payload.requestFingerprint !==
        duplicateRequestFingerprint(input.sourceCourseId, normalizedTitle)
    ) {
      duplicateRequestConflict();
    }
    if (!job.artifact) {
      if (job.status !== BackgroundJobStatus.SUCCEEDED) duplicateRequestConflict();
      return accepted(job);
    }
  } else if (!job.artifact) {
    duplicateRequestConflict();
  }

  let artifact: CourseDuplicateArtifact;
  try {
    artifact = CourseDuplicateArtifactSchema.parse(JSON.parse(job.artifact.bytes.toString('utf8')));
  } catch {
    duplicateRequestConflict();
  }
  if (artifact.requestedTitle !== normalizedTitle) duplicateRequestConflict();

  if (!isCurrentCourseDuplicatePayload(payload)) {
    const currentPayload: CourseDuplicateCurrentPayload = {
      sourceCourseId: payload.sourceCourseId,
      destinationCourseId: payload.destinationCourseId,
      requestedTitle: artifact.requestedTitle,
      requestFingerprint: duplicateRequestFingerprint(
        payload.sourceCourseId,
        artifact.requestedTitle,
      ),
    };
    await prisma.backgroundJob.update({
      where: { id: job.id },
      data: { payload: jsonValue(currentPayload) },
    });
  }
  return accepted(job);
}

export async function enqueueCourseDuplicateJob(input: {
  requestId: string;
  sourceCourseId: string;
  requestedTitle: string;
  artifact: CourseDuplicateArtifact;
}): Promise<JobAcceptedResponse> {
  const payload: CourseDuplicatePayload = {
    sourceCourseId: input.sourceCourseId,
    destinationCourseId: `course.duplicate.${input.requestId}`,
    requestedTitle: input.requestedTitle.trim(),
    requestFingerprint: duplicateRequestFingerprint(
      input.sourceCourseId,
      input.requestedTitle.trim(),
    ),
  };
  return enqueue(
    'course_duplicate',
    payload,
    `course-duplicate:${input.requestId}`,
    {
      filename: 'course-duplicate.json',
      contentType: 'application/json',
      bytes: Buffer.from(JSON.stringify(input.artifact), 'utf8'),
    },
    input.requestId,
    () =>
      findExistingCourseDuplicateJob({
        requestId: input.requestId,
        sourceCourseId: input.sourceCourseId,
        requestedTitle: input.requestedTitle,
      }),
  );
}

export async function enqueueDocumentIndexJob(
  payload: DocumentIndexPayload,
  bytes: Buffer,
): Promise<JobAcceptedResponse> {
  return enqueue(
    'document_index',
    payload,
    `document:${payload.courseId}:${payload.sourceId}:${payload.sha256}`,
    {
      filename: payload.filename,
      contentType: payload.contentType,
      bytes,
    },
  );
}

export async function enqueueAssistantQaGenerationJob(
  payload: AssistantQaGenerationPayload,
): Promise<JobAcceptedResponse> {
  const sourceIds = [...new Set(payload.sourceIds)].sort((left, right) =>
    left.localeCompare(right),
  );
  return enqueue(
    'assistant_qa_generate',
    { ...payload, sourceIds },
    `assistant-qa:${payload.courseId}:${JSON.stringify(sourceIds)}:${JSON.stringify(payload.sourceHashes)}`,
  );
}

export interface EnqueueCourseGenerationInput extends CourseGenerationPayload {
  sourceRevisionId: string;
  brief: string;
  promptTemplateVersion: string;
  requestedSources: Array<{ sourceId: string; sha256: string }>;
}

export async function enqueueCourseGenerationJob(
  input: EnqueueCourseGenerationInput,
): Promise<JobAcceptedResponse> {
  const existing = await getCourseGeneration(input.generationId);
  if (existing) return { jobId: existing.jobId, status: 'queued' };
  try {
    const generation = await createCourseGeneration(input);
    return { jobId: generation.jobId, status: 'queued' };
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const duplicate = await getCourseGeneration(input.generationId);
      if (duplicate) return { jobId: duplicate.jobId, status: 'queued' };
    }
    throw error;
  }
}

export async function enqueueAiOperationJob(
  payload: AiOperationPayload,
): Promise<JobAcceptedResponse> {
  return enqueue(
    'ai_operation',
    payload,
    `ai:${payload.operation}:${JSON.stringify(payload.input)}`,
  );
}

export async function enqueueScormExportJob(input: {
  revisionId: string;
  content: unknown;
  assistant: unknown;
  masteryScore: number;
}): Promise<JobAcceptedResponse> {
  const bytes = Buffer.from(
    JSON.stringify({
      content: input.content,
      assistant: input.assistant,
      masteryScore: input.masteryScore,
    }),
    'utf8',
  );
  const contentHash = createHash('sha256').update(bytes).digest('hex');
  return enqueue(
    'scorm_export',
    { revisionId: input.revisionId },
    `scorm-export:${input.revisionId}:${contentHash}`,
    {
      filename: 'course-content.json',
      contentType: 'application/json',
      bytes,
    },
  );
}

export async function getJobStatus(id: string): Promise<JobStatusResponse | null> {
  const job = await prisma.backgroundJob.findUnique({ where: { id } });
  if (!job) return null;

  return {
    id: job.id,
    kind: jobKind(job),
    status: publicStatus[job.status],
    progress: job.progress,
    result: job.result,
    errorMessage: job.errorMessage,
    updatedAt: job.updatedAt.toISOString(),
  };
}

export async function claimNextJob(): Promise<ClaimedJob | null> {
  const now = new Date();
  const leaseToken = randomUUID();
  const leaseExpiresAt = new Date(now.getTime() + LEASE_MS);

  return prisma.$transaction(async (tx) => {
    const candidates = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "BackgroundJob"
      WHERE "attempts" < "maxAttempts"
        AND (
          ("status" = 'QUEUED'::"BackgroundJobStatus"
            AND "runAfter" <= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'))
          OR ("status" = 'RUNNING'::"BackgroundJobStatus"
            AND "leaseExpiresAt" <= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'))
        )
      ORDER BY "runAfter" ASC, "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    `);
    const candidate = candidates[0];
    if (!candidate) return null;

    const job = await tx.backgroundJob.update({
      where: { id: candidate.id },
      data: {
        status: BackgroundJobStatus.RUNNING,
        attempts: { increment: 1 },
        leaseToken,
        leaseExpiresAt,
        startedAt: now,
        progress: 'processing',
        errorMessage: null,
      },
      include: { artifact: true },
    });

    return { ...job, leaseToken };
  });
}

export async function refreshLease(job: ClaimedJob, progress?: string): Promise<void> {
  await prisma.backgroundJob.updateMany({
    where: { id: job.id, status: BackgroundJobStatus.RUNNING, leaseToken: job.leaseToken },
    data: {
      leaseExpiresAt: new Date(Date.now() + LEASE_MS),
      ...(progress ? { progress } : {}),
    },
  });
}

export async function completeJob(job: ClaimedJob, result: unknown): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const completed = await tx.backgroundJob.updateMany({
      where: { id: job.id, status: BackgroundJobStatus.RUNNING, leaseToken: job.leaseToken },
      data: {
        status: BackgroundJobStatus.SUCCEEDED,
        dedupeKey: null,
        result: jsonValue(result),
        progress: 'completed',
        completedAt: new Date(),
        leaseToken: null,
        leaseExpiresAt: null,
        errorMessage: null,
      },
    });
    if (completed.count === 1) {
      await tx.jobArtifact.deleteMany({ where: { jobId: job.id } });
    }
  });
}

export async function retryOrFailJob(
  job: ClaimedJob,
  error: unknown,
  retryable: boolean,
): Promise<void> {
  const safeMessage =
    error instanceof NonRetryableJobError ||
    (error instanceof Error && error.name === 'RagServiceError')
      ? error.message
      : 'Background processing failed. Please try again.';
  const shouldRetry = retryable && job.attempts < job.maxAttempts;
  const retryDelayMs = 2 ** Math.max(job.attempts - 1, 0) * 5_000;

  await prisma.backgroundJob.updateMany({
    where: { id: job.id, status: BackgroundJobStatus.RUNNING, leaseToken: job.leaseToken },
    data: shouldRetry
      ? {
          status: BackgroundJobStatus.QUEUED,
          progress: 'retrying',
          runAfter: new Date(Date.now() + retryDelayMs),
          leaseToken: null,
          leaseExpiresAt: null,
          errorMessage: safeMessage,
        }
      : {
          status: BackgroundJobStatus.FAILED,
          dedupeKey: null,
          progress: 'failed',
          completedAt: new Date(),
          leaseToken: null,
          leaseExpiresAt: null,
          errorMessage: safeMessage,
        },
  });
}

export async function cleanupExpiredJobs(): Promise<void> {
  const cutoff = new Date(Date.now() - RETENTION_MS);
  await prisma.backgroundJob.deleteMany({
    where: {
      status: { in: [BackgroundJobStatus.SUCCEEDED, BackgroundJobStatus.FAILED] },
      completedAt: { lt: cutoff },
    },
  });
}
