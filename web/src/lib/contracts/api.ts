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

// ── Progress wire contract (browser ⇄ /api/progress) ─────────────────────────

const LessonProgressSchema = z.object({
  type: z.literal('lesson'),
  sessionId: z.string().uuid('Invalid session ID format'),
  lessonId: z.string().min(1).max(100),
  courseId: z.string().min(1).max(100).optional(),
  visitedHotspots: z.array(z.string().max(200)).max(50).optional(),
  completed: z.boolean().optional(),
});

// Quiz results are NOT part of this contract: attempts are recorded
// server-side by /api/quiz/grade so a client can never supply its own
// `passed` / `score` (see contracts/quiz.ts).

// Kept as a discriminated union so future progress types slot in without
// changing the route's parse logic.
export const ProgressRequestSchema = z.discriminatedUnion('type', [LessonProgressSchema]);

export type ProgressRequestBody = z.infer<typeof ProgressRequestSchema>;

// ── Upload wire contract (browser ⇄ /api/upload) ──────────────────────────────
// /api/upload forwards the multipart form (course_id + file) server-to-server
// to the parser service and passes its response through unchanged.

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50MB — enforced before forwarding

export const UploadResponseSchema = z.object({
  status: z.string(),
  filename: z.string(),
  chunks_stored: z.number().int().min(0),
});

export type UploadResponse = z.infer<typeof UploadResponseSchema>;

// ── Weak-topics contract (browser ⇄ /api/analytics/weak-topics) ───────────────
// Called by MotoViewer before quiz generation to fetch cross-session engagement
// signals. The client sends lesson metadata so the server can map lessonIds to
// human-readable topics without a Sanity round-trip.

export const WeakTopicsRequestSchema = z.object({
  courseId: z.string().min(1).max(100),
  lessons: z
    .array(
      z.object({
        id: z.string().min(1).max(100),
        headline: z.string().max(300),
        topics: z.array(z.string().max(200)),
      }),
    )
    .min(1)
    .max(100),
});

export type WeakTopicsRequest = z.infer<typeof WeakTopicsRequestSchema>;

export const WeakTopicsResponseSchema = z.object({
  weakTopics: z.array(z.string()),
  engagement: z.array(z.object({ lessonId: z.string(), viewCount: z.number() })),
});

export type WeakTopicsResponse = z.infer<typeof WeakTopicsResponseSchema>;
