import { z } from 'zod';

import { COURSE_LESSON_TYPES } from './course-studio';

export const COURSE_GENERATION_PROMPT_VERSION = 'course-generation.v1';

const requiredText = (maximum: number) => z.string().trim().min(1).max(maximum);

export const CourseGenerationRequestSchema = z.strictObject({
  brief: requiredText(4000),
  sourceRevisionId: requiredText(100),
});
export type CourseGenerationRequest = z.infer<typeof CourseGenerationRequestSchema>;

export const GeneratedAssetPlaceholderSchema = z.strictObject({
  role: z.enum([
    'cover',
    'primary-media',
    'supporting-image',
    'video',
    'interaction-background',
    'quiz-image',
  ]),
  description: requiredText(500),
  altText: requiredText(300),
});

export const GeneratedInteractionDraftSchema = z.strictObject({
  kind: z.enum(['callout', 'hotspot', 'stage-point', 'drag-item', 'scroll-step', 'color-variant']),
  label: requiredText(160),
  instruction: requiredText(1000),
  feedback: requiredText(1000).nullish(),
});

export const GeneratedQuizSuggestionSchema = z
  .strictObject({
    question: requiredText(1000),
    options: z.array(requiredText(500)).min(2).max(6),
    suggestedCorrectAnswerIndex: z.number().int().min(0),
    rationale: requiredText(1000),
  })
  .superRefine((suggestion, context) => {
    if (suggestion.suggestedCorrectAnswerIndex >= suggestion.options.length) {
      context.addIssue({
        code: 'custom',
        path: ['suggestedCorrectAnswerIndex'],
        message: 'Suggested answer must reference an available option.',
      });
    }
  });

export const GeneratedCourseLessonSchema = z.strictObject({
  lessonType: z.enum(COURSE_LESSON_TYPES),
  headline: requiredText(180),
  body: requiredText(12_000),
  interactionDrafts: z.array(GeneratedInteractionDraftSchema).max(20),
  assetPlaceholders: z.array(GeneratedAssetPlaceholderSchema).max(20),
  quizSuggestions: z.array(GeneratedQuizSuggestionSchema).max(10),
});

export const GeneratedCourseChapterSchema = z.strictObject({
  title: requiredText(180),
  estimatedDuration: z.number().int().min(1).max(180),
  lessons: z.array(GeneratedCourseLessonSchema).min(1).max(20),
});

export const GeneratedCourseGraphSchema = z
  .strictObject({
    title: requiredText(120),
    description: requiredText(2000),
    objectives: z.array(requiredText(500)).min(1).max(12),
    chapters: z.array(GeneratedCourseChapterSchema).min(1).max(12),
  })
  .superRefine((graph, context) => {
    const lessonCount = graph.chapters.reduce(
      (total, chapter) => total + chapter.lessons.length,
      0,
    );
    if (lessonCount > 100) {
      context.addIssue({
        code: 'custom',
        path: ['chapters'],
        message: 'A generated course may contain at most 100 lessons.',
      });
    }
  });
export type GeneratedCourseGraph = z.infer<typeof GeneratedCourseGraphSchema>;

export const ParserCourseGenerationResponseSchema = z.strictObject({
  graph: GeneratedCourseGraphSchema,
  model_identifier: requiredText(300),
  prompt_template_version: z.literal(COURSE_GENERATION_PROMPT_VERSION),
});
export type ParserCourseGenerationResponse = z.infer<typeof ParserCourseGenerationResponseSchema>;

export const COURSE_GENERATION_STATUSES = ['queued', 'running', 'succeeded', 'failed'] as const;
export type CourseGenerationStatus = (typeof COURSE_GENERATION_STATUSES)[number];

export interface CourseGenerationSummary {
  id: string;
  jobId: string;
  sourceRevisionId: string;
  sourceRevisionLabel?: string;
  brief: string;
  promptTemplateVersion: string;
  requestedSourceIds: string[];
  modelIdentifier: string | null;
  status: CourseGenerationStatus;
  error: string | null;
  createdCourseId: string | null;
  createdAt: string;
  updatedAt: string;
}
