'use client';

import { useCallback, useMemo } from 'react';
import { getRequiredCanvasTargetCount, isCanvasComplete } from '@/lib/canvas';
import type { LessonSection, CourseHotspot } from '@/lib/contracts/course';
import { getCoveredFeatureLabels, isRefresherComplete } from '@/lib/refresher';
import { getLessonCompletionMode, LessonCompletionMode } from '../lesson-types/registry';

type CompletionRule = (visited: Set<string>) => boolean;

export type BaseMarkVisited = (
  lessonKey: string,
  label: string,
  totalHotspots: number,
  completionRule?: CompletionRule,
) => Promise<void>;

export interface LessonRuntime {
  currentLesson?: LessonSection;
  lessonKey: string;
  hotspots: CourseHotspot[];
  visitedLabels: Set<string>;
  completionMode: LessonCompletionMode;
  isSpecialComplete: boolean;
  completionHint?: string;
  visitedOnLesson: number;
  requiredCanvasTargets: number;
  visitedRequiredCanvasTargets: number;
  refresherFeatureCount: number;
  visitedRefresherFeatures: number;
  markVisited: (label: string) => void;
  baseMarkVisited: BaseMarkVisited;
}

interface UseLessonRuntimeOptions {
  currentLesson?: LessonSection;
  visited: Record<string, Set<string>>;
  baseMarkVisited: BaseMarkVisited;
  nextLocked: boolean;
}

const EMPTY_VISITED = new Set<string>();

export function useLessonRuntime({
  currentLesson,
  visited,
  baseMarkVisited,
  nextLocked,
}: UseLessonRuntimeOptions): LessonRuntime {
  const lessonKey = currentLesson?._key ?? '';
  const hotspots = useMemo(() => currentLesson?.hotspots ?? [], [currentLesson]);
  const visitedLabels = visited[lessonKey] ?? EMPTY_VISITED;
  const visitedOnLesson = visitedLabels.size;
  const completionMode = currentLesson
    ? getLessonCompletionMode(currentLesson)
    : LessonCompletionMode.NONE;
  const canvasLesson = currentLesson?.lessonType === 'canvas' ? currentLesson : undefined;
  const requiredCanvasTargets = currentLesson ? getRequiredCanvasTargetCount(currentLesson) : 0;
  const refresherFeatureLabels = currentLesson ? getCoveredFeatureLabels(currentLesson) : [];
  const refresherLesson =
    completionMode === LessonCompletionMode.MANUAL || refresherFeatureLabels.length === 0
      ? undefined
      : currentLesson;
  const visitedRefresherFeatures = refresherFeatureLabels.filter((label) =>
    visitedLabels.has(label),
  ).length;
  const visitedRequiredCanvasTargets = canvasLesson
    ? [...visitedLabels].filter((label) =>
        canvasLesson.hotspots?.some((target) => target.required && target.label === label),
      ).length
    : 0;
  const isSpecialComplete =
    completionMode === LessonCompletionMode.MANUAL && visitedLabels.has('completed');

  const markVisited = useCallback(
    (label: string) => {
      const totalRequired = refresherLesson
        ? refresherFeatureLabels.length
        : completionMode === LessonCompletionMode.MANUAL
          ? 1
          : hotspots.length;
      const completionRule =
        completionMode === LessonCompletionMode.MANUAL
          ? (nextVisited: Set<string>) => nextVisited.has('completed')
          : refresherLesson
            ? (nextVisited: Set<string>) => isRefresherComplete(refresherLesson, nextVisited)
            : canvasLesson
              ? (nextVisited: Set<string>) => isCanvasComplete(canvasLesson, nextVisited)
              : undefined;

      void baseMarkVisited(lessonKey, label, totalRequired, completionRule);
    },
    [
      baseMarkVisited,
      canvasLesson,
      completionMode,
      hotspots.length,
      lessonKey,
      refresherFeatureLabels.length,
      refresherLesson,
    ],
  );

  const completionHint = !nextLocked
    ? undefined
    : refresherLesson
      ? `Complete Quick Recall (${visitedRefresherFeatures} / ${refresherFeatureLabels.length})`
      : canvasLesson && requiredCanvasTargets > 0
        ? `Explore all required features (${visitedRequiredCanvasTargets} / ${requiredCanvasTargets})`
        : hotspots.length > 0
          ? `Tap all ${hotspots.length} features to continue (${visitedOnLesson} / ${hotspots.length})`
          : undefined;

  return {
    currentLesson,
    lessonKey,
    hotspots,
    visitedLabels,
    completionMode,
    isSpecialComplete,
    completionHint,
    visitedOnLesson,
    requiredCanvasTargets,
    visitedRequiredCanvasTargets,
    refresherFeatureCount: refresherFeatureLabels.length,
    visitedRefresherFeatures,
    markVisited,
    baseMarkVisited,
  };
}
