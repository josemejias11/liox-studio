import type { AuthoringCourse } from '@moto-ai/database';
import { normalizeCourseContent, type NormalizedCourseContent } from '@/lib/course-content';

function objectPayload(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function toPlayerPreview(course: AuthoringCourse): NormalizedCourseContent | null {
  return normalizeCourseContent({
    _id: course.id,
    title: course.title,
    courseMode: course.courseMode,
    description: course.description ?? undefined,
    chapters: course.chapters.map((chapter) => ({
      _id: chapter.id,
      title: chapter.title,
      estimatedDuration: chapter.estimatedDuration ?? undefined,
      lessons: chapter.lessons.map((lesson) => ({
        sectionType: 'lesson',
        _key: lesson.id,
        headline: lesson.headline,
        lessonType: lesson.lessonType,
        ...(lesson.body ? { body: lesson.body } : {}),
        ...objectPayload(lesson.payload),
      })),
    })),
  });
}
