import { z } from 'zod';
import { GenerateQuizRequestSchema } from '@moto-ai/contracts/quiz';

const revisionIdField = z.string().min(1).max(100);
const reviewTokenField = z.string().min(1).max(200);

export type RevisionIdentity =
  { revisionId: string; reviewToken?: never } | { reviewToken: string; revisionId?: never };

const chatRequestBase = z.object({
  courseId: z.string().min(1).max(100),
  query: z.string().min(1).max(2000),
});

export const ChatRequestSchema = z.union([
  chatRequestBase
    .extend({
      revisionId: revisionIdField,
      reviewToken: z.never().optional(),
    })
    .strict(),
  chatRequestBase
    .extend({
      reviewToken: reviewTokenField,
      revisionId: z.never().optional(),
    })
    .strict(),
]);

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export const ChatResponseSchema = z.object({
  answer: z.string(),
  sources: z.array(z.string()),
});

export type ChatResponse = z.infer<typeof ChatResponseSchema>;

export const RevisionBoundQuizRequestSchema = z.union([
  GenerateQuizRequestSchema.extend({
    revisionId: revisionIdField,
    reviewToken: z.never().optional(),
  }).strict(),
  GenerateQuizRequestSchema.extend({
    reviewToken: reviewTokenField,
    revisionId: z.never().optional(),
  }).strict(),
]);

export type RevisionBoundQuizRequest = z.infer<typeof RevisionBoundQuizRequestSchema>;

const LessonProgressSchema = z.object({
  type: z.literal('lesson'),
  sessionId: z.string().uuid('Invalid session ID format'),
  lessonId: z.string().min(1).max(100),
  courseId: z.string().min(1).max(100).optional(),
  visitedHotspots: z.array(z.string().max(200)).max(50).optional(),
  completed: z.boolean().optional(),
});
export const ProgressRequestSchema = z.discriminatedUnion('type', [LessonProgressSchema]);

export type ProgressRequestBody = z.infer<typeof ProgressRequestSchema>;

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
