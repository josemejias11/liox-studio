import { notFound } from "next/navigation";
import { readClient } from "@/sanity/lib/client";
import { COURSE_BY_SLUG_QUERY } from "@/sanity/lib/queries";
import MotoViewer from "@/components/MotoViewer";
import type { CourseSection, LessonSection } from "@/components/MotoViewer";
import type { SanitySpecification } from "@/components/SpecificationPage";
import type { SanityDisclaimer } from "@/components/DisclaimerPage";
import type { SanityQuizDoc } from "@/components/QuizLesson";

// Raw Sanity shapes (before enrichment) — typed loosely because GROQ output is
// not statically typed; each derived CourseSection is properly typed.
type RawLesson = Record<string, unknown> & { sectionType: "lesson" };
type RawChapter = {
  _id?: string;
  title?: string;
  estimatedDuration?: number;
  lessons?: RawLesson[];
};

export default async function CoursePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = await params;

  const course = await readClient.fetch(COURSE_BY_SLUG_QUERY, {
    slug: resolvedParams.slug,
  });

  if (!course) {
    notFound();
  }

  // ── 1. Lessons from all chapters (enriched with chapterTitle + chapterIndex) ──
  const lessonSections: LessonSection[] = (course.chapters ?? []).flatMap(
    (chapter: RawChapter, chapterIndex: number) =>
      (chapter.lessons ?? []).map((lesson: RawLesson) => ({
        ...(lesson as object),
        sectionType: "lesson" as const,
        chapterTitle: String(chapter.title ?? ""),
        chapterIndex,
      })) as LessonSection[]
  );

  // ── 2. Course-level specifications ────────────────────────────────────────────
  const specSections: SanitySpecification[] = (
    course.specifications ?? []
  ) as SanitySpecification[];

  // ── 3. Course-level quiz ──────────────────────────────────────────────────────
  const quizSections: SanityQuizDoc[] = course.quiz
    ? [course.quiz as SanityQuizDoc]
    : [];

  // ── 4. Course-level disclaimer ────────────────────────────────────────────────
  const disclaimerSections: SanityDisclaimer[] = course.disclaimer
    ? [course.disclaimer as SanityDisclaimer]
    : [];

  // ── Flat sections array — order defines course flow ────────────────────────
  const sections: CourseSection[] = [
    ...lessonSections,
    ...specSections,
    ...quizSections,
    ...disclaimerSections,
  ];

  return (
    <div className="w-full h-dvh overflow-hidden bg-background">
      <MotoViewer
        course={course}
        sections={sections}
        course_title={String(course.title ?? "")}
        course_description={
          course.description ? String(course.description) : undefined
        }
      />
    </div>
  );
}
