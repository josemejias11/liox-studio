import type {
  CourseSection,
  LessonSection,
  SanityDisclaimer,
  SanityQuizDoc,
  SanitySpecification,
} from '@/lib/contracts/sanity';

// ── Derived course structure ──────────────────────────────────────────────────
// One source of truth for section grouping / absolute indexing, shared by
// MotoViewer (navigation) and NavMap (rendering). Absolute indices refer to
// positions in the flat `sections` array: lessons first, then specifications,
// then quiz, then disclaimer.

export interface ChapterGroup {
  chapterIndex: number;
  chapterTitle: string;
  /** Lessons in this chapter, each carrying its absolute section index. */
  lessons: Array<{ section: LessonSection; absoluteIndex: number }>;
}

export interface CourseStructure {
  sections: CourseSection[];
  lessonSections: LessonSection[];
  specSections: SanitySpecification[];
  quizSection: SanityQuizDoc | undefined;
  disclaimerSection: SanityDisclaimer | undefined;
  /** Unique chapters in course order, with their lessons grouped. */
  chapters: ChapterGroup[];
  /** Absolute index of the first specification section. */
  specOffset: number;
  /** Absolute index of the quiz section (if present). */
  quizOffset: number;
  /** Absolute index of the disclaimer section (if present). */
  disclaimerOffset: number;
  totalSections: number;
}

export function deriveCourseStructure(sections: CourseSection[]): CourseStructure {
  const lessonSections = sections.filter((s): s is LessonSection => s.sectionType === 'lesson');
  const specSections = sections.filter(
    (s): s is SanitySpecification => s.sectionType === 'specification',
  );
  const quizSection = sections.find((s): s is SanityQuizDoc => s.sectionType === 'quiz');
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
        lessons: [],
      };
      groupByChapter.set(section.chapterIndex, group);
      chapters.push(group);
    }
    group.lessons.push({ section, absoluteIndex });
  });

  const specOffset = lessonSections.length;
  const quizOffset = specOffset + specSections.length;
  const disclaimerOffset = quizOffset + (quizSection ? 1 : 0);

  return {
    sections,
    lessonSections,
    specSections,
    quizSection,
    disclaimerSection,
    chapters,
    specOffset,
    quizOffset,
    disclaimerOffset,
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
