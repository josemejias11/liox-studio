import { z } from "zod";

const LessonProgressSchema = z.object({
  type: z.literal("lesson"),
  sessionId: z.string().min(1),
  lessonId: z.string().min(1),
  visitedHotspots: z.array(z.string()).optional(),
  completed: z.boolean().optional(),
});

const QuizProgressSchema = z.object({
  type: z.literal("quiz"),
  sessionId: z.string().min(1),
  moduleId: z.string().min(1),
  score: z.number().int().min(0),
  total: z.number().int().min(1),
  answers: z.array(
    z.object({
      question: z.string(),
      selected: z.string(),
      correct: z.string(),
    })
  ).optional(),
});

const LayerProgressSchema = z.object({
  type: z.literal("layer"),
  sessionId: z.string().min(1),
  lessonId: z.string().min(1),
  layerId: z.string().min(1),
  visitedHotspots: z.array(z.string()).optional(),
  completed: z.boolean().optional(),
});

export const ProgressRequestSchema = z.discriminatedUnion("type", [
  LessonProgressSchema,
  LayerProgressSchema,
  QuizProgressSchema,
]);

export type ProgressRequestBody = z.infer<typeof ProgressRequestSchema>;
