import { z } from "zod";

const LessonProgressSchema = z.object({
  type: z.literal("lesson"),
  sessionId: z.string().uuid("Invalid session ID format"),
  lessonId: z.string().min(1),
  visitedHotspots: z.array(z.string()).max(50).optional(),
  completed: z.boolean().optional(),
});

const QuizProgressSchema = z.object({
  type: z.literal("quiz"),
  sessionId: z.string().uuid("Invalid session ID format"),
  courseId: z.string().min(1),
  score: z.number().int().min(0),
  total: z.number().int().min(1),
  passed: z.boolean(),
  answers: z.array(
    z.object({
      question: z.string(),
      selected: z.string(),
      correct: z.string(),
    })
  ).max(100).optional(),
});

const LayerProgressSchema = z.object({
  type: z.literal("layer"),
  sessionId: z.string().uuid("Invalid session ID format"),
  lessonId: z.string().min(1),
  layerId: z.string().min(1),
  visitedHotspots: z.array(z.string()).max(50).optional(),
  completed: z.boolean().optional(),
});

export const ProgressRequestSchema = z.discriminatedUnion("type", [
  LessonProgressSchema,
  LayerProgressSchema,
  QuizProgressSchema,
]);

export type ProgressRequestBody = z.infer<typeof ProgressRequestSchema>;
