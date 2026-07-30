export const COURSE_LESSON_TYPES = [
  'content',
  'interaction',
  'stage',
  'video',
  'quiz',
  'canvas',
  'colorSwitcher',
  'splitScreen',
  'dragDrop',
  'scrollStory',
] as const;

export type CourseLessonType = (typeof COURSE_LESSON_TYPES)[number];

export interface ChapterInput {
  title?: string;
  estimatedDuration?: number | null;
}

export interface LessonInput {
  headline?: string;
  body?: unknown | null;
  payload?: unknown;
}

export interface CourseGraphLesson {
  id: string;
  position: number;
  lessonType: string;
  headline: string;
  body: unknown | null;
  payload: unknown;
}

export interface CourseGraphChapter {
  id: string;
  title: string;
  position: number;
  estimatedDuration: number | null;
  lessons: CourseGraphLesson[];
  quickCheck: {
    id: string;
    title: string | null;
    instructions: string | null;
    payload: unknown;
  } | null;
}

export interface CourseGraph {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  learningObjectives: unknown | null;
  cover: unknown | null;
  specifications: unknown | null;
  disclaimer: unknown | null;
  sourceFiles: unknown | null;
  chapters: CourseGraphChapter[];
}
