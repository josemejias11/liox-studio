import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ChatRequestSchema, type ChatRequest } from '@/lib/contracts/api';
import { askCourseQuestion, RagServiceError } from '@/lib/parser-service';

// Server-to-server proxy in front of the self-hosted parser/RAG service.
// The browser never calls the parser directly — this route delegates authentication,
// validation, and error translation to the deep RAG client interface.

export async function POST(req: NextRequest) {
  let body: ChatRequest;
  try {
    body = ChatRequestSchema.parse(await req.json());
  } catch (err: unknown) {
    const details = err instanceof z.ZodError ? err.issues : undefined;
    return NextResponse.json({ error: 'Invalid request payload', details }, { status: 400 });
  }

  try {
    const result = await askCourseQuestion(body.courseId, body.query);
    return NextResponse.json(result);
  } catch (err: unknown) {
    if (err instanceof RagServiceError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    console.error('[api/chat] unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
