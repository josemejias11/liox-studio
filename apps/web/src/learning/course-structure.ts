import type {
  CourseSection,
  LessonSection,
  CourseDisclaimer,
  AuthoredQuiz,
  CourseSpecification,
} from '@/shared/contracts/player-course';

export interface ChapterGroup {
  chapterIndex: number;
  chapterTitle: string;
  quickCheck?: AuthoredQuiz;

  lessons: Array<{ section: LessonSection; absoluteIndex: number }>;
}

export interface CourseStructure {
  sections: CourseSection[];
  lessonSections: LessonSection[];
  specSections: CourseSpecification[];
  disclaimerSection: CourseDisclaimer | undefined;

  chapters: ChapterGroup[];
  totalSections: number;
}

export function deriveCourseStructure(
  sections: CourseSection[],
  rawChapters: Array<{ quickCheck?: AuthoredQuiz }> = [],
): CourseStructure {
  const lessonSections = sections.filter((s): s is LessonSection => s.sectionType === 'lesson');
  const specSections = sections.filter(
    (s): s is CourseSpecification => s.sectionType === 'specification',
  );
  const disclaimerSection = sections.find(
    (s): s is CourseDisclaimer => s.sectionType === 'disclaimer',
  );
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
