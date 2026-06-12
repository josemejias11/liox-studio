import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ChatRequestSchema, type ChatRequest } from '@/lib/contracts/chat';
import { parserPost, ParserChatResponseSchema, ParserServiceError } from '@/lib/parser-service';

// Server-to-server proxy in front of the self-hosted parser/RAG service.
// The browser never calls the parser directly — this route attaches the
// internal token and returns the validated { answer, sources } payload.

const USER_SAFE_UNAVAILABLE =
  'The AI assistant is temporarily unavailable. Please try again in a moment.';

export async function POST(req: NextRequest) {
  let body: ChatRequest;
  try {
    body = ChatRequestSchema.parse(await req.json());
  } catch (err: unknown) {
    const details = err instanceof z.ZodError ? err.issues : undefined;
    return NextResponse.json({ error: 'Invalid request payload', details }, { status: 400 });
  }

  try {
    const raw = await parserPost('/api/chat', {
      json: { course_id: body.courseId, query: body.query },
      timeoutMs: 60_000,
    });
    const parsed = ParserChatResponseSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: USER_SAFE_UNAVAILABLE }, { status: 502 });
    }
    return NextResponse.json(parsed.data);
  } catch (err: unknown) {
    if (err instanceof ParserServiceError) {
      console.error('[api/chat] parser service error:', err.message);
      return NextResponse.json({ error: USER_SAFE_UNAVAILABLE }, { status: 502 });
    }
    console.error('[api/chat] unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
