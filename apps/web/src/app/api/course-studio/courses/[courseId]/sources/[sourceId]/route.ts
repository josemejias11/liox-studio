import { NextRequest, NextResponse } from 'next/server';
import { isCourseStudioAuthorized } from '@/server/auth/course-studio';
import { jsonError, unexpectedApiError } from '@/shared/server/http';
import {
  RagServiceError,
  removeAuthoringSource,
  SourceCleanupIncompleteError,
} from '@/authoring/server/source-commands';

export const runtime = 'nodejs';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string; sourceId: string }> },
): Promise<NextResponse> {
  if (!(await isCourseStudioAuthorized(request))) return jsonError('Unauthorized', 401);

  const { courseId, sourceId } = await params;
  try {
    return NextResponse.json({ source: await removeAuthoringSource(courseId, sourceId) });
  } catch (error) {
    if (error instanceof Error && error.message === 'COURSE_SOURCE_NOT_FOUND') {
      return jsonError('Source not found', 404);
    }
    if (error instanceof Error && error.message === 'COURSE_SOURCE_FROZEN') {
      return jsonError('Sources attached to a frozen revision cannot be deleted', 409);
    }
    if (error instanceof SourceCleanupIncompleteError) {
      return jsonError('Stored source cleanup is incomplete. Retry removal to finish it.', 502);
    }
    if (error instanceof RagServiceError) return jsonError(error.message, 502);
    return unexpectedApiError('course-studio/source', error);
  }
}
