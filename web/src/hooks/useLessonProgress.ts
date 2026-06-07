import { useEffect, useState } from "react";
import useSWR from "swr";
import { ProgressRequestBody } from "@/lib/contracts/progress";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface LessonData {
  visitedHotspots?: string[];
  completed?: boolean;
}

interface ProgressData {
  lessons?: Record<string, LessonData>;
}

export function useLessonProgress(sessionId: string) {
  const [visited, setVisited] = useState<Record<string, Set<string>>>({});
  
  const { data, error, isLoading, mutate } = useSWR<ProgressData>(
    sessionId ? `/api/progress?sessionId=${sessionId}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
    }
  );

  useEffect(() => {
    if (data?.lessons) {
      const restored: Record<string, Set<string>> = {};
      for (const [sid, prog] of Object.entries(data.lessons)) {
        restored[sid] = new Set(prog.visitedHotspots ?? []);
      }
      setVisited(restored);
    }
  }, [data]);

  const markVisited = async (lessonKey: string, label: string, totalHotspots: number) => {
    const currentLessonVisited = visited[lessonKey] ?? new Set<string>();
    const nextVisitedSet = new Set([...currentLessonVisited, label]);
    const isCompleted = totalHotspots > 0 && nextVisitedSet.size >= totalHotspots;
    
    // Update local React state
    setVisited((prev) => ({ ...prev, [lessonKey]: nextVisitedSet }));

    // Perform side effects outside of the setState updater
    if (sessionId) {
      const visitedHotspots = Array.from(nextVisitedSet);
      
      const payload: ProgressRequestBody = {
        type: "lesson",
        sessionId,
        lessonId: lessonKey,
        visitedHotspots,
        completed: isCompleted,
      };

      fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(() => {});
      
      // Optimistically mutate local SWR cache
      mutate((currentData?: ProgressData) => {
        if (!currentData) return currentData;
        return {
          ...currentData,
          lessons: {
            ...currentData.lessons,
            [lessonKey]: {
              visitedHotspots,
              completed: isCompleted,
            }
          }
        };
      }, false);
    }
  };

  return {
    visited,
    markVisited,
    isLoading,
    error,
  };
}
