import { NextRequest, NextResponse } from 'next/server';
import { ChatRequestSchema } from '@/lib/contracts/api';
import { askCourseQuestion, RagServiceError } from '@/lib/parser-service';
import { jsonError, readJson, unexpectedApiError } from '@/lib/server/http';

// Server-to-server proxy in front of the self-hosted parser/RAG service.
// The browser never calls the parser directly — this route delegates authentication,
// validation, and error translation to the deep RAG client interface.

export async function POST(req: NextRequest) {
  const parsed = await readJson(req, ChatRequestSchema, {
    invalidJsonMessage: 'Invalid request payload',
  });
  if (!parsed.success) return parsed.response;

  try {
    const result = await askCourseQuestion(parsed.data.courseId, parsed.data.query);
    return NextResponse.json(result);
  } catch (err: unknown) {
    if (err instanceof RagServiceError) {
      return jsonError(err.message, 502);
    }
    return unexpectedApiError('api/chat', err);
  }
}
