import { notFound } from "next/navigation";
import { sanityClient } from "@/sanity/lib/client";
import { MODULE_BY_SLUG_QUERY } from "@/sanity/lib/queries";
import DeckViewer from "@/components/DeckViewer";
import type { CourseSection, LessonSection } from "@/components/DeckViewer";
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

export default async function ModulePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = await params;

  const courseModule = await sanityClient.fetch(MODULE_BY_SLUG_QUERY, {
    slug: resolvedParams.slug,
  });

  if (!courseModule) {
    notFound();
  }

  // ── 1. Lessons from all chapters (enriched with chapterTitle + chapterIndex) ──
  const lessonSections: LessonSection[] = (courseModule.chapters ?? []).flatMap(
    (chapter: RawChapter, chapterIndex: number) =>
      (chapter.lessons ?? []).map((lesson: RawLesson) => ({
        ...(lesson as object),
        // sectionType: "lesson" is already projected by GROQ (LESSON_FIELDS)
        sectionType: "lesson" as const,
        chapterTitle: String(chapter.title ?? ""),
        chapterIndex,
      })) as LessonSection[]
  );

  // ── 2. Module-level specifications (CMS agent adds this field to module) ──
  const specSections: SanitySpecification[] = (
    courseModule.specifications ?? []
  ) as SanitySpecification[];

  // ── 3. Module-level quiz ───────────────────────────────────────────────────
  const quizSections: SanityQuizDoc[] = courseModule.quiz
    ? [courseModule.quiz as SanityQuizDoc]
    : [];

  // ── 4. Module-level disclaimer ─────────────────────────────────────────────
  const disclaimerSections: SanityDisclaimer[] = courseModule.disclaimer
    ? [courseModule.disclaimer as SanityDisclaimer]
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
      <DeckViewer
        module={courseModule}
        sections={sections}
        course_title={String(courseModule.title ?? "")}
        course_description={
          courseModule.description ? String(courseModule.description) : undefined
        }
      />
    </div>
  );
}
