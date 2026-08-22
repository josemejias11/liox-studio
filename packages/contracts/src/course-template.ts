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

const CourseTemplateChapterSchema = z
  .object({
    key: z.string().min(1).max(120),
    title: z.string().trim().min(1).max(2000),
    estimatedDuration: z.number().int().min(1).max(180).nullable().optional(),
    lessons: z.array(CourseTemplateLessonSchema).min(1).max(100),
    quickCheckKey: z.string().min(1).max(120).optional(),
    quickCheck: CourseAssessmentInputSchema.optional(),
  })
  .superRefine((chapter, context) => {
    if (Boolean(chapter.quickCheck) !== Boolean(chapter.quickCheckKey)) {
      context.addIssue({
        code: 'custom',
        path: ['quickCheckKey'],
        message: 'A chapter quick check requires a definition-local key.',
      });
    }
  });

const CourseTemplateSpecificationSchema = z
  .object({
    title: z.string().trim().min(1).max(2000),
    subtitle: z.string().trim().max(2000).optional(),
    heroImage: z.unknown().optional(),
    specGroups: z
      .array(
        z.object({
          groupName: z.string().trim().min(1).max(2000),
          specs: z.array(
            z.object({
              label: z.string().trim().min(1).max(2000),
              value: z.string().trim().min(1).max(2000),
              highlight: z.boolean().optional(),
            }),
          ),
        }),
      )
      .min(1),
    footnotes: z.array(z.string().trim().min(1).max(2000)).optional(),
  })
  .passthrough();

const CourseTemplateDisclaimerSchema = z
  .object({
    title: z.string().trim().min(1).max(2000).optional(),
    category: z.enum(['legal', 'safety', 'regulatory', 'warranty', 'general']).optional(),
    body: z.string().trim().min(1).max(2000),
    disclaimers: z.array(z.string().trim().min(1).max(2000)).optional(),
    acknowledgementRequired: z.boolean().optional(),
    acknowledgementLabel: z.string().trim().min(1).max(2000).optional(),
  })
  .passthrough();

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
export type TemplateRequirement = z.infer<typeof TemplateRequirementSchema>;

export const CourseTemplateDefinitionSchema = z
  .object({
    key: z.string().min(1).max(120),
    version: z.number().int().min(1),
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().max(2000).optional(),
    learningObjectives: z.array(z.string().trim().min(1).max(500)).max(12).optional(),
    cover: z.unknown().nullable().optional(),
    specifications: z.array(CourseTemplateSpecificationSchema).max(100).optional(),
    disclaimer: CourseTemplateDisclaimerSchema.nullable().optional(),
    chapters: z.array(CourseTemplateChapterSchema).min(1).max(100),
    finalQuizKey: z.string().min(1).max(120).optional(),
    finalQuiz: CourseAssessmentInputSchema.optional(),
    requirements: z.array(TemplateRequirementSchema).max(500).optional(),
  })
  .superRefine((definition, context) => {
    if (Boolean(definition.finalQuiz) !== Boolean(definition.finalQuizKey)) {
      context.addIssue({
        code: 'custom',
        path: ['finalQuizKey'],
        message: 'A final assessment requires a definition-local key.',
      });
    }

    const entityKeys = new Set(['course']);
    const registerEntityKey = (key: string, path: Array<string | number>) => {
      if (key === 'course') {
        context.addIssue({
          code: 'custom',
          path,
          message: 'The definition-local key "course" is reserved.',
        });
      } else if (entityKeys.has(key)) {
        context.addIssue({
          code: 'custom',
          path,
          message: `Definition-local key "${key}" is already in use.`,
        });
      } else {
        entityKeys.add(key);
      }
    };

    definition.chapters.forEach((chapter, chapterIndex) => {
      registerEntityKey(chapter.key, ['chapters', chapterIndex, 'key']);
      chapter.lessons.forEach((lesson, lessonIndex) => {
        registerEntityKey(lesson.key, ['chapters', chapterIndex, 'lessons', lessonIndex, 'key']);
      });
      if (chapter.quickCheckKey) {
        registerEntityKey(chapter.quickCheckKey, ['chapters', chapterIndex, 'quickCheckKey']);
      }
    });
    if (definition.finalQuizKey) registerEntityKey(definition.finalQuizKey, ['finalQuizKey']);

    const requirementIds = new Set<string>();
    definition.requirements?.forEach((requirement, requirementIndex) => {
      if (requirementIds.has(requirement.id)) {
        context.addIssue({
          code: 'custom',
          path: ['requirements', requirementIndex, 'id'],
          message: `Template requirement ID "${requirement.id}" is already in use.`,
        });
      } else {
        requirementIds.add(requirement.id);
      }
      if (!entityKeys.has(requirement.entityId)) {
        context.addIssue({
          code: 'custom',
          path: ['requirements', requirementIndex, 'entityId'],
          message: `Template requirement references unknown entity "${requirement.entityId}".`,
        });
      }
    });
  });
export type CourseTemplateDefinition = z.infer<typeof CourseTemplateDefinitionSchema>;

export const CourseTemplateChecklistSchema = z.object({
  templateKey: z.string().min(1).max(120),
  templateVersion: z.number().int().min(1),
  requirements: z.array(TemplateRequirementSchema).max(500),
});
export type CourseTemplateChecklist = z.infer<typeof CourseTemplateChecklistSchema>;
