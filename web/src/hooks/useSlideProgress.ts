import { useEffect, useState } from "react";
import useSWR from "swr";
import { ProgressRequestBody } from "@/lib/contracts/progress";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useSlideProgress(sessionId: string) {
  const [visited, setVisited] = useState<Record<string, Set<string>>>({});
  
  const { data, error, isLoading, mutate } = useSWR(
    sessionId ? `/api/progress?sessionId=${sessionId}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
    }
  );

  useEffect(() => {
    if (data?.slides) {
      const restored: Record<string, Set<string>> = {};
      for (const [sid, prog] of Object.entries(data.slides)) {
        restored[sid] = new Set((prog as any).visitedHotspots);
      }
      setVisited(restored);
    }
  }, [data]);

  const markVisited = async (slideKey: string, label: string, totalHotspots: number) => {
    setVisited((prev) => {
      const next = new Set([...(prev[slideKey] ?? []), label]);
      const isCompleted = totalHotspots > 0 && next.size >= totalHotspots;
      
      if (sessionId) {
        const payload: ProgressRequestBody = {
          type: "slide",
          sessionId,
          slideId: slideKey,
          visitedHotspots: Array.from(next),
          completed: isCompleted,
        };

        fetch("/api/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }).catch(() => {});
        
        // Optimistically mutate local SWR cache
        mutate((currentData: any) => {
          if (!currentData) return currentData;
          return {
            ...currentData,
            slides: {
              ...currentData.slides,
              [slideKey]: {
                visitedHotspots: Array.from(next),
                completed: isCompleted,
              }
            }
          };
        }, false);
      }
      return { ...prev, [slideKey]: next };
    });
  };

  return {
    visited,
    markVisited,
    isLoading,
    error,
  };
}
