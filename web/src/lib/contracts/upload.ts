import { z } from 'zod';

// ── Upload wire contract (browser ⇄ /api/upload) ──────────────────────────────
// /api/upload forwards the multipart form (course_id + file) server-to-server
// to the parser service and passes its response through unchanged.

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50MB — enforced before forwarding

export const UploadResponseSchema = z.object({
  status: z.string(),
  filename: z.string(),
  chunks_stored: z.number().int().min(0),
});

export type UploadResponse = z.infer<typeof UploadResponseSchema>;
