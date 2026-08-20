import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { ProgressRequestBody } from '@/shared/contracts/api';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Progress request failed (${res.status})`);
  return res.json();
};

interface LessonData {
  visitedHotspots?: string[];
  completed?: boolean;
}

interface ProgressData {
  lessons?: Record<string, LessonData>;
}

const PREVIEW_PROGRESS_KEY_PREFIX = 'mototutor_preview_progress:';

function isProgressData(value: unknown): value is ProgressData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const lessons = (value as { lessons?: unknown }).lessons;
  if (lessons === undefined) return true;
  if (!lessons || typeof lessons !== 'object' || Array.isArray(lessons)) return false;

  return Object.values(lessons).every((lesson) => {
    if (!lesson || typeof lesson !== 'object' || Array.isArray(lesson)) return false;
    const data = lesson as LessonData;
    return (
      (data.visitedHotspots === undefined ||
        (Array.isArray(data.visitedHotspots) &&
          data.visitedHotspots.every((label) => typeof label === 'string'))) &&
      (data.completed === undefined || typeof data.completed === 'boolean')
    );
  });
}

function readPreviewProgress(storageKey?: string): ProgressData {
  if (!storageKey || typeof window === 'undefined') return {};

  try {
    const savedProgress = localStorage.getItem(storageKey);
    const parsedProgress: unknown = savedProgress ? JSON.parse(savedProgress) : undefined;
    return isProgressData(parsedProgress) ? parsedProgress : {};
  } catch {
    return {};
  }
}

export function useLessonProgress(sessionId: string, persist: boolean = true, courseId?: string) {
  const previewStorageKey =
    !persist && courseId ? `${PREVIEW_PROGRESS_KEY_PREFIX}${courseId}` : undefined;
  const [previewData, setPreviewData] = useState<ProgressData>(() =>
    readPreviewProgress(previewStorageKey),
  );

  const markLessonViewed = async (lessonId: string, courseId: string) => {
    if (!sessionId || !persist) return;
    const payload: ProgressRequestBody = { type: 'lesson', sessionId, lessonId, courseId };
    await fetch('/api/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {});
  };
  const { data, error, isLoading, mutate } = useSWR<ProgressData>(
    sessionId && persist ? `/api/progress?sessionId=${sessionId}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
    },
  );

  const progressData = useMemo<ProgressData>(
    () => (persist ? (data ?? {}) : previewData),
    [data, persist, previewData],
  );
  const visited = useMemo(() => {
    const restored: Record<string, Set<string>> = {};
    if (progressData.lessons) {
      for (const [sid, prog] of Object.entries(progressData.lessons)) {
        restored[sid] = new Set(prog.visitedHotspots ?? []);
      }
    }
    return restored;
  }, [progressData]);

  const markVisited = async (
    lessonKey: string,
    label: string,
    totalHotspots: number,
    completionRule?: (visited: Set<string>) => boolean,
  ) => {
    if (!sessionId) return;

    const currentLessonVisited = visited[lessonKey] ?? new Set<string>();
    if (currentLessonVisited.has(label)) return;

    const nextVisitedSet = new Set([...currentLessonVisited, label]);
    const isCompleted = completionRule
      ? completionRule(nextVisitedSet)
      : totalHotspots > 0 && nextVisitedSet.size >= totalHotspots;
    const visitedHotspots = Array.from(nextVisitedSet);

    const payload: ProgressRequestBody = {
      type: 'lesson',
      sessionId,
      lessonId: lessonKey,
      ...(courseId ? { courseId } : {}),
      visitedHotspots,
      completed: isCompleted,
    };

    const optimisticData: ProgressData = {
      ...progressData,
      lessons: {
        ...progressData.lessons,
        [lessonKey]: {
          visitedHotspots,
          completed: isCompleted,
        },
      },
    };

    if (!persist) {
      setPreviewData(optimisticData);
      if (previewStorageKey) {
        try {
          localStorage.setItem(previewStorageKey, JSON.stringify(optimisticData));
        } catch {
          // Keep preview progress for this mounted player when browser storage is unavailable.
        }
      }
      return;
    }

    await mutate(
      async () => {
        const res = await fetch('/api/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`Progress save failed (${res.status})`);
        return optimisticData;
      },
      {
        optimisticData,
        rollbackOnError: true,
        populateCache: true,
        revalidate: false,
      },
    ).catch((err: unknown) => {
      console.error('Failed to persist progress:', err);
    });
  };

  return {
    visited,
    markVisited,
    markLessonViewed,
    isLoading,
    error,
  };
}
