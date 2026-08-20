'use client';

import type { LessonSection, CourseHotspot } from '@/shared/contracts/player-course';
import type { RevisionIdentity } from '@/shared/contracts/api';
import { RefresherFeaturePanel } from './RefresherFeaturePanel';
import { renderLesson } from './lesson-types/registry';

export interface LessonRendererProps {
  lesson: LessonSection;
  lessonKey: string;
  hotspots: CourseHotspot[];
  visited: Set<string>;
  isSpecialComplete: boolean;
  goNext: () => void;
  goPrev: () => void;
  markVisited: (label: string) => void;
  baseMarkVisited: (key: string, label: string, total: number) => Promise<void>;
  sessionId: string;
  persistSession: boolean;
  courseId: string;
  preview: boolean;
  imageSizes: string;
  aiIdentity?: RevisionIdentity;
}

export function LessonRenderer({
  lesson,
  lessonKey,
  hotspots,
  visited,
  isSpecialComplete,
  goNext,
  goPrev,
  markVisited,
  baseMarkVisited,
  sessionId,
  persistSession,
  courseId,
  preview,
  imageSizes,
  aiIdentity,
}: LessonRendererProps) {
  const lessonContent = renderLesson({
    lesson,
    lessonKey,
    hotspots,
    visited,
    isSpecialComplete,
    goNext,
    goPrev,
    markVisited,
    baseMarkVisited,
    sessionId,
    persistSession,
    courseId,
    preview,
    imageSizes,
    aiIdentity,
  });

  return (
    <>
      {lessonContent}
      <RefresherFeaturePanel lesson={lesson} visitedLabels={visited} onVisit={markVisited} />
    </>
  );
}
