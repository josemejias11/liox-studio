import { createCourseReview } from '@moto-ai/database';
import { NextRequest, NextResponse } from 'next/server';
import { isCourseStudioAuthorized } from '@/server/auth/course-studio';
import { jsonError, unexpectedApiError } from '@/shared/server/http';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ revisionId: string }> },
): Promise<NextResponse> {
  if (!(await isCourseStudioAuthorized(request))) return jsonError('Unauthorized', 401);
  try {
    const review = await createCourseReview((await params).revisionId);
    return NextResponse.json({
      reviewId: review.reviewId,
      reviewUrl: `${request.nextUrl.origin}/review/${review.token}`,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'REVISION_NOT_FOUND') {
      return jsonError('Revision not found', 404);
    }
    return unexpectedApiError('course-studio/review-link', error);
  }
}
