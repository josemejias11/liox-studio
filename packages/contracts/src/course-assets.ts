import { z } from 'zod';

function isCanonicalCourseAssetUrl(value: string): boolean {
  if (!/^\/api\/course-assets\/courses\/[^/?#]+\/[^/?#]+$/.test(value)) return false;
  const segments = value.split('/').slice(4);
  return segments.every((segment) => {
    try {
      const decoded = decodeURIComponent(segment);
      return (
        decoded !== '.' && decoded !== '..' && !decoded.includes('/') && !decoded.includes('\\')
      );
    } catch {
      return false;
    }
  });
}

export const courseAssetUrlSchema = z
  .string()
  .refine(
    (value) => z.string().url().safeParse(value).success || isCanonicalCourseAssetUrl(value),
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
