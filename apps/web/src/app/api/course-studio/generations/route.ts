import {
  COURSE_GENERATION_PROMPT_VERSION,
  CourseGenerationRequestSchema,
  type CourseGenerationSummary,
} from '@moto-ai/contracts/course-generation';
import { getCourseGeneration, prisma } from '@moto-ai/database';
import { enqueueCourseGenerationJob } from '@moto-ai/jobs';
import { NextRequest, NextResponse } from 'next/server';
import { isCourseStudioAuthorized } from '@/lib/course-studio-auth';
import { jsonError, readJson, unexpectedApiError } from '@/lib/server/http';

function summary(
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

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!(await isCourseStudioAuthorized(request))) return jsonError('Unauthorized', 401);
  try {
    const records = await prisma.courseGeneration.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true },
    });
    const generations = await Promise.all(records.map(({ id }) => getCourseGeneration(id)));
    return NextResponse.json({ generations: generations.map(summary) });
  } catch (error) {
    return unexpectedApiError('course-studio/generations GET', error);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!(await isCourseStudioAuthorized(request))) return jsonError('Unauthorized', 401);
  const body = await readJson(request, CourseGenerationRequestSchema);
  if (!body.success) return body.response;
  try {
    const revision = await prisma.courseRevision.findUnique({
      where: { id: body.data.sourceRevisionId },
      select: {
        id: true,
        sources: {
          orderBy: { sourceFileId: 'asc' },
          select: { sourceFileId: true, sha256: true },
        },
      },
    });
    if (!revision) return jsonError('Frozen source revision not found', 404);
    if (revision.sources.length === 0) {
      return jsonError('Choose a frozen revision with at least one indexed source', 409);
    }

    const generationId = `generation.${crypto.randomUUID()}`;
    const job = await enqueueCourseGenerationJob({
      generationId,
      sourceRevisionId: revision.id,
      brief: body.data.brief,
      promptTemplateVersion: COURSE_GENERATION_PROMPT_VERSION,
      requestedSources: revision.sources.map((source) => ({
        sourceId: source.sourceFileId,
        sha256: source.sha256,
      })),
    });
    return NextResponse.json(
      { generation: summary(await getCourseGeneration(generationId)), job },
      { status: 202 },
    );
  } catch (error) {
    return unexpectedApiError('course-studio/generations POST', error);
  }
}
