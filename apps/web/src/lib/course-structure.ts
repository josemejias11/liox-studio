import type {
  CourseSection,
  LessonSection,
  SanityDisclaimer,
  SanityQuizDoc,
  SanitySpecification,
} from '@/lib/contracts/sanity';

// ── Derived course structure ──────────────────────────────────────────────────
// One source of truth for grouping raw course sections into chapter-aware lesson
// collections plus the trailing non-lesson sections. Navigation-specific flow
// ordering lives in `course-flow.ts`.

export interface ChapterGroup {
  chapterIndex: number;
  chapterTitle: string;
  quickCheck?: SanityQuizDoc;
  /** Lessons in this chapter, each carrying its absolute section index. */
  lessons: Array<{ section: LessonSection; absoluteIndex: number }>;
}

export interface CourseStructure {
  sections: CourseSection[];
  lessonSections: LessonSection[];
  specSections: SanitySpecification[];
  disclaimerSection: SanityDisclaimer | undefined;
  /** Unique chapters in course order, with their lessons grouped. */
  chapters: ChapterGroup[];
  totalSections: number;
}

export function deriveCourseStructure(
  sections: CourseSection[],
  rawChapters: Array<{ quickCheck?: SanityQuizDoc }> = [],
): CourseStructure {
  const lessonSections = sections.filter((s): s is LessonSection => s.sectionType === 'lesson');
  const specSections = sections.filter(
    (s): s is SanitySpecification => s.sectionType === 'specification',
  );
  const disclaimerSection = sections.find(
    (s): s is SanityDisclaimer => s.sectionType === 'disclaimer',
  );

  // Group lessons by chapterIndex while preserving absolute section indices.
  const chapters: ChapterGroup[] = [];
  const groupByChapter = new Map<number, ChapterGroup>();
  lessonSections.forEach((section, absoluteIndex) => {
    let group = groupByChapter.get(section.chapterIndex);
    if (!group) {
      group = {
        chapterIndex: section.chapterIndex,
        chapterTitle: section.chapterTitle,
        quickCheck: rawChapters[section.chapterIndex]?.quickCheck,
        lessons: [],
      };
      groupByChapter.set(section.chapterIndex, group);
      chapters.push(group);
    }
    group.lessons.push({ section, absoluteIndex });
  });

  return {
    sections,
    lessonSections,
    specSections,
    disclaimerSection,
    chapters,
    totalSections: sections.length,
  };
}

/** Lessons belonging to a chapter, in order. */
export function getChapterLessons(
  structure: CourseStructure,
  chapterIndex: number,
): LessonSection[] {
  return (
    structure.chapters
      .find((c) => c.chapterIndex === chapterIndex)
      ?.lessons.map((l) => l.section) ?? []
  );
}
