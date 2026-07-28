import { z } from 'zod';

export const courseAssetRefSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  filename: z.string().optional(),
  contentType: z.string().optional(),
});
export type CourseAssetRef = z.infer<typeof courseAssetRefSchema>;
