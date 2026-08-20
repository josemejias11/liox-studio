import { NextRequest, NextResponse } from 'next/server';
import { isCourseStudioAuthorized } from '@/server/auth/course-studio';
import { jsonError, unexpectedApiError } from '@/shared/server/http';
import {
  permanentlyDeleteAuthoringTrashItem,
  restoreAuthoringTrashItem,
} from '@/authoring/server/course-commands';

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
    return NextResponse.json(await restoreAuthoringTrashItem(courseId, trashId));
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
    return NextResponse.json({
      trash: await permanentlyDeleteAuthoringTrashItem(courseId, trashId),
    });
  } catch (error) {
    return trashError(error);
  }
}
