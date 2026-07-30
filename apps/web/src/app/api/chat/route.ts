import { NextRequest, NextResponse } from 'next/server';
import { ChatRequestSchema } from '@/lib/contracts/api';
import { askCourseQuestion, RagServiceError } from '@moto-ai/parser-client';
import { getReviewByToken, listFrozenRevisionSourceIds } from '@moto-ai/database';
import { z } from 'zod';
import { jsonError, readJson, unexpectedApiError } from '@/lib/server/http';

// Server-to-server proxy in front of the self-hosted parser/RAG service.
// The browser never calls the parser directly — this route delegates authentication,
// validation, and error translation to the deep RAG client interface.

const revisionBoundChatSchema = ChatRequestSchema.extend({
  revisionId: z.string().min(1).max(100).optional(),
  reviewToken: z.string().min(1).max(200).optional(),
}).refine((value) => Number(!!value.revisionId) + Number(!!value.reviewToken) === 1, {
  message: 'Provide exactly one revisionId or reviewToken',
});

async function resolveRevisionSources(input: z.infer<typeof revisionBoundChatSchema>) {
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
  const parsed = await readJson(req, revisionBoundChatSchema, {
    invalidJsonMessage: 'Invalid request payload',
  });
  if (!parsed.success) return parsed.response;

  try {
    const { sourceIds } = await resolveRevisionSources(parsed.data);
    const result = await askCourseQuestion(parsed.data.courseId, sourceIds, parsed.data.query);
    return NextResponse.json(result);
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
    if (err instanceof RagServiceError) {
      return jsonError(err.message, 502);
    }
    return unexpectedApiError('api/chat', err);
  }
}
