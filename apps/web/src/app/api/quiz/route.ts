import { NextRequest, NextResponse } from 'next/server';
import { RevisionBoundQuizRequestSchema } from '@/shared/contracts/api';
import { isCourseStudioAuthorized } from '@/server/auth/course-studio';
import { jsonError, readJson, unexpectedApiError } from '@/shared/server/http';
import { requestRevisionBoundQuiz } from '@/learning/server/quiz-commands';

export async function POST(req: NextRequest) {
  const parsed = await readJson(req, RevisionBoundQuizRequestSchema, {
    invalidJsonMessage: 'Invalid request payload',
  });
  if (!parsed.success) return parsed.response;
  if ('revisionId' in parsed.data && !(await isCourseStudioAuthorized(req))) {
    return jsonError('Unauthorized', 401);
  }

  try {
    const result = await requestRevisionBoundQuiz(parsed.data);
    return NextResponse.json(result, { status: 202 });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'REVIEW_NOT_FOUND') {
      return jsonError('This review link is invalid or expired', 404);
    }
    if (
      err instanceof Error &&
      (err.message === 'REVISION_NOT_FOUND' || err.message === 'REVISION_COURSE_MISMATCH')
    ) {
      return jsonError('Revision not found for this course', 404);
    }
    return unexpectedApiError('api/quiz', err);
  }
}
