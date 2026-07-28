import { emptyCourseTrash, listCourseTrash, type CourseTrashItem } from '@moto-ai/database';
import { NextRequest, NextResponse } from 'next/server';
import { isCourseStudioAuthorized } from '@/lib/course-studio-auth';
import { jsonError, unexpectedApiError } from '@/lib/server/http';

function serializeTrashItem(item: CourseTrashItem) {
  return { ...item, deletedAt: item.deletedAt.toISOString() };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
): Promise<NextResponse> {
  if (!(await isCourseStudioAuthorized(request))) return jsonError('Unauthorized', 401);
  try {
    return NextResponse.json({
      trash: (await listCourseTrash((await params).courseId)).map(serializeTrashItem),
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
    await emptyCourseTrash((await params).courseId);
    return NextResponse.json({ trash: [] });
  } catch (error) {
    return unexpectedApiError('course-studio/trash', error);
  }
}
