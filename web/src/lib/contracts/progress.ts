import { z } from 'zod';

const LessonProgressSchema = z.object({
  type: z.literal('lesson'),
  sessionId: z.string().uuid('Invalid session ID format'),
  lessonId: z.string().min(1).max(100),
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
