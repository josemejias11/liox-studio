'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import MotoViewer from '@/player/MotoViewer';
import type { NormalizedCourseContent } from '@/lib/course-content';

const PLAYER_WIDTH = 1440;
const PLAYER_HEIGHT = 810;

export function AuthoringPreview({
  content,
  selectedLessonId,
  fill = false,
}: {
  content: NormalizedCourseContent;
  selectedLessonId?: string;
  fill?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resize = ([entry]: ResizeObserverEntry[]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setScale(Math.min(width / PLAYER_WIDTH, height / PLAYER_HEIGHT));
    };

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className={`flex min-h-0 w-full items-center justify-center overflow-hidden ${
        fill ? 'h-full' : 'aspect-video'
      }`}
    >
      <div
        className="relative shrink-0 overflow-hidden rounded-xl border border-border bg-background"
        style={{
          width: PLAYER_WIDTH * scale,
          height: PLAYER_HEIGHT * scale,
        }}
      >
        <div
          className="absolute top-0 left-0"
          style={{
            width: PLAYER_WIDTH,
            height: PLAYER_HEIGHT,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        >
          <MotoViewer
            course={content.course}
            initialSectionKey={selectedLessonId}
            sections={content.sections}
            preview
          />
        </div>
      </div>
    </div>
  );
}
