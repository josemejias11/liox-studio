import { CourseAssessmentInputSchema } from '@lb-studio/contracts';
import { NextRequest, NextResponse } from 'next/server';
import { isCourseStudioAuthorized } from '@/server/auth/course-studio';
import { jsonError, readJson, unexpectedApiError } from '@/shared/server/http';
import {
  removeAuthoringFinalAssessment,
  upsertAuthoringFinalAssessment,
} from '@/authoring/server/course-commands';

function assessmentError(error: unknown) {
  if (error instanceof Error && error.message === 'COURSE_NOT_FOUND') {
    return jsonError('Course not found', 404);
  }
  return unexpectedApiError('course-studio/final-assessment', error);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
): Promise<NextResponse> {
  if (!(await isCourseStudioAuthorized(request))) return jsonError('Unauthorized', 401);
  const body = await readJson(request, CourseAssessmentInputSchema);
  if (!body.success) return body.response;
  try {
    return NextResponse.json({
      course: await upsertAuthoringFinalAssessment((await params).courseId, body.data),
    });
  } catch (error) {
    return assessmentError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
): Promise<NextResponse> {
  if (!(await isCourseStudioAuthorized(request))) return jsonError('Unauthorized', 401);
  try {
    return NextResponse.json({
      course: await removeAuthoringFinalAssessment((await params).courseId),
    });
  } catch (error) {
    return assessmentError(error);
  }
}
