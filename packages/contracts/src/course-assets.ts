import { z } from 'zod';

export const CourseImageReferenceSchema = z
  .object({
    asset: z
      .object({
        url: z.string().url(),
        originalFilename: z.string().optional(),
      })
      .passthrough(),
  })
  .passthrough();
export type CourseImageReference = z.output<typeof CourseImageReferenceSchema>;

export const courseAssetRefSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  filename: z.string().optional(),
  contentType: z.string().optional(),
});
export type CourseAssetRef = z.infer<typeof courseAssetRefSchema>;
