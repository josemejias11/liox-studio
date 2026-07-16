import { z } from 'zod';

export const JobKindSchema = z.enum(['document_index', 'quiz_generate', 'ai_operation']);
export type JobKind = z.infer<typeof JobKindSchema>;

export const JobStatusSchema = z.enum(['queued', 'running', 'succeeded', 'failed']);
export type JobStatus = z.infer<typeof JobStatusSchema>;

export const DocumentIndexPayloadSchema = z.object({
  courseId: z.string().min(1).max(100),
  filename: z.string().min(1).max(255),
  contentType: z.string().max(255).optional(),
});
export type DocumentIndexPayload = z.infer<typeof DocumentIndexPayloadSchema>;

export const DocumentIndexResultSchema = z.object({
  filename: z.string().min(1).max(255),
  chunksStored: z.number().int().min(0),
});
export type DocumentIndexResult = z.infer<typeof DocumentIndexResultSchema>;

export const QuizGenerationPayloadSchema = z.object({
  courseId: z.string().min(1).max(100),
  weakTopics: z.array(z.string().min(1).max(200)).max(20),
});
export type QuizGenerationPayload = z.infer<typeof QuizGenerationPayloadSchema>;

export const AiOperationPayloadSchema = z.object({
  operation: z.string().min(1).max(100),
  input: z.record(z.string(), z.unknown()),
});
export type AiOperationPayload = z.infer<typeof AiOperationPayloadSchema>;

export const JobAcceptedResponseSchema = z.object({
  jobId: z.string().min(1),
  status: z.literal('queued'),
});
export type JobAcceptedResponse = z.infer<typeof JobAcceptedResponseSchema>;

export const JobStatusResponseSchema = z.object({
  id: z.string().min(1),
  kind: JobKindSchema,
  status: JobStatusSchema,
  progress: z.string().nullable(),
  result: z.unknown().nullable(),
  errorMessage: z.string().nullable(),
  updatedAt: z.string().datetime(),
});
export type JobStatusResponse = z.infer<typeof JobStatusResponseSchema>;

export function normalizeWeakTopics(topics: string[]): string[] {
  return [...new Set(topics.map((topic) => topic.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}
