import dynamic from 'next/dynamic';

export const ContentLessonDynamic = dynamic(() =>
  import('./ContentLesson').then((m) => ({ default: m.ContentLesson })),
);
export const ProductStageDynamic = dynamic(() =>
  import('./ProductStage').then((m) => ({ default: m.ProductStage })),
);
export const VideoLessonDynamic = dynamic(() =>
  import('./VideoLesson').then((m) => ({ default: m.VideoLesson })),
);
export const QuizLessonDynamic = dynamic(() =>
  import('./QuizLesson').then((m) => ({ default: m.QuizLesson })),
);
export const ColorSwitcherLessonDynamic = dynamic(() =>
  import('./ColorSwitcherLesson').then((m) => ({ default: m.ColorSwitcherLesson })),
);
export const SplitScreenLessonDynamic = dynamic(() =>
  import('./SplitScreenLesson').then((m) => ({ default: m.SplitScreenLesson })),
);
export const DragDropLessonDynamic = dynamic(() => import('./DragDropLesson'));
export const ScrollStoryLessonDynamic = dynamic(() => import('./ScrollStoryLesson'));
