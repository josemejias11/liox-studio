import { NextRequest, NextResponse } from 'next/server';
import { isCourseStudioAuthorized } from '@/server/auth/course-studio';
import { jsonError, unexpectedApiError } from '@/shared/server/http';
import { getAuthoringGeneration } from '@/authoring/server/generation-commands';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ generationId: string }> },
): Promise<NextResponse> {
  if (!(await isCourseStudioAuthorized(request))) return jsonError('Unauthorized', 401);
  try {
    return NextResponse.json({
      generation: await getAuthoringGeneration((await params).generationId),
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'COURSE_GENERATION_NOT_FOUND') {
      return jsonError('Generation not found', 404);
    }
    return unexpectedApiError('course-studio/generation GET', error);
  }
}
