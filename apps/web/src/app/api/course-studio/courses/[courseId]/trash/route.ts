import { NextRequest, NextResponse } from 'next/server';
import { isCourseStudioAuthorized } from '@/server/auth/course-studio';
import { jsonError, unexpectedApiError } from '@/shared/server/http';
import { emptyAuthoringTrash, listAuthoringTrash } from '@/authoring/server/course-commands';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
): Promise<NextResponse> {
  if (!(await isCourseStudioAuthorized(request))) return jsonError('Unauthorized', 401);
  try {
    return NextResponse.json({
      trash: await listAuthoringTrash((await params).courseId),
    });
  } catch (error) {
    return unexpectedApiError('course-studio/trash', error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
): Promise<NextResponse> {
  if (!(await isCourseStudioAuthorized(request))) return jsonError('Unauthorized', 401);
  try {
    await emptyAuthoringTrash((await params).courseId);
    return NextResponse.json({ trash: [] });
  } catch (error) {
    return unexpectedApiError('course-studio/trash', error);
  }
}
