import React from 'react';
import dynamic from 'next/dynamic';
import type { LessonSection } from '@/lib/contracts/sanity';

const LoadingSkeleton = () =>
  React.createElement('div', { className: 'absolute inset-0 bg-background animate-pulse' });

export enum LessonCompletionMode {
  NONE = 'none',
  HOTSPOT = 'hotspot',
  MANUAL = 'manual',
}

type LessonType = LessonSection['lessonType'];

interface LessonTypeRegistryEntry {
  completionMode: LessonCompletionMode;
  requiresManualCompletion: boolean;
}

export const lessonTypeRegistry: Record<LessonType, LessonTypeRegistryEntry> = {
  content: {
    completionMode: LessonCompletionMode.HOTSPOT,
    requiresManualCompletion: false,
  },
  interaction: {
    completionMode: LessonCompletionMode.HOTSPOT,
    requiresManualCompletion: false,
  },
  stage: {
    completionMode: LessonCompletionMode.HOTSPOT,
    requiresManualCompletion: false,
  },
  video: {
    completionMode: LessonCompletionMode.MANUAL,
    requiresManualCompletion: true,
  },
  quiz: {
    completionMode: LessonCompletionMode.NONE,
    requiresManualCompletion: false,
  },
  colorSwitcher: {
    completionMode: LessonCompletionMode.NONE,
    requiresManualCompletion: false,
  },
  splitScreen: {
    completionMode: LessonCompletionMode.NONE,
    requiresManualCompletion: false,
  },
  dragDrop: {
    completionMode: LessonCompletionMode.MANUAL,
    requiresManualCompletion: true,
  },
  scrollStory: {
    completionMode: LessonCompletionMode.MANUAL,
    requiresManualCompletion: true,
  },
};

export function getLessonCompletionMode(
  lesson: Pick<LessonSection, 'lessonType'>,
): LessonCompletionMode {
  return lessonTypeRegistry[lesson.lessonType ?? 'content']?.completionMode ?? LessonCompletionMode.HOTSPOT;
}

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
