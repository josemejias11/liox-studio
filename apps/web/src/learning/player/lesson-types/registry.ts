import React from 'react';
import dynamic from 'next/dynamic';
import { CourseQuiz } from './CourseQuiz';
import type { RevisionIdentity } from '@/shared/contracts/api';
import type { CourseHotspot, LessonSection } from '@/shared/contracts/player-course';

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
  render: (input: LessonRenderInput) => React.ReactNode;
}

export interface LessonRenderInput {
  lesson: LessonSection;
  lessonKey: string;
  hotspots: CourseHotspot[];
  visited: Set<string>;
  isSpecialComplete: boolean;
  goNext: () => void;
  goPrev: () => void;
  markVisited: (label: string) => void;
  baseMarkVisited: (key: string, label: string, total: number) => Promise<void>;
  weakTopics: string[];
  sessionId: string;
  persistSession: boolean;
  courseId: string;
  preview: boolean;
  imageSizes: string;
  aiIdentity?: RevisionIdentity;
}

export const lessonTypeRegistry: Record<LessonType, LessonTypeRegistryEntry> = {
  content: {
    completionMode: LessonCompletionMode.HOTSPOT,
    requiresManualCompletion: false,
    render: ({ lesson, hotspots, visited, markVisited, courseId, preview, imageSizes }) =>
      React.createElement(ContentLessonDynamic, {
        lesson,
        hotspots,
        visitedLabels: visited,
        onVisit: markVisited,
        courseId,
        preview,
        imageSizes,
      }),
  },
  interaction: {
    completionMode: LessonCompletionMode.HOTSPOT,
    requiresManualCompletion: false,
    render: ({ lesson, hotspots, visited, markVisited, courseId, preview, imageSizes }) =>
      React.createElement(ContentLessonDynamic, {
        lesson,
        hotspots,
        visitedLabels: visited,
        onVisit: markVisited,
        courseId,
        preview,
        imageSizes,
      }),
  },
  stage: {
    completionMode: LessonCompletionMode.HOTSPOT,
    requiresManualCompletion: false,
    render: ({ lesson, hotspots, visited, markVisited, goNext, goPrev, courseId, preview, imageSizes }) =>
      React.createElement(ProductStageDynamic, {
        headline: lesson.headline,
        body: lesson.body,
        productImage: lesson.media?.asset?.url,
        stageBackground: lesson.stageBackground?.asset?.url,
        enableCompletionAnimation: lesson.enableCompletionAnimation,
        completionTransition: lesson.completionTransition,
        hotspots,
        visited,
        onVisit: markVisited,
        onNext: goNext,
        onPrev: goPrev,
        courseId,
        preview,
        imageSizes,
      }),
  },
  video: {
    completionMode: LessonCompletionMode.MANUAL,
    requiresManualCompletion: true,
    render: ({ lesson, lessonKey, baseMarkVisited }) =>
      React.createElement(VideoLessonDynamic, {
        headline: lesson.headline,
        videoFileUrl: lesson.videoFile?.asset?.url,
        videoAspectRatio: lesson.videoAspectRatio,
        onComplete: () => baseMarkVisited(lessonKey, 'completed', 1),
      }),
  },
  quiz: {
    completionMode: LessonCompletionMode.NONE,
    requiresManualCompletion: false,
    render: ({ aiIdentity, weakTopics, goNext, persistSession, sessionId, courseId, preview }) =>
      React.createElement(
        'div',
        {
          className:
            'absolute inset-0 flex items-center justify-center overflow-y-auto bg-[#111225] p-6',
        },
        React.createElement('div', {
          className:
            'pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(104,91,199,0.42),transparent_42%)]',
        }),
        React.createElement(
          'div',
          {
            className:
              'relative w-full max-w-2xl rounded-[2rem] border border-white/12 bg-white/96 p-4 shadow-[0_32px_90px_rgba(0,0,0,0.42)] md:p-8',
          },
          React.createElement(
            'p',
            {
              className:
                'mb-5 text-center text-xs font-semibold tracking-[0.22em] text-[#685bc7] uppercase',
            },
            'Practice challenge',
          ),
          React.createElement(CourseQuiz, {
            ...aiIdentity,
            weakTopics,
            onPass: goNext,
            onFail: goNext,
            sessionId: persistSession ? sessionId : undefined,
            courseId,
            preview,
          }),
        ),
      ),
  },
  colorSwitcher: {
    completionMode: LessonCompletionMode.NONE,
    requiresManualCompletion: false,
    render: ({ lesson, imageSizes }) =>
      React.createElement(ColorSwitcherLessonDynamic, { imageSizes, lesson }),
  },
  splitScreen: {
    completionMode: LessonCompletionMode.NONE,
    requiresManualCompletion: false,
    render: ({ lesson, visited, markVisited }) =>
      React.createElement(SplitScreenLessonDynamic, {
        lesson,
        visitedLabels: visited,
        onVisit: markVisited,
      }),
  },
  dragDrop: {
    completionMode: LessonCompletionMode.MANUAL,
    requiresManualCompletion: true,
    render: ({ lesson, lessonKey, isSpecialComplete, baseMarkVisited }) =>
      React.createElement(DragDropLessonDynamic, {
        lesson,
        isCompleted: isSpecialComplete,
        onComplete: () => baseMarkVisited(lessonKey, 'completed', 1),
      }),
  },
  scrollStory: {
    completionMode: LessonCompletionMode.MANUAL,
    requiresManualCompletion: true,
    render: ({ lesson, lessonKey, isSpecialComplete, baseMarkVisited, visited, markVisited }) =>
      React.createElement(ScrollStoryLessonDynamic, {
        lesson,
        isCompleted: isSpecialComplete,
        onComplete: () => baseMarkVisited(lessonKey, 'completed', 1),
        visitedLabels: visited,
        onVisit: markVisited,
      }),
  },
  canvas: {
    completionMode: LessonCompletionMode.HOTSPOT,
    requiresManualCompletion: false,
    render: ({ lesson, visited, markVisited, courseId, preview, imageSizes }) =>
      React.createElement(CanvasInspectionLessonDynamic, {
        lesson,
        visitedLabels: visited,
        onVisit: markVisited,
        courseId,
        preview,
        imageSizes,
      }),
  },
};

export function getLessonCompletionMode(
  lesson: Pick<LessonSection, 'lessonType'>,
): LessonCompletionMode {
  return lessonTypeRegistry[lesson.lessonType ?? 'content']?.completionMode ?? LessonCompletionMode.HOTSPOT;
}

/** The registry is the only lesson-type-to-renderer mapping in the learner runtime. */
export function renderLesson(input: LessonRenderInput): React.ReactNode {
  const lessonType = input.lesson.lessonType;
  const entry = lessonTypeRegistry[lessonType] ?? lessonTypeRegistry.content;
  return entry.render(input);
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
export const CanvasInspectionLessonDynamic = dynamic(
  () => import('./CanvasInspectionLesson').then((m) => ({ default: m.CanvasInspectionLesson })),
  { loading: LoadingSkeleton },
);
