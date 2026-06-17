import { notFound } from 'next/navigation';
import { readClient } from '@/sanity/lib/client';
import { COURSE_BY_SLUG_QUERY } from '@/sanity/lib/queries';
import MotoViewer from '@/player/MotoViewer';
import { courseSchema, type CourseSection, type LessonSection } from '@/lib/contracts/sanity';

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;

  const raw = await readClient.fetch<unknown>(
    COURSE_BY_SLUG_QUERY,
    { slug: resolvedParams.slug },
    { next: { revalidate: 300 } },
  );

  if (!raw) {
    notFound();
  }

  // Validate the GROQ payload against the shared Sanity contract once at the
  // boundary; everything downstream consumes typed values.
  const parsed = courseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(
      `[course/${resolvedParams.slug}] Sanity payload failed contract validation:`,
      parsed.error.issues,
    );
    notFound();
  }
  const course = parsed.data;

  // ── 1. Lessons from all chapters (enriched with chapterTitle + chapterIndex) ──
  const lessonSections: LessonSection[] = (course.chapters ?? []).flatMap((chapter, chapterIndex) =>
    (chapter.lessons ?? []).map((lesson) => ({
      ...lesson,
      chapterTitle: chapter.title ?? '',
      chapterIndex,
    })),
  );

  // ── Flat sections array — order defines course flow ────────────────────────
  const sections: CourseSection[] = [
    ...lessonSections,
    ...(course.specifications ?? []),
    ...(course.disclaimer ? [course.disclaimer] : []),
  ];

  return (
    <div className="bg-background h-dvh w-full overflow-hidden">
      <MotoViewer course={course} sections={sections} />
    </div>
  );
}
