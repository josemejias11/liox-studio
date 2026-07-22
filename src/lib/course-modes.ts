export const STANDARD_LESSON_TYPES = [
  'content',
  'interaction',
  'stage',
  'video',
  'quiz',
  'splitScreen',
  'dragDrop',
  'colorSwitcher',
  'scrollStory',
] as const;

export const CANVAS_LESSON_TYPES = ['canvas'] as const;

export const ALL_LESSON_TYPES = [
  ...STANDARD_LESSON_TYPES,
  ...CANVAS_LESSON_TYPES,
] as const;

export type CourseMode = 'standard' | 'canvas';
export type LessonType = (typeof ALL_LESSON_TYPES)[number];
