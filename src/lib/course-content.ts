import { courseSchema, type CourseSection, type LessonSection, type SanityCourse } from '@/lib/contracts/sanity';

export interface NormalizedCourseContent {
  course: SanityCourse;
  sections: CourseSection[];
}

/**
 * Validate raw Sanity data and normalize it into a flat sections array.
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
