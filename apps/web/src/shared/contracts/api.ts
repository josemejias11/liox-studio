import { z } from 'zod';

export type RevisionIdentity =
  { revisionId: string; reviewToken?: never } | { reviewToken: string; revisionId?: never };

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
