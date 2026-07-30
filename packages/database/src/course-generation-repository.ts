import { Prisma } from '@prisma/client';
import { prisma } from './index';

export type CourseGenerationStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export interface RequestedGenerationSource {
  sourceId: string;
  sha256: string;
}

export interface CreateCourseGenerationInput {
  jobId: string;
  sourceRevisionId: string;
  brief: string;
  promptTemplateVersion: string;
  requestedSources: RequestedGenerationSource[];
  modelIdentifier?: string;
}

export interface CourseGenerationRecord {
  id: string;
  jobId: string;
  sourceRevisionId: string;
  brief: string;
  promptTemplateVersion: string;
  requestedSources: RequestedGenerationSource[];
  modelIdentifier: string | null;
  status: CourseGenerationStatus;
  result: unknown | null;
  error: string | null;
  createdCourseId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

type GenerationRecord = Omit<CourseGenerationRecord, 'requestedSources' | 'status' | 'result'> & {
  requestedSourceIds: Prisma.JsonValue;
  requestedSourceHashes: Prisma.JsonValue;
  status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  result: Prisma.JsonValue | null;
};

function toGenerationStatus(status: GenerationRecord['status']): CourseGenerationStatus {
  return status.toLowerCase() as CourseGenerationStatus;
}

function stringArray(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error('COURSE_GENERATION_PROVENANCE_INVALID');
  }
  return [...value] as string[];
}

function toCourseGenerationRecord(generation: GenerationRecord): CourseGenerationRecord {
  const sourceIds = stringArray(generation.requestedSourceIds);
  const sourceHashes = stringArray(generation.requestedSourceHashes);
  if (sourceIds.length !== sourceHashes.length) throw new Error('COURSE_GENERATION_PROVENANCE_INVALID');
  return {
    id: generation.id,
    jobId: generation.jobId,
    sourceRevisionId: generation.sourceRevisionId,
    brief: generation.brief,
    promptTemplateVersion: generation.promptTemplateVersion,
    requestedSources: sourceIds.map((sourceId, index) => ({ sourceId, sha256: sourceHashes[index] })),
    modelIdentifier: generation.modelIdentifier,
    status: toGenerationStatus(generation.status),
    result: generation.result,
    error: generation.error,
    createdCourseId: generation.createdCourseId,
    createdAt: generation.createdAt,
    updatedAt: generation.updatedAt,
  };
}

export async function createCourseGeneration(
  input: CreateCourseGenerationInput,
): Promise<CourseGenerationRecord> {
  const requestedSources = [...input.requestedSources].sort((left, right) =>
    left.sourceId.localeCompare(right.sourceId),
  );
  if (
    requestedSources.length === 0 ||
    new Set(requestedSources.map((source) => source.sourceId)).size !== requestedSources.length
  ) {
    throw new Error('COURSE_GENERATION_SOURCES_INVALID');
  }

  const generation = await prisma.$transaction(async (tx) => {
    const revisionSources = await tx.courseRevisionSource.findMany({
      where: {
        revisionId: input.sourceRevisionId,
        sourceFileId: { in: requestedSources.map((source) => source.sourceId) },
      },
      select: { sourceFileId: true, sha256: true },
    });
    const expectedSources = new Map(revisionSources.map((source) => [source.sourceFileId, source.sha256]));
    if (
      expectedSources.size !== requestedSources.length ||
      requestedSources.some((source) => expectedSources.get(source.sourceId) !== source.sha256)
    ) {
      throw new Error('COURSE_GENERATION_SOURCES_NOT_FROZEN');
    }

    return tx.courseGeneration.create({
      data: {
        jobId: input.jobId,
        sourceRevisionId: input.sourceRevisionId,
        brief: input.brief,
        promptTemplateVersion: input.promptTemplateVersion,
        requestedSourceIds: requestedSources.map((source) => source.sourceId),
        requestedSourceHashes: requestedSources.map((source) => source.sha256),
        modelIdentifier: input.modelIdentifier ?? null,
      },
    });
  });
  return toCourseGenerationRecord(generation);
}

export async function getCourseGeneration(generationId: string): Promise<CourseGenerationRecord | null> {
  const generation = await prisma.courseGeneration.findUnique({ where: { id: generationId } });
  return generation ? toCourseGenerationRecord(generation) : null;
}

export async function markCourseGenerationRunning(generationId: string): Promise<CourseGenerationRecord> {
  const generation = await prisma.courseGeneration.update({
    where: { id: generationId },
    data: { status: 'RUNNING', error: null },
  });
  return toCourseGenerationRecord(generation);
}

export async function markCourseGenerationSucceeded(
  generationId: string,
  input: { result: Prisma.InputJsonValue; modelIdentifier: string; createdCourseId: string },
): Promise<CourseGenerationRecord> {
  const generation = await prisma.courseGeneration.update({
    where: { id: generationId },
    data: {
      status: 'SUCCEEDED',
      result: input.result,
      modelIdentifier: input.modelIdentifier,
      createdCourseId: input.createdCourseId,
      error: null,
    },
  });
  return toCourseGenerationRecord(generation);
}

export async function markCourseGenerationFailed(
  generationId: string,
  error: string,
): Promise<CourseGenerationRecord> {
  const generation = await prisma.courseGeneration.update({
    where: { id: generationId },
    data: { status: 'FAILED', error, result: Prisma.DbNull },
  });
  return toCourseGenerationRecord(generation);
}
