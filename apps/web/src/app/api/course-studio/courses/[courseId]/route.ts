import { NextRequest, NextResponse } from 'next/server';
import { isCourseStudioAuthorized } from '@/server/auth/course-studio';
import { courseSettingsPatchSchema } from '@/shared/contracts/course-settings';
import { jsonError, unexpectedApiError } from '@/shared/server/http';
import { updateAuthoringCourse } from '@/authoring/server/course-commands';

function invalidCourseSettings(
  issues: Array<{ path: PropertyKey[]; message: string }>,
): NextResponse {
  return NextResponse.json(
    {
      error: 'Invalid course settings',
      issues: issues.map((issue) => ({
        path: issue.path.map(String).join('.') || 'course',
        message: issue.message,
      })),
    },
    { status: 400 },
  );
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
): Promise<NextResponse> {
  if (!(await isCourseStudioAuthorized(request))) return jsonError('Unauthorized', 401);
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }
  const body = courseSettingsPatchSchema.safeParse(payload);
  if (!body.success) return invalidCourseSettings(body.error.issues);
  try {
    const course = await updateAuthoringCourse((await params).courseId, body.data);
    return NextResponse.json({ course });
  } catch (error) {
    if (error instanceof Error && error.message === 'COURSE_NOT_FOUND') {
      return jsonError('Course not found', 404);
    }
    return unexpectedApiError('course-studio/course', error);
  }
}
