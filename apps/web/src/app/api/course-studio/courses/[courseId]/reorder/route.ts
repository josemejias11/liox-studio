import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isCourseStudioAuthorized } from '@/server/auth/course-studio';
import { jsonError, readJson, unexpectedApiError } from '@/shared/server/http';
import { reorderAuthoringCourseItem } from '@/authoring/server/course-commands';

const schema = z.object({
  kind: z.enum(['chapter', 'lesson']),
  id: z.string().min(1),
  direction: z.enum(['up', 'down']),
});

function reorderError(error: unknown) {
  if (error instanceof Error && error.message === 'LESSON_NOT_FOUND') {
    return jsonError('Lesson not found', 404);
  }
  return unexpectedApiError('course-studio/reorder', error);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
): Promise<NextResponse> {
  if (!(await isCourseStudioAuthorized(request))) return jsonError('Unauthorized', 401);
  const body = await readJson(request, schema);
  if (!body.success) return body.response;
  try {
    return NextResponse.json({
      course: await reorderAuthoringCourseItem((await params).courseId, body.data),
    });
  } catch (error) {
    return reorderError(error);
  }
}
