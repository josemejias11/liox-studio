import { NextRequest, NextResponse } from 'next/server';
import { isCourseStudioAuthorized } from '@/server/auth/course-studio';
import { jsonError, unexpectedApiError } from '@/shared/server/http';
import { requestScormExport } from '@/authoring/server/course-commands';
import { CourseNotReadyError } from '@moto-ai/contracts';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ revisionId: string }> },
): Promise<NextResponse> {
  if (!(await isCourseStudioAuthorized(request))) return jsonError('Unauthorized', 401);
  try {
    const result = await requestScormExport((await params).revisionId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CourseNotReadyError) {
      return NextResponse.json(
        { error: 'Course is not ready for delivery', issues: error.issues },
        { status: 422 },
      );
    }
    if (error instanceof Error && error.message === 'REVISION_NOT_FOUND') {
      return jsonError('Revision not found', 404);
    }
    if (error instanceof Error && error.message === 'REVISION_CONTENT_INVALID') {
      return jsonError(
        'This revision contains invalid player content and cannot be exported.',
        422,
      );
    }
    return unexpectedApiError('course-studio/scorm-export', error);
  }
}
