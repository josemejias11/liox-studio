import { NextRequest, NextResponse } from 'next/server';
import { ChatRequestSchema } from '@/shared/contracts/api';
import { isCourseStudioAuthorized } from '@/server/auth/course-studio';
import { jsonError, readJson, unexpectedApiError } from '@/shared/server/http';
import {
  askRevisionBoundCourseQuestion,
  RagServiceError,
} from '@/learning/server/course-ai-commands';

// Server-to-server proxy in front of the self-hosted parser/RAG service.
// The browser never calls the parser directly — this route delegates authentication,
// validation, and error translation to the deep RAG client interface.

export async function POST(req: NextRequest) {
  const parsed = await readJson(req, ChatRequestSchema, {
    invalidJsonMessage: 'Invalid request payload',
  });
  if (!parsed.success) return parsed.response;
  if ('revisionId' in parsed.data && !(await isCourseStudioAuthorized(req))) {
    return jsonError('Unauthorized', 401);
  }

  try {
    const result = await askRevisionBoundCourseQuestion(parsed.data);
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
