import { z } from 'zod';

export const CourseReadinessIssueCodeSchema = z.enum([
  'template_placeholder',
  'required_media',
  'unsupported_lesson',
  'invalid_assessment',
  'invalid_drag_drop',
  'invalid_learning_cue',
]);
export type CourseReadinessIssueCode = z.infer<typeof CourseReadinessIssueCodeSchema>;

export const CourseReadinessIssueSchema = z.object({
  code: CourseReadinessIssueCodeSchema,
  entityId: z.string().min(1).max(100).optional(),
  field: z.string().min(1).max(120).optional(),
  message: z.string().min(1).max(2000),
});
export type CourseReadinessIssue = z.infer<typeof CourseReadinessIssueSchema>;
