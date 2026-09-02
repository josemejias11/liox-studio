import { CourseAssessmentInputSchema } from '@lb-studio/contracts';
import { NextRequest, NextResponse } from 'next/server';
import { isCourseStudioAuthorized } from '@/server/auth/course-studio';
import { jsonError, readJson, unexpectedApiError } from '@/shared/server/http';
import {
  removeAuthoringChapterQuickCheck,
  upsertAuthoringChapterQuickCheck,
} from '@/authoring/server/course-commands';

function assessmentError(error: unknown) {
  if (error instanceof Error && error.message === 'CHAPTER_NOT_FOUND') {
    return jsonError('Chapter not found', 404);
  }
  if (error instanceof Error && error.message === 'COURSE_NOT_FOUND') {
    return jsonError('Course not found', 404);
  }
  return unexpectedApiError('course-studio/quick-check', error);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string; chapterId: string }> },
): Promise<NextResponse> {
  if (!(await isCourseStudioAuthorized(request))) return jsonError('Unauthorized', 401);
  const body = await readJson(request, CourseAssessmentInputSchema);
  if (!body.success) return body.response;
  try {
    const { courseId, chapterId } = await params;
    return NextResponse.json({
      course: await upsertAuthoringChapterQuickCheck(courseId, chapterId, body.data),
    });
  } catch (error) {
    return assessmentError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string; chapterId: string }> },
): Promise<NextResponse> {
  if (!(await isCourseStudioAuthorized(request))) return jsonError('Unauthorized', 401);
  try {
    const { courseId, chapterId } = await params;
    return NextResponse.json({
      course: await removeAuthoringChapterQuickCheck(courseId, chapterId),
    });
  } catch (error) {
    return assessmentError(error);
  }
}
