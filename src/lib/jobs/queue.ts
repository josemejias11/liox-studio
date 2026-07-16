import { randomUUID } from 'node:crypto';

import {
  BackgroundJobKind,
  BackgroundJobStatus,
  Prisma,
  type BackgroundJob,
} from '@/generated/prisma';
import { prisma } from '@/lib/db';
import {
  type AiOperationPayload,
  type DocumentIndexPayload,
  type JobAcceptedResponse,
  type JobKind,
  type JobStatus,
  type JobStatusResponse,
  type QuizGenerationPayload,
  normalizeWeakTopics,
} from '@/lib/jobs/contracts';

const DEFAULT_MAX_ATTEMPTS = 3;
const LEASE_MS = 10 * 60 * 1000;
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

const databaseKind: Record<JobKind, BackgroundJobKind> = {
  document_index: BackgroundJobKind.DOCUMENT_INDEX,
  quiz_generate: BackgroundJobKind.QUIZ_GENERATE,
  ai_operation: BackgroundJobKind.AI_OPERATION,
};

const publicKind: Record<BackgroundJobKind, JobKind> = {
  DOCUMENT_INDEX: 'document_index',
  QUIZ_GENERATE: 'quiz_generate',
  AI_OPERATION: 'ai_operation',
};

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
): Promise<JobAcceptedResponse> {
  const existing = await prisma.backgroundJob.findUnique({ where: { dedupeKey } });
  if (existing) return accepted(existing);

  try {
    const job = await prisma.backgroundJob.create({
      data: {
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
      const duplicate = await prisma.backgroundJob.findUnique({ where: { dedupeKey } });
      if (duplicate) return accepted(duplicate);
    }
    throw error;
  }
}

export async function enqueueDocumentIndexJob(
  payload: DocumentIndexPayload,
  bytes: Buffer,
): Promise<JobAcceptedResponse> {
  return enqueue('document_index', payload, `document:${payload.courseId}:${payload.filename}`, {
    filename: payload.filename,
    contentType: payload.contentType,
    bytes,
  });
}

export async function enqueueQuizGenerationJob(
  payload: QuizGenerationPayload,
): Promise<JobAcceptedResponse> {
  const weakTopics = normalizeWeakTopics(payload.weakTopics);
  return enqueue(
    'quiz_generate',
    { ...payload, weakTopics },
    `quiz:${payload.courseId}:${JSON.stringify(weakTopics)}`,
  );
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

export async function getJobStatus(id: string): Promise<JobStatusResponse | null> {
  const job = await prisma.backgroundJob.findUnique({ where: { id } });
  if (!job) return null;

  return {
    id: job.id,
    kind: publicKind[job.kind],
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
          ("status" = 'QUEUED'::"BackgroundJobStatus" AND "runAfter" <= ${now})
          OR ("status" = 'RUNNING'::"BackgroundJobStatus" AND "leaseExpiresAt" <= ${now})
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
