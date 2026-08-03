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
    return unexpectedApiError('course-studio/reorder', error);
  }
}
