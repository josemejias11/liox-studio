import { NextRequest, NextResponse } from 'next/server';
import { GenerateQuizRequestSchema } from '@moto-ai/contracts/quiz';
import { getReviewByToken, listFrozenRevisionSourceIds } from '@moto-ai/database';
import { enqueueQuizGenerationJob } from '@moto-ai/jobs';
import { readJson, unexpectedApiError } from '@/lib/server/http';
import { jsonError } from '@/lib/server/http';
import { z } from 'zod';

// Creates a durable AI quiz job. The worker persists the full answer key and
// exposes only the existing client-safe quiz projection through job status.

const revisionBoundQuizSchema = GenerateQuizRequestSchema.extend({
  revisionId: z.string().min(1).max(100).optional(),
  reviewToken: z.string().min(1).max(200).optional(),
}).refine((value) => Number(!!value.revisionId) + Number(!!value.reviewToken) === 1, {
  message: 'Provide exactly one revisionId or reviewToken',
});

async function resolveRevisionSources(input: z.infer<typeof revisionBoundQuizSchema>) {
  if (input.reviewToken) {
    const review = await getReviewByToken(input.reviewToken);
    if (!review) throw new Error('REVIEW_NOT_FOUND');
    if (review.course.id !== input.courseId) throw new Error('REVISION_COURSE_MISMATCH');
    return {
      revisionId: review.revisionId,
      sourceIds: await listFrozenRevisionSourceIds(input.courseId, review.revisionId),
    };
  }
  return {
    revisionId: input.revisionId!,
    sourceIds: await listFrozenRevisionSourceIds(input.courseId, input.revisionId!),
  };
}

export async function POST(req: NextRequest) {
  const parsed = await readJson(req, revisionBoundQuizSchema, {
    invalidJsonMessage: 'Invalid request payload',
  });
  if (!parsed.success) return parsed.response;

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
