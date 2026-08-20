import { getReviewByToken } from '@moto-ai/database';
import { toPlayerCourseContent } from '@/learning/course-player-adapter';

export async function loadReviewPlayer(token: string) {
  const review = await getReviewByToken(token);
  const content = review ? toPlayerCourseContent(review.course) : null;
  if (!review || !content) return null;
  return {
    content,
    assistant: review.assistant,
    assistantReferences: review.assistantReferences,
    lessons: review.course.chapters.flatMap((chapter) =>
      chapter.lessons.map((lesson) => ({
        id: lesson.id,
        label: `${chapter.title} — ${lesson.headline}`,
      })),
    ),
    title: review.title,
    version: review.version,
  };
}
