import { createReviewFeedback } from '@moto-ai/database';

export function createCourseReviewFeedback(
  token: string,
  input: { authorName: string; message: string; lessonId?: string; assistantQuestion?: string },
) {
  return createReviewFeedback(token, input);
}
