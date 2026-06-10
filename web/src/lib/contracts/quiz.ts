import { z } from "zod";

// ── AI quiz contract ──────────────────────────────────────────────────────────
// Shared between the /api/quiz route handler (response validation before
// sending) and the QuizLesson client (response validation after fetching).

export const AiQuizResponseSchema = z.object({
  title: z.string().max(200),
  instructions: z.string().max(2000).optional(),
  questions: z
    .array(
      z.object({
        question: z.string().max(500),
        options: z.array(z.string().max(200)).length(4),
        correct_answer: z.string().max(200),
        explanation: z.string().max(500),
        image_url: z.string().max(2000).optional(),
      })
    )
    .min(1)
    .max(20),
});

export type AiQuizResponse = z.infer<typeof AiQuizResponseSchema>;
