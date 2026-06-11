import { useMemo } from 'react';
import useSWR from 'swr';
import { ProgressRequestBody } from '@/lib/contracts/progress';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface LessonData {
  visitedHotspots?: string[];
  completed?: boolean;
}

interface ProgressData {
  lessons?: Record<string, LessonData>;
}

/**
 * @param sessionId Browser session id (persisted UUID, or an ephemeral one
 *                  when storage consent is declined/undecided).
 * @param persist   When false (no consent), progress is kept only in the local
 *                  SWR cache — no POSTs are sent, so nothing is recorded
 *                  server-side or on the device.
 */
export function useLessonProgress(sessionId: string, persist: boolean = true) {
  const { data, error, isLoading, mutate } = useSWR<ProgressData>(
    sessionId ? `/api/progress?sessionId=${sessionId}` : null,
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

  const markVisited = async (lessonKey: string, label: string, totalHotspots: number) => {
    if (!sessionId) return;

    const currentLessonVisited = visited[lessonKey] ?? new Set<string>();
    if (currentLessonVisited.has(label)) return;

    const nextVisitedSet = new Set([...currentLessonVisited, label]);
    const isCompleted = totalHotspots > 0 && nextVisitedSet.size >= totalHotspots;
    const visitedHotspots = Array.from(nextVisitedSet);

    const payload: ProgressRequestBody = {
      type: 'lesson',
      sessionId,
      lessonId: lessonKey,
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

    // Optimistically update the SWR cache; only POST when consent allows
    // persistence (otherwise progress lives solely in this tab's memory).
    mutate(
      persist
        ? async () => {
            await fetch('/api/progress', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
            return optimisticData;
          }
        : optimisticData,
      {
        optimisticData,
        rollbackOnError: true,
        populateCache: true,
        revalidate: false,
      },
    );
  };

  return {
    visited,
    markVisited,
    isLoading,
    error,
  };
}
