import { z } from "zod";

export const SlideProgressSchema = z.object({
  type: z.literal("slide"),
  sessionId: z.string().min(1),
  slideId: z.string().min(1),
  visitedHotspots: z.array(z.string()).optional(),
  completed: z.boolean().optional(),
});

export const QuizProgressSchema = z.object({
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

export const ProgressRequestSchema = z.discriminatedUnion("type", [
  SlideProgressSchema,
  QuizProgressSchema,
]);

export type ProgressRequestBody = z.infer<typeof ProgressRequestSchema>;
