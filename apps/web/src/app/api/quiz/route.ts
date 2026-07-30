import { NextRequest, NextResponse } from 'next/server';
import { getReviewByToken, listFrozenRevisionSourceIds } from '@moto-ai/database';
import { enqueueQuizGenerationJob } from '@moto-ai/jobs';
import { RevisionBoundQuizRequestSchema, type RevisionBoundQuizRequest } from '@/lib/contracts/api';
import { isCourseStudioAuthorized } from '@/lib/course-studio-auth';
import { jsonError, readJson, unexpectedApiError } from '@/lib/server/http';

// Creates a durable AI quiz job. The worker persists the full answer key and
// exposes only the existing client-safe quiz projection through job status.

async function resolveRevisionSources(input: RevisionBoundQuizRequest) {
  if (typeof input.reviewToken === 'string') {
    const review = await getReviewByToken(input.reviewToken);
    if (!review) throw new Error('REVIEW_NOT_FOUND');
    if (review.course.id !== input.courseId) throw new Error('REVISION_COURSE_MISMATCH');
    return {
      revisionId: review.revisionId,
      sourceIds: await listFrozenRevisionSourceIds(input.courseId, review.revisionId),
    };
  }
  return {
    revisionId: input.revisionId,
    sourceIds: await listFrozenRevisionSourceIds(input.courseId, input.revisionId),
  };
}

export async function POST(req: NextRequest) {
  const parsed = await readJson(req, RevisionBoundQuizRequestSchema, {
    invalidJsonMessage: 'Invalid request payload',
  });
  if (!parsed.success) return parsed.response;
  if ('revisionId' in parsed.data && !(await isCourseStudioAuthorized(req))) {
    return jsonError('Unauthorized', 401);
  }

  try {
    const { revisionId, sourceIds } = await resolveRevisionSources(parsed.data);
    const result = await enqueueQuizGenerationJob({
      courseId: parsed.data.courseId,
      revisionId,
      sourceIds,
      weakTopics: parsed.data.weakTopics ?? [],
    });
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
