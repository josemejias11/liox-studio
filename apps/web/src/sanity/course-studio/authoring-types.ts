export interface StudioReference {
  _key: string;
  _ref: string;
}

export interface AuthoringLesson {
  _id: string;
  _rev: string;
  headline?: string;
  lessonType?: string;
  [field: string]: unknown;
}

export interface AuthoringQuiz {
  _id: string;
  _rev: string;
  title?: string;
  [field: string]: unknown;
}

export interface AuthoringChapter {
  _id: string;
  _rev: string;
  title?: string;
  estimatedDuration?: number;
  lessons: AuthoringLesson[];
  quickCheck?: AuthoringQuiz;
}

export interface AuthoringCourseSummary {
  _id: string;
  _updatedAt: string;
  title?: string;
  thumbnail?: unknown;
}

export interface AuthoringCourse extends AuthoringCourseSummary {
  _rev: string;
  description?: string;
  learningObjectives?: string[];
  chapters: AuthoringChapter[];
  specifications?: Array<Record<string, unknown>>;
  disclaimer?: Record<string, unknown>;
  masterReleases?: StudioReference[];
}

export type AuthoringSelection =
  | { kind: 'course'; courseId: string }
  | { kind: 'chapter'; courseId: string; chapterId: string }
  | { kind: 'lesson'; courseId: string; chapterId: string; lessonId: string };
