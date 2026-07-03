'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CoursePhase } from './useCourseNavigation';
import type { CourseStructure } from '@/lib/course-structure';

const MAX_SESSION_WEAK_TOPICS = 10;
const MAX_MERGED_WEAK_TOPICS = 15;

export interface UseWeakTopicsArgs {
  phase: CoursePhase;
  structure: CourseStructure;
  visited: Record<string, Set<string>>;
  courseId: string;
  currentLessonType?: string;
}

export interface UseWeakTopicsResult {
  topics: string[];
  isLoading: boolean;
}

export function deriveSessionWeakTopics(
  lessonSections: CourseStructure['lessonSections'],
  visited: Record<string, Set<string>>,
): string[] {
  const topics = new Set<string>();

  for (const section of lessonSections) {
    for (const hotspot of section.hotspots ?? []) {
      const topic = (hotspot.topic || hotspot.label).trim();
      if (topic && !visited[section._key]?.has(hotspot.label)) {
        topics.add(topic);
      }
    }
  }

  return Array.from(topics).slice(0, MAX_SESSION_WEAK_TOPICS);
}

export function mergeWeakTopics(
  isQuizPhase: boolean,
  sessionWeakTopics: string[],
  apiWeakTopics: string[],
): string[] {
  if (!isQuizPhase) return [];
  return Array.from(new Set([...sessionWeakTopics, ...apiWeakTopics])).slice(0, MAX_MERGED_WEAK_TOPICS);
}

export function useWeakTopics({
  phase,
  structure,
  visited,
  courseId,
  currentLessonType,
}: UseWeakTopicsArgs): UseWeakTopicsResult {
  const [apiWeakTopics, setApiWeakTopics] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const sessionWeakTopics = useMemo(
    () => deriveSessionWeakTopics(structure.lessonSections, visited),
    [structure.lessonSections, visited],
  );

  const isQuizPhase =
    phase.phase === 'quiz' ||
    phase.phase === 'chapter-quiz' ||
    (phase.phase === 'chapter' && currentLessonType === 'quiz');

  const topics = useMemo(
    () => mergeWeakTopics(isQuizPhase, sessionWeakTopics, apiWeakTopics),
    [apiWeakTopics, isQuizPhase, sessionWeakTopics],
  );

  useEffect(() => {
    if (!isQuizPhase) return;

    const lessonMeta = structure.lessonSections.map((section) => ({
      id: section._key,
      headline: section.headline,
      topics: [
        ...(section.hotspots ?? []).map((hotspot) => hotspot.topic || hotspot.label).filter(Boolean),
        section.headline,
      ],
    }));

    setIsLoading(true);
    fetch('/api/analytics/weak-topics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId, lessons: lessonMeta }),
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!data?.weakTopics?.length) return;
        setApiWeakTopics(data.weakTopics);
      })
      .catch((error) => {
        console.warn('[useWeakTopics] Failed to fetch weak topics:', error instanceof Error ? error.message : error);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [courseId, isQuizPhase, structure.lessonSections]);

  return { topics, isLoading };
}
