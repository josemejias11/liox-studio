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
  /** Absolute index of the first specification section. */
  specOffset: number;
  /** Absolute index where the course-level AI quiz phase maps (= specOffset + specSections.length). */
  quizOffset: number;
  /**
   * Absolute index of the disclaimer section.
   * Equals `quizOffset + 1` when a disclaimer section exists; equals
   * `quizOffset` otherwise (both point past the end of the sections array,
   * which is harmless since the disclaimer row is only rendered when
   * `disclaimerSection` is defined).
   */
  disclaimerOffset: number;
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

  const specOffset = lessonSections.length;
  const quizOffset = specOffset + specSections.length;
  // The disclaimer follows the quiz in the nav sequence; giving it a distinct
  // absolute index ensures the NavMap can correctly highlight the disclaimer
  // row as "current" without conflating it with the quiz row.
  const disclaimerOffset = disclaimerSection !== undefined ? quizOffset + 1 : quizOffset;

  return {
    sections,
    lessonSections,
    specSections,
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
