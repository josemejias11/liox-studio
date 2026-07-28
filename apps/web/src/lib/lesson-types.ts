export const ALL_LESSON_TYPES = [
  'content',
  'interaction',
  'stage',
  'video',
  'quiz',
  'splitScreen',
  'dragDrop',
  'colorSwitcher',
  'scrollStory',
  'canvas',
] as const;

export type LessonType = (typeof ALL_LESSON_TYPES)[number];
