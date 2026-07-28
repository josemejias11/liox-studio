import {
  listCourseTrash,
  permanentlyDeleteCourseTrashItem,
  restoreCourseTrashItem,
  type CourseTrashItem,
} from '@moto-ai/database';
import { NextRequest, NextResponse } from 'next/server';
import { isCourseStudioAuthorized } from '@/lib/course-studio-auth';
import { jsonError, unexpectedApiError } from '@/lib/server/http';

function serializeTrashItem(item: CourseTrashItem) {
  return { ...item, deletedAt: item.deletedAt.toISOString() };
}

function trashError(error: unknown) {
  if (error instanceof Error && error.message === 'TRASH_ITEM_NOT_FOUND') {
    return jsonError('Trash item not found', 404);
  }
  if (error instanceof Error && error.message === 'ORIGINAL_CHAPTER_NOT_FOUND') {
    return jsonError('The original chapter no longer exists', 409);
  }
  if (error instanceof Error && error.message === 'LESSON_ID_CONFLICT') {
    return jsonError('A lesson with this ID already exists', 409);
  }
  return unexpectedApiError('course-studio/trash-item', error);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string; trashId: string }> },
): Promise<NextResponse> {
  if (!(await isCourseStudioAuthorized(request))) return jsonError('Unauthorized', 401);
  try {
    const { courseId, trashId } = await params;
    const { course, restoredLessonId, trash } = await restoreCourseTrashItem(courseId, trashId);
    return NextResponse.json({
      course,
      restoredLessonId,
      trash: trash.map(serializeTrashItem),
    });
  } catch (error) {
    return trashError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string; trashId: string }> },
): Promise<NextResponse> {
  if (!(await isCourseStudioAuthorized(request))) return jsonError('Unauthorized', 401);
  try {
    const { courseId, trashId } = await params;
    const exists = (await listCourseTrash(courseId)).some((item) => item.id === trashId);
    if (!exists) throw new Error('TRASH_ITEM_NOT_FOUND');
    return NextResponse.json({
      trash: (await permanentlyDeleteCourseTrashItem(courseId, trashId)).map(serializeTrashItem),
    });
  } catch (error) {
    return trashError(error);
  }
}
