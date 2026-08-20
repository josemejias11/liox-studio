import {
  COURSE_GENERATION_PROMPT_VERSION,
  type CourseGenerationSummary,
} from '@moto-ai/contracts/course-generation';
import { getCourseGeneration, prisma } from '@moto-ai/database';
import { enqueueCourseGenerationJob } from '@moto-ai/jobs';

function toCourseGenerationSummary(
  generation: Awaited<ReturnType<typeof getCourseGeneration>>,
): CourseGenerationSummary {
  if (!generation) throw new Error('COURSE_GENERATION_NOT_FOUND');
  return {
    id: generation.id,
    jobId: generation.jobId,
    sourceRevisionId: generation.sourceRevisionId,
    brief: generation.brief,
    promptTemplateVersion: generation.promptTemplateVersion,
    requestedSourceIds: generation.requestedSources.map((source) => source.sourceId),
    modelIdentifier: generation.modelIdentifier,
    status: generation.status,
    error: generation.error,
    createdCourseId: generation.createdCourseId,
    createdAt: generation.createdAt.toISOString(),
    updatedAt: generation.updatedAt.toISOString(),
  };
}

export async function requestAuthoringGeneration({
  sourceRevisionId,
  brief,
}: {
  sourceRevisionId: string;
  brief: string;
}) {
  const revision = await prisma.courseRevision.findUnique({
    where: { id: sourceRevisionId },
    select: {
      id: true,
      sources: {
        orderBy: { sourceFileId: 'asc' },
        select: { sourceFileId: true, sha256: true },
      },
    },
  });
  if (!revision) throw new Error('FROZEN_SOURCE_REVISION_NOT_FOUND');
  if (revision.sources.length === 0) throw new Error('FROZEN_SOURCE_REVISION_EMPTY');

  const generationId = `generation.${crypto.randomUUID()}`;
  const job = await enqueueCourseGenerationJob({
    generationId,
    sourceRevisionId: revision.id,
    brief,
    promptTemplateVersion: COURSE_GENERATION_PROMPT_VERSION,
    requestedSources: revision.sources.map((source) => ({
      sourceId: source.sourceFileId,
      sha256: source.sha256,
    })),
  });

  return { generation: toCourseGenerationSummary(await getCourseGeneration(generationId)), job };
}

export async function listAuthoringGenerations() {
  const records = await prisma.courseGeneration.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { id: true },
  });
  const generations = await Promise.all(records.map(({ id }) => getCourseGeneration(id)));
  return generations.map(toCourseGenerationSummary);
}

export async function getAuthoringGeneration(generationId: string) {
  return toCourseGenerationSummary(await getCourseGeneration(generationId));
}
