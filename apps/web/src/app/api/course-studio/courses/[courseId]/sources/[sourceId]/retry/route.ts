import { NextRequest, NextResponse } from 'next/server';
import { isCourseStudioAuthorized } from '@/server/auth/course-studio';
import { jsonError, unexpectedApiError } from '@/shared/server/http';
import {
  retryAuthoringSourceIndex,
  SourceAssetUnavailableError,
} from '@/authoring/server/source-commands';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string; sourceId: string }> },
): Promise<NextResponse> {
  if (!(await isCourseStudioAuthorized(request))) return jsonError('Unauthorized', 401);

  const { courseId, sourceId } = await params;
  try {
    return NextResponse.json(await retryAuthoringSourceIndex(courseId, sourceId), { status: 202 });
  } catch (error) {
    if (error instanceof Error && error.message === 'COURSE_SOURCE_NOT_FOUND') {
      return jsonError('Source not found', 404);
    }
    if (error instanceof Error && error.message === 'COURSE_SOURCE_RETRY_NOT_ALLOWED') {
      return jsonError('Only failed source indexing can be retried', 409);
    }
    if (error instanceof Error && error.message === 'COURSE_SOURCE_REMOVAL_IN_PROGRESS') {
      return jsonError('This source is being removed', 409);
    }
    if (error instanceof SourceAssetUnavailableError) {
      return jsonError(
        error.code === 'SOURCE_ASSET_UNAVAILABLE'
          ? 'The stored source file is unavailable. Upload it again.'
          : 'The stored source file no longer matches its record. Upload it again.',
        409,
      );
    }
    return unexpectedApiError('course-studio/source retry', error);
  }
}
