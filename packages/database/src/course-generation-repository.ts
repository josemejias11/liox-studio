import { Prisma } from '@prisma/client';
import type { GeneratedCourseGraph } from '@moto-ai/contracts/course-generation';
import { prisma } from './index';

type CourseGenerationStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export interface RequestedGenerationSource {
  sourceId: string;
  sha256: string;
}

export interface CreateCourseGenerationInput {
  generationId: string;
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
  if (sourceIds.length !== sourceHashes.length)
    throw new Error('COURSE_GENERATION_PROVENANCE_INVALID');
  return {
    id: generation.id,
    jobId: generation.jobId,
    sourceRevisionId: generation.sourceRevisionId,
    brief: generation.brief,
    promptTemplateVersion: generation.promptTemplateVersion,
    requestedSources: sourceIds.map((sourceId, index) => ({
      sourceId,
      sha256: sourceHashes[index],
    })),
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
    const expectedSources = new Map(
      revisionSources.map((source) => [source.sourceFileId, source.sha256]),
    );
    if (
      expectedSources.size !== requestedSources.length ||
      requestedSources.some((source) => expectedSources.get(source.sourceId) !== source.sha256)
    ) {
      throw new Error('COURSE_GENERATION_SOURCES_NOT_FROZEN');
    }

    const job = await tx.backgroundJob.create({
      data: {
        id: input.generationId,
        kind: 'AI_OPERATION',
        dedupeKey: `course-generation:${input.generationId}`,
        payload: { generationId: input.generationId },
        generation: {
          create: {
            id: input.generationId,
            sourceRevisionId: input.sourceRevisionId,
            brief: input.brief,
            promptTemplateVersion: input.promptTemplateVersion,
            requestedSourceIds: requestedSources.map((source) => source.sourceId),
            requestedSourceHashes: requestedSources.map((source) => source.sha256),
            modelIdentifier: input.modelIdentifier ?? null,
          },
        },
      },
      include: { generation: true },
    });
    if (!job.generation) throw new Error('COURSE_GENERATION_CREATE_FAILED');
    return job.generation;
  });
  return toCourseGenerationRecord(generation);
}

export async function getCourseGeneration(
  generationId: string,
): Promise<CourseGenerationRecord | null> {
  const generation = await prisma.courseGeneration.findUnique({ where: { id: generationId } });
  return generation ? toCourseGenerationRecord(generation) : null;
}

export async function markCourseGenerationRunning(
  generationId: string,
): Promise<CourseGenerationRecord> {
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

function slugPart(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 70) || 'generated-course'
  );
}

function generatedLessonPayload(
  lesson: GeneratedCourseGraph['chapters'][number]['lessons'][number],
) {
  const generationDraft = {
    interactionDrafts: lesson.interactionDrafts,
    assetPlaceholders: lesson.assetPlaceholders,
    quizSuggestions: lesson.quizSuggestions,
    authorApprovalRequired: true,
  };
  if (lesson.lessonType !== 'quiz') return { generationDraft };
  return {
    title: lesson.headline,
    instructions:
      'Review and approve these AI suggestions before using them as an authored assessment.',
    questions: lesson.quizSuggestions.map((suggestion) => ({
      questionText: suggestion.question,
      questionType: 'single',
      answers: suggestion.options.map((text) => ({ text })),
    })),
    generationDraft,
  };
}

export async function persistGeneratedCourse(
  generationId: string,
  input: {
    graph: GeneratedCourseGraph;
    modelIdentifier: string;
    promptTemplateVersion: string;
  },
): Promise<{ createdCourseId: string; result: Prisma.JsonObject }> {
  return prisma.$transaction(async (tx) => {
    const generation = await tx.courseGeneration.findUnique({
      where: { id: generationId },
      include: {
        sourceRevision: {
          select: {
            sources: {
              orderBy: { sourceFileId: 'asc' },
              select: { sourceFileId: true, sha256: true },
            },
          },
        },
      },
    });
    if (!generation) throw new Error('COURSE_GENERATION_NOT_FOUND');
    if (generation.createdCourseId && generation.result) {
      return {
        createdCourseId: generation.createdCourseId,
        result: generation.result as Prisma.JsonObject,
      };
    }
    if (generation.status !== 'RUNNING') throw new Error('COURSE_GENERATION_NOT_RUNNING');
    if (input.promptTemplateVersion !== generation.promptTemplateVersion) {
      throw new Error('COURSE_GENERATION_PROMPT_VERSION_MISMATCH');
    }

    const requestedIds = stringArray(generation.requestedSourceIds);
    const requestedHashes = stringArray(generation.requestedSourceHashes);
    const frozenSources = generation.sourceRevision.sources;
    if (
      requestedIds.length !== frozenSources.length ||
      requestedIds.some(
        (sourceId, index) =>
          sourceId !== frozenSources[index]?.sourceFileId ||
          requestedHashes[index] !== frozenSources[index]?.sha256,
      )
    ) {
      throw new Error('COURSE_GENERATION_SOURCES_NOT_FROZEN');
    }

    const idSuffix = generationId
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(-10)
      .toLowerCase();
    const courseId = `course.${crypto.randomUUID()}`;
    await tx.course.create({
      data: {
        id: courseId,
        slug: `${slugPart(input.graph.title)}-${idSuffix}`,
        title: input.graph.title,
        description: input.graph.description,
        learningObjectives: input.graph.objectives,
        sourceBindings: {
          create: requestedIds.map((sourceFileId) => ({ sourceFileId })),
        },
        chapters: {
          create: input.graph.chapters.map((chapter, chapterPosition) => ({
            id: `chapter.${crypto.randomUUID()}`,
            title: chapter.title,
            position: chapterPosition,
            estimatedDuration: chapter.estimatedDuration,
            lessons: {
              create: chapter.lessons.map((lesson, lessonPosition) => ({
                id: `lesson.${crypto.randomUUID()}`,
                position: lessonPosition,
                lessonType: lesson.lessonType,
                headline: lesson.headline,
                body: lesson.body,
                payload: generatedLessonPayload(lesson),
              })),
            },
          })),
        },
      },
    });

    const result: Prisma.JsonObject = {
      graph: input.graph as unknown as Prisma.JsonObject,
      sourceIds: requestedIds,
      sourceHashes: requestedHashes,
      modelIdentifier: input.modelIdentifier,
      promptTemplateVersion: input.promptTemplateVersion,
      authorApprovalRequired: true,
    };
    await tx.courseGeneration.update({
      where: { id: generationId },
      data: {
        status: 'SUCCEEDED',
        result,
        modelIdentifier: input.modelIdentifier,
        createdCourseId: courseId,
        error: null,
      },
    });
    return { createdCourseId: courseId, result };
  });
}
