import {
  listCourseReviewFeedback,
  resolveCourseReviewFeedback,
} from '@moto-ai/database';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isCourseStudioAuthorized } from '@/lib/course-studio-auth';
import { jsonError, readJson, unexpectedApiError } from '@/lib/server/http';

const schema = z.object({ feedbackId: z.string().min(1) });

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
): Promise<NextResponse> {
  if (!(await isCourseStudioAuthorized(request))) return jsonError('Unauthorized', 401);
  try {
    return NextResponse.json({
      feedback: await listCourseReviewFeedback((await params).courseId),
    });
  } catch (error) {
    return unexpectedApiError('course-studio/feedback', error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
): Promise<NextResponse> {
  if (!(await isCourseStudioAuthorized(request))) return jsonError('Unauthorized', 401);
  const body = await readJson(request, schema);
  if (!body.success) return body.response;
  try {
    await resolveCourseReviewFeedback((await params).courseId, body.data.feedbackId);
    return NextResponse.json({ resolved: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'FEEDBACK_NOT_FOUND') {
      return jsonError('Feedback not found', 404);
    }
    return unexpectedApiError('course-studio/feedback', error);
  }
}
