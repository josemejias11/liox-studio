import { z } from "zod";

const LessonProgressSchema = z.object({
  type: z.literal("lesson"),
  sessionId: z.string().uuid("Invalid session ID format"),
  lessonId: z.string().min(1).max(100),
  visitedHotspots: z.array(z.string().max(200)).max(50).optional(),
  completed: z.boolean().optional(),
});

// Quiz results are NOT part of this contract: attempts are recorded
// server-side by /api/quiz/grade so a client can never supply its own
// `passed` / `score` (see contracts/quiz.ts).

const LayerProgressSchema = z.object({
  type: z.literal("layer"),
  sessionId: z.string().uuid("Invalid session ID format"),
  lessonId: z.string().min(1).max(100),
  layerId: z.string().min(1).max(100),
  visitedHotspots: z.array(z.string().max(200)).max(50).optional(),
  completed: z.boolean().optional(),
});

export const ProgressRequestSchema = z.discriminatedUnion("type", [
  LessonProgressSchema,
  LayerProgressSchema,
]);

export type ProgressRequestBody = z.infer<typeof ProgressRequestSchema>;
