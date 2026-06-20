import React from 'react';
import dynamic from 'next/dynamic';

const LoadingSkeleton = () =>
  React.createElement('div', { className: 'absolute inset-0 bg-background animate-pulse' });

export const ContentLessonDynamic = dynamic(
  () => import('./ContentLesson').then((m) => ({ default: m.ContentLesson })),
  { loading: LoadingSkeleton },
);
export const ProductStageDynamic = dynamic(
  () => import('./ProductStage').then((m) => ({ default: m.ProductStage })),
  { loading: LoadingSkeleton },
);
export const VideoLessonDynamic = dynamic(
  () => import('./VideoLesson').then((m) => ({ default: m.VideoLesson })),
  { loading: LoadingSkeleton },
);
export const QuizLessonDynamic = dynamic(
  () => import('./QuizLesson').then((m) => ({ default: m.QuizLesson })),
  { loading: LoadingSkeleton },
);
export const ColorSwitcherLessonDynamic = dynamic(
  () => import('./ColorSwitcherLesson').then((m) => ({ default: m.ColorSwitcherLesson })),
  { loading: LoadingSkeleton },
);
export const SplitScreenLessonDynamic = dynamic(
  () => import('./SplitScreenLesson').then((m) => ({ default: m.SplitScreenLesson })),
  { loading: LoadingSkeleton },
);
export const DragDropLessonDynamic = dynamic(() => import('./DragDropLesson'), {
  loading: LoadingSkeleton,
});
export const ScrollStoryLessonDynamic = dynamic(() => import('./ScrollStoryLesson'), {
  loading: LoadingSkeleton,
});
