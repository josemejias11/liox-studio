import { courseSchema, type CourseSection, type LessonSection, type CourseContent } from '@/shared/contracts/player-course';

export interface NormalizedCourseContent {
  course: CourseContent;
  sections: CourseSection[];
}

/**
 * Validate the persisted course graph and normalize it into a flat sections array.
 * Returns `null` when the payload fails contract validation.
 */
export function normalizeCourseContent(raw: unknown): NormalizedCourseContent | null {
  const parsed = courseSchema.safeParse(raw);
  if (!parsed.success) return null;
  const course = parsed.data;

  const lessonSections: LessonSection[] = (course.chapters ?? []).flatMap((chapter, chapterIndex) =>
    (chapter.lessons ?? []).map((lesson) => ({
      ...lesson,
      chapterTitle: chapter.title ?? '',
      chapterIndex,
    })),
  );

  const sections: CourseSection[] = [
    ...lessonSections,
    ...(course.specifications ?? []),
    ...(course.disclaimer ? [course.disclaimer] : []),
  ];

  return { course, sections };
}
