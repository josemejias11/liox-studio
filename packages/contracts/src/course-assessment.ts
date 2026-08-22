import { z } from 'zod';

import { CourseImageReferenceSchema } from './course-assets';

export const CourseAssessmentAnswerSchema = z.object({
  _key: z.string().min(1).max(120),
  text: z.string().trim().min(1).max(1000),
  isCorrect: z.boolean(),
  feedback: z.string().trim().max(2000).optional(),
});

export const CourseAssessmentQuestionSchema = z
  .object({
    _key: z.string().min(1).max(120),
    questionText: z.string().trim().min(1).max(2000),
    questionType: z.literal('single'),
    image: CourseImageReferenceSchema.optional(),
    explanation: z.string().trim().max(2000).optional(),
    answers: z.array(CourseAssessmentAnswerSchema).min(2).max(8),
  })
  .superRefine((question, context) => {
    if (question.answers.filter((answer) => answer.isCorrect).length !== 1) {
      context.addIssue({
        code: 'custom',
        path: ['answers'],
        message: 'Exactly one answer must be marked correct.',
      });
    }
  });

export const CourseAssessmentInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  instructions: z.string().trim().max(2000).optional(),
  questions: z.array(CourseAssessmentQuestionSchema).min(1).max(100),
  passingScore: z.number().min(0).max(100),
  allowRetry: z.boolean(),
  showCorrectAnswers: z.boolean(),
});
export type CourseAssessmentInput = z.infer<typeof CourseAssessmentInputSchema>;
