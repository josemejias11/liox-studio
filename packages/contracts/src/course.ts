import { z } from 'zod';

export const lessonKinds = [
  'content',
  'interaction',
  'stage',
  'video',
  'quiz',
  'canvas',
  'colorSwitcher',
  'splitScreen',
  'dragDrop',
  'scrollStory',
] as const;

export const lessonKindSchema = z.enum(lessonKinds);
export type LessonKind = z.infer<typeof lessonKindSchema>;

export const courseAssetRefSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  filename: z.string().optional(),
  contentType: z.string().optional(),
});
export type CourseAssetRef = z.infer<typeof courseAssetRefSchema>;

export const coursePublicationStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']);
export type CoursePublicationStatus = z.infer<typeof coursePublicationStatusSchema>;

export const courseRevisionStatusSchema = z.enum([
  'DRAFT',
  'IN_REVIEW',
  'CHANGES_REQUESTED',
  'APPROVED',
  'ARCHIVED',
]);
export type CourseRevisionStatus = z.infer<typeof courseRevisionStatusSchema>;

export const courseFeedbackStatusSchema = z.enum(['OPEN', 'RESOLVED']);
export type CourseFeedbackStatus = z.infer<typeof courseFeedbackStatusSchema>;
