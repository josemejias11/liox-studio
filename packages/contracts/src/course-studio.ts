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

export const COURSE_SOURCE_INDEX_STATUSES = ['pending', 'indexed', 'failed', 'deleting'] as const;

export type CourseSourceIndexStatus = (typeof COURSE_SOURCE_INDEX_STATUSES)[number];

export interface CourseSourceFile {
  id: string;
  courseId: string;
  r2Key: string;
  filename: string;
  contentType: string;
  byteSize: number;
  sha256: string;
  indexStatus: CourseSourceIndexStatus;
  chunksStored: number | null;
  indexError: string | null;
  ownership: 'owned' | 'inherited';
  createdAt: string;
  updatedAt: string;
}

export interface CourseRevisionSource {
  revisionId: string;
  sourceFileId: string;
  sha256: string;
  filename: string;
}

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

export interface CourseGraphQuiz {
  id: string;
  title: string | null;
  instructions: string | null;
  payload: unknown;
}

export interface CourseGraph {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  createdFromTemplateKey: string | null;
  createdFromTemplateVersion: number | null;
  templateChecklist: unknown | null;
  creationJobId: string | null;
  duplicatedFromCourseId: string | null;
  learningObjectives: unknown | null;
  cover: unknown | null;
  specifications: unknown | null;
  disclaimer: unknown | null;
  finalQuiz: CourseGraphQuiz | null;
  chapters: CourseGraphChapter[];
}
