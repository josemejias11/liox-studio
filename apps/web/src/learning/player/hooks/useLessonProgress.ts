import { useMemo } from 'react';
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


export function useLessonProgress(
  sessionId: string,
  persist: boolean = true,
  courseId?: string,
) {
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

  const visited = useMemo(() => {
    const restored: Record<string, Set<string>> = {};
    if (data?.lessons) {
      for (const [sid, prog] of Object.entries(data.lessons)) {
        restored[sid] = new Set(prog.visitedHotspots ?? []);
      }
    }
    return restored;
  }, [data]);

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
      ...data,
      lessons: {
        ...data?.lessons,
        [lessonKey]: {
          visitedHotspots,
          completed: isCompleted,
        },
      },
    };
    await mutate(
      persist
        ? async () => {
            const res = await fetch('/api/progress', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error(`Progress save failed (${res.status})`);
            return optimisticData;
          }
        : optimisticData,
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
