import { ChatRequestSchema, ChatResponseSchema, type ChatResponse } from '@/shared/contracts/api';

export interface ChatInput {
  courseId: string;
  query: string;
  revisionId?: string;
  reviewToken?: string;
}


export async function askCourseChat(input: ChatInput, signal?: AbortSignal): Promise<ChatResponse> {
  const request = ChatRequestSchema.safeParse(input);
  if (!request.success) throw new Error('Chat request requires one revision identity');

  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request.data),
    signal,
  });

  if (!res.ok) throw new Error(`Chat request failed (${res.status})`);

  const parsed = ChatResponseSchema.safeParse(await res.json());
  if (!parsed.success) throw new Error('Chat response failed validation');

  return parsed.data;
}
