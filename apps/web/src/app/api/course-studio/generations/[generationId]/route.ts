import type { CourseGenerationSummary } from '@moto-ai/contracts/course-generation';
import { getCourseGeneration } from '@moto-ai/database';
import { NextRequest, NextResponse } from 'next/server';
import { isCourseStudioAuthorized } from '@/server/auth/course-studio';
import { jsonError, unexpectedApiError } from '@/shared/server/http';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ generationId: string }> },
): Promise<NextResponse> {
  if (!(await isCourseStudioAuthorized(request))) return jsonError('Unauthorized', 401);
  try {
    const generation = await getCourseGeneration((await params).generationId);
    if (!generation) return jsonError('Generation not found', 404);
    const result: CourseGenerationSummary = {
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
    return NextResponse.json({ generation: result });
  } catch (error) {
    return unexpectedApiError('course-studio/generation GET', error);
  }
}
