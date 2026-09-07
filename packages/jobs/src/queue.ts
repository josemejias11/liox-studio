import { createHash, randomUUID } from 'node:crypto';

import {
  BackgroundJobKind,
  BackgroundJobStatus,
  createCourseGeneration,
  getCourseGeneration,
  Prisma,
  type BackgroundJob,
} from '@lb-studio/database';
import { prisma } from '@lb-studio/database';
import {
  type AiOperationPayload,
  type CourseDuplicateArtifact,
  type CourseDuplicateCurrentPayload,
  type CourseDuplicatePayload,
  CourseDuplicateArtifactSchema,
  CourseDuplicatePayloadSchema,
  type CourseGenerationPayload,
  type DocumentIndexPayload,
  type JobAcceptedResponse,
  type JobKind,
  type JobStatus,
  type JobStatusResponse,
  type AssistantQaGenerationPayload,
} from '@lb-studio/contracts/jobs';

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

/**
 * Signals that side effects may have completed but their durable state could
 * not be reconciled. This retry path preserves a processing attempt so a
 * later claim can safely recover rather than terminally failing uncertain work.
 */
export class RetryableJobStateError extends Error {
  constructor() {
    super('Background state reconciliation is pending.');
    this.name = 'RetryableJobStateError';
  }
}

export async function updateCourseDuplicateReconciliationMarker(input: {
  job: ClaimedJob;
  payload: CourseDuplicateCurrentPayload;
  reconciliationRequired: boolean;
}): Promise<void> {
  const updated = await prisma.backgroundJob.updateMany({
    where: {
      id: input.job.id,
      kind: BackgroundJobKind.COURSE_DUPLICATE,
      status: BackgroundJobStatus.RUNNING,
      leaseToken: input.job.leaseToken,
    },
    data: {
      payload: jsonValue({
        ...input.payload,
        reconciliationRequired: input.reconciliationRequired,
      }),
    },
  });
  if (updated.count !== 1) {
    throw new Error('Could not update duplication reconciliation state.');
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
                  // Prisma's generated input type now requires a Uint8Array backed by a
                  // concrete ArrayBuffer; Buffer's type declares the wider ArrayBufferLike
                  // (which also covers SharedArrayBuffer), so it doesn't structurally match.
                  bytes: new Uint8Array(artifact.bytes),
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

function normalizeCourseDuplicatePayload(
  payload: unknown,
  artifactBytes: Buffer,
): {
  payload: CourseDuplicateCurrentPayload;
  artifact: CourseDuplicateArtifact;
} | null {
  let artifact: CourseDuplicateArtifact;
  try {
    artifact = CourseDuplicateArtifactSchema.parse(JSON.parse(artifactBytes.toString('utf8')));
  } catch {
    return null;
  }

  const current = CourseDuplicatePayloadSchema.safeParse(payload);
  if (!current.success) return null;
  return { payload: current.data, artifact };
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

  const normalizedTitle = input.requestedTitle.trim();
  const current = CourseDuplicatePayloadSchema.safeParse(job.payload);
  if (current.success) {
    const payload = current.data;
    if (
      payload.sourceCourseId !== input.sourceCourseId ||
      payload.destinationCourseId !== `course.duplicate.${input.requestId}` ||
      payload.requestedTitle !== normalizedTitle ||
      payload.requestFingerprint !==
        duplicateRequestFingerprint(input.sourceCourseId, normalizedTitle)
    ) {
      duplicateRequestConflict();
    }
    if (!job.artifact && job.status !== BackgroundJobStatus.SUCCEEDED) {
      duplicateRequestConflict();
    }
    if (!job.artifact) return accepted(job);
  } else if (!job.artifact) {
    duplicateRequestConflict();
  }

  const normalized = normalizeCourseDuplicatePayload(job.payload, Buffer.from(job.artifact.bytes));
  if (!normalized) duplicateRequestConflict();
  const { payload, artifact } = normalized;
  if (
    payload.sourceCourseId !== input.sourceCourseId ||
    payload.destinationCourseId !== `course.duplicate.${input.requestId}` ||
    payload.requestedTitle !== normalizedTitle ||
    payload.requestFingerprint !==
      duplicateRequestFingerprint(input.sourceCourseId, normalizedTitle)
  ) {
    duplicateRequestConflict();
  }
  if (artifact.requestedTitle !== normalizedTitle) duplicateRequestConflict();

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

export class JobDeleteBlockedError extends Error {
  constructor() {
    super('JOB_DELETE_BLOCKED');
    this.name = 'JobDeleteBlockedError';
  }
}

// Scoped to course-duplication requests only: that's the one job kind the
// Studio library surfaces as a dismissible list. Terminal-only, matching the
// same completed-jobs shape cleanupExpiredJobs already deletes on retention.
export async function deleteCourseDuplicateJob(jobId: string): Promise<void> {
  const job = await prisma.backgroundJob.findUnique({
    where: { id: jobId },
    select: { kind: true, status: true },
  });
  if (!job || job.kind !== BackgroundJobKind.COURSE_DUPLICATE) {
    throw new Error('JOB_NOT_FOUND');
  }
  if (job.status !== BackgroundJobStatus.SUCCEEDED && job.status !== BackgroundJobStatus.FAILED) {
    throw new JobDeleteBlockedError();
  }
  await prisma.backgroundJob.delete({ where: { id: jobId } });
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

    return {
      ...job,
      leaseToken,
      artifact: job.artifact ? { ...job.artifact, bytes: Buffer.from(job.artifact.bytes) } : null,
    };
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
  const duplicatePayload =
    job.kind === BackgroundJobKind.COURSE_DUPLICATE
      ? CourseDuplicatePayloadSchema.safeParse(job.payload)
      : null;
  if (duplicatePayload && !duplicatePayload.success) {
    throw new Error('Could not finalize duplication reconciliation state.');
  }
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
        ...(duplicatePayload?.success
          ? {
              payload: jsonValue({
                ...duplicatePayload.data,
                reconciliationRequired: false,
              }),
            }
          : {}),
      },
    });
    if (completed.count === 1) {
      await tx.jobArtifact.deleteMany({ where: { jobId: job.id } });
    } else if (job.kind === BackgroundJobKind.COURSE_DUPLICATE) {
      throw new RetryableJobStateError();
    }
  });
}

