import { z } from 'zod';

// ── Chat wire contract (browser ⇄ /api/chat) ──────────────────────────────────
// /api/chat is a server-to-server proxy in front of the self-hosted parser/RAG
// service; the browser never talks to the parser directly. Both the route
// handler and every client (CourseChat, DiscoveryPanel) validate against these
// schemas so the two sides cannot drift.

export const ChatRequestSchema = z.object({
  courseId: z.string().min(1).max(100),
  query: z.string().min(1).max(2000),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export const ChatResponseSchema = z.object({
  answer: z.string(),
  sources: z.array(z.string()),
});

export type ChatResponse = z.infer<typeof ChatResponseSchema>;
