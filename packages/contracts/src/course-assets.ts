import { z } from 'zod';

export const courseAssetUrlSchema = z
  .string()
  .refine(
    (value) =>
      z.string().url().safeParse(value).success ||
      /^\/api\/course-assets\/(?:[^/?#]+\/)*[^/?#]+(?:\?[^#]*)?$/.test(value),
    'Expected an absolute URL or a course asset URL.',
  );

export const CourseImageReferenceSchema = z
  .object({
    asset: z
      .object({
        url: courseAssetUrlSchema,
        originalFilename: z.string().optional(),
      })
      .passthrough(),
  })
  .passthrough();
export type CourseImageReference = z.output<typeof CourseImageReferenceSchema>;

export const courseAssetRefSchema = z.object({
  id: z.string(),
  url: courseAssetUrlSchema,
  filename: z.string().optional(),
  contentType: z.string().optional(),
});
export type CourseAssetRef = z.infer<typeof courseAssetRefSchema>;
