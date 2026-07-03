import { ChatResponseSchema, type ChatResponse } from '@/lib/contracts/api';

export interface ChatInput {
  courseId: string;
  query: string;
}

/**
 * Send a chat request to `/api/chat` and return the validated response.
 * Throws on network or validation errors.
 */
export async function askCourseChat(
  input: ChatInput,
  signal?: AbortSignal,
): Promise<ChatResponse> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ courseId: input.courseId, query: input.query }),
    signal,
  });

  if (!res.ok) throw new Error(`Chat request failed (${res.status})`);

  const parsed = ChatResponseSchema.safeParse(await res.json());
  if (!parsed.success) throw new Error('Chat response failed validation');

  return parsed.data;
}
