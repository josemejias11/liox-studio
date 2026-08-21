import { z } from 'zod';

export const JobKindSchema = z.enum([
  'document_index',
  'assistant_qa_generate',
  'course_generate',
  'ai_operation',
  'scorm_export',
]);
export type JobKind = z.infer<typeof JobKindSchema>;

export const JobStatusSchema = z.enum(['queued', 'running', 'succeeded', 'failed']);
export type JobStatus = z.infer<typeof JobStatusSchema>;

export const DocumentIndexPayloadSchema = z.object({
  sourceId: z.string().min(1).max(100),
  courseId: z.string().min(1).max(100),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(255),
});
export type DocumentIndexPayload = z.infer<typeof DocumentIndexPayloadSchema>;

export const DocumentIndexResultSchema = z.object({
  filename: z.string().min(1).max(255),
  chunksStored: z.number().int().min(0),
});
export type DocumentIndexResult = z.infer<typeof DocumentIndexResultSchema>;

export const AssistantQaGenerationPayloadSchema = z.object({
  courseId: z.string().min(1).max(100),
  sourceIds: z.array(z.string().min(1).max(100)).max(500),
  sourceHashes: z.array(z.string().regex(/^[0-9a-f]{64}$/)).max(500),
});
export type AssistantQaGenerationPayload = z.infer<typeof AssistantQaGenerationPayloadSchema>;

export const CourseGenerationPayloadSchema = z.object({
  generationId: z.string().min(1).max(100),
});
export type CourseGenerationPayload = z.infer<typeof CourseGenerationPayloadSchema>;

export const ScormExportPayloadSchema = z.object({
  revisionId: z.string().min(1).max(100),
});
export type ScormExportPayload = z.infer<typeof ScormExportPayloadSchema>;

export const ScormExportResultSchema = z.object({
  exportId: z.string().min(1),
  r2Key: z.string().min(1),
  byteSize: z.number().int().min(0),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
});
export type ScormExportResult = z.infer<typeof ScormExportResultSchema>;

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
