import { z } from 'zod';

import { CourseAssessmentInputSchema } from './course-assessment';
import { COURSE_LESSON_TYPES } from './course-studio';

export const COURSE_TEMPLATE_LESSON_TYPES = COURSE_LESSON_TYPES.filter(
  (lessonType) => lessonType !== 'quiz',
) as [
  Exclude<(typeof COURSE_LESSON_TYPES)[number], 'quiz'>,
  ...Exclude<(typeof COURSE_LESSON_TYPES)[number], 'quiz'>[],
];

const CourseTemplateLessonSchema = z.object({
  key: z.string().min(1).max(120),
  lessonType: z.enum(COURSE_TEMPLATE_LESSON_TYPES),
  headline: z.string().trim().min(1).max(2000),
  body: z.unknown().nullable().optional(),
  payload: z.unknown().optional(),
});

const CourseTemplateChapterSchema = z.object({
  key: z.string().min(1).max(120),
  title: z.string().trim().min(1).max(2000),
  estimatedDuration: z.number().int().min(1).max(180).nullable().optional(),
  lessons: z.array(CourseTemplateLessonSchema).min(1).max(100),
  quickCheck: CourseAssessmentInputSchema.optional(),
});

export const CourseTemplateDefinitionSchema = z.object({
  key: z.string().min(1).max(120),
  version: z.number().int().min(1),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional(),
  learningObjectives: z.array(z.string().trim().min(1).max(500)).max(12).optional(),
  cover: z.unknown().nullable().optional(),
  chapters: z.array(CourseTemplateChapterSchema).min(1).max(100),
  finalQuiz: CourseAssessmentInputSchema.optional(),
});
export type CourseTemplateDefinition = z.infer<typeof CourseTemplateDefinitionSchema>;

export const TemplateRequirementSchema = z.discriminatedUnion('rule', [
  z.object({
    id: z.string(),
    entityId: z.string(),
    field: z.string(),
    label: z.string(),
    rule: z.literal('changed'),
    initialFingerprint: z.string(),
  }),
  z.object({
    id: z.string(),
    entityId: z.string(),
    field: z.string(),
    label: z.string(),
    rule: z.literal('media'),
  }),
  z.object({
    id: z.string(),
    entityId: z.string(),
    field: z.string(),
    label: z.string(),
    rule: z.literal('minimum'),
    minimum: z.number().int().min(1),
  }),
  z.object({
    id: z.string(),
    entityId: z.string(),
    field: z.string(),
    label: z.string(),
    rule: z.literal('assessment'),
  }),
]);

export const CourseTemplateChecklistSchema = z.object({
  templateKey: z.string().min(1).max(120),
  templateVersion: z.number().int().min(1),
  requirements: z.array(TemplateRequirementSchema).max(500),
});
export type CourseTemplateChecklist = z.infer<typeof CourseTemplateChecklistSchema>;
