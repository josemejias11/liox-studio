import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requestAuthoringCourseDuplication } from '@/authoring/server/duplication-commands';
import { isCourseStudioAuthorized } from '@/server/auth/course-studio';
import { jsonError, readJson, unexpectedApiError } from '@/shared/server/http';

const duplicateCourseSchema = z.object({
  requestId: z.string().uuid(),
  title: z.string().trim().min(1).max(120),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
): Promise<NextResponse> {
  if (!(await isCourseStudioAuthorized(request))) return jsonError('Unauthorized', 401);
  const body = await readJson(request, duplicateCourseSchema);
  if (!body.success) return body.response;

  try {
    const job = await requestAuthoringCourseDuplication({
      requestId: body.data.requestId,
      sourceCourseId: (await params).courseId,
      requestedTitle: body.data.title,
    });
    return NextResponse.json(job, { status: 202 });
  } catch (error) {
    if (error instanceof Error && error.message === 'COURSE_NOT_FOUND') {
      return jsonError('Course not found', 404);
    }
    if (
      error instanceof Error &&
      (error.message === 'COURSE_DUPLICATE_GROUNDING_INVALID' || error.name === 'ZodError')
    ) {
      return jsonError('Course source grounding needs attention before duplicating.', 409);
    }
    if (error instanceof Error && error.message === 'COURSE_DUPLICATE_ASSET_INVALID') {
      return jsonError('Fix or replace malformed course media before duplicating.', 409);
    }
    if (error instanceof Error && error.message === 'COURSE_DUPLICATE_REQUEST_CONFLICT') {
      return jsonError('This request was already used. Start a new duplication action.', 409);
    }
    return unexpectedApiError('course-studio/course-duplicate', error);
  }
}