export async function retryOrFailJob(
  job: ClaimedJob,
  error: unknown,
  retryable: boolean,
): Promise<void> {
  const stateRetry = error instanceof RetryableJobStateError;
  const duplicateStatePayload =
    stateRetry && job.kind === BackgroundJobKind.COURSE_DUPLICATE
      ? CourseDuplicatePayloadSchema.safeParse(job.payload)
      : null;
  const safeMessage =
    error instanceof NonRetryableJobError ||
    (error instanceof Error && error.name === 'RagServiceError')
      ? error.message
      : 'Background processing failed. Please try again.';
  const shouldRetry = stateRetry || (retryable && job.attempts < job.maxAttempts);
  const retryDelayMs = stateRetry ? 30_000 : 2 ** Math.max(job.attempts - 1, 0) * 5_000;

  await prisma.backgroundJob.updateMany({
    where: { id: job.id, status: BackgroundJobStatus.RUNNING, leaseToken: job.leaseToken },
    data: shouldRetry
      ? {
          status: BackgroundJobStatus.QUEUED,
          progress: stateRetry ? 'reconciling' : 'retrying',
          runAfter: new Date(Date.now() + retryDelayMs),
          leaseToken: null,
          leaseExpiresAt: null,
          ...(stateRetry ? { attempts: { decrement: 1 } } : {}),
          ...(duplicateStatePayload?.success
            ? {
                payload: jsonValue({
                  ...duplicateStatePayload.data,
                  reconciliationRequired: true,
                }),
              }
            : {}),
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
      generation: null,
      scormExport: null,
    },
  });
}
