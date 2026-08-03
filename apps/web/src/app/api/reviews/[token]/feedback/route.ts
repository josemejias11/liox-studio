import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError, readJson, unexpectedApiError } from '@/shared/server/http';
import { createCourseReviewFeedback } from '@/review/server/review-commands';

const schema = z.object({
  authorName: z.string().trim().min(1).max(100),
  message: z.string().trim().min(1).max(5000),
  lessonId: z.string().min(1).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const body = await readJson(request, schema);
  if (!body.success) return body.response;
  try {
    return NextResponse.json(
      { feedback: await createCourseReviewFeedback((await params).token, body.data) },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'REVIEW_NOT_FOUND') {
      return jsonError('This frozen master review link is invalid or expired', 404);
    }
    return unexpectedApiError('reviews/feedback', error);
  }
}
