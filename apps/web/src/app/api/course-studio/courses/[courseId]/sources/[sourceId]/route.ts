import { beginCourseSourceRemoval, completeCourseSourceRemoval } from '@moto-ai/database';
import { deleteCourseDocument, RagServiceError } from '@moto-ai/parser-client';
import { NextRequest, NextResponse } from 'next/server';
import { isCourseStudioAuthorized } from '@/server/auth/course-studio';
import { deleteCourseAsset } from '@/server/storage/course-assets';
import { jsonError, unexpectedApiError } from '@/shared/server/http';

export const runtime = 'nodejs';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string; sourceId: string }> },
): Promise<NextResponse> {
  if (!(await isCourseStudioAuthorized(request))) return jsonError('Unauthorized', 401);

  const { courseId, sourceId } = await params;
  try {
    const source = await beginCourseSourceRemoval(courseId, sourceId);
    const cleanup = await Promise.allSettled([
      deleteCourseAsset(source.r2Key),
      deleteCourseDocument(courseId, sourceId),
    ]);
    const rejected = cleanup.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    if (rejected.length > 0) {
      for (const result of rejected) {
        console.error('[course-studio/sources] source cleanup failed:', result.reason);
      }
      return jsonError('Stored source cleanup is incomplete. Retry removal to finish it.', 502);
    }
    return NextResponse.json({ source: await completeCourseSourceRemoval(courseId, sourceId) });
  } catch (error) {
    if (error instanceof Error && error.message === 'COURSE_SOURCE_NOT_FOUND') {
      return jsonError('Source not found', 404);
    }
    if (error instanceof Error && error.message === 'COURSE_SOURCE_FROZEN') {
      return jsonError('Sources attached to a frozen revision cannot be deleted', 409);
    }
    if (error instanceof RagServiceError) return jsonError(error.message, 502);
    return unexpectedApiError('course-studio/source', error);
  }
}
