import { NextRequest, NextResponse } from 'next/server';
import { isCourseStudioAuthorized } from '@/server/auth/course-studio';
import { jsonError, unexpectedApiError } from '@/shared/server/http';
import { createAuthoringReview } from '@/authoring/server/course-commands';
import { CourseNotReadyError } from '@lb-studio/contracts';

// `request.nextUrl.origin` reflects the server's own bind address, not the
// Host the request actually arrived on — it stays "localhost:3000" even
// behind a reverse proxy or tunnel (VS Code port forwarding, etc.), which
// forward the real host/protocol via these headers instead.
function requestOrigin(request: NextRequest): string {
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (!host) return request.nextUrl.origin;
  const protocol =
    request.headers.get('x-forwarded-proto') ?? request.nextUrl.protocol.replace(':', '');
  return `${protocol}://${host}`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ revisionId: string }> },
): Promise<NextResponse> {
  if (!(await isCourseStudioAuthorized(request))) return jsonError('Unauthorized', 401);
  try {
    const review = await createAuthoringReview((await params).revisionId);
    return NextResponse.json({
      reviewId: review.reviewId,
      reviewUrl: `${requestOrigin(request)}/review/${review.token}`,
    });
  } catch (error) {
    if (error instanceof CourseNotReadyError) {
      return NextResponse.json(
        { error: 'Course is not ready for delivery', issues: error.issues },
        { status: 422 },
      );
    }
    if (error instanceof Error && error.message === 'REVISION_NOT_FOUND') {
      return jsonError('Revision not found', 404);
    }
    return unexpectedApiError('course-studio/review-link', error);
  }
}
