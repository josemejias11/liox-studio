'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import MotoViewer from '@/learning/player/MotoViewer';
import type { NormalizedCourseContent } from '@/learning/course-content';
import type { RevisionIdentity } from '@/shared/contracts/api';
import type { OfflineAssistantPayload } from '@lb-studio/contracts';

const PLAYER_WIDTH = 1440;
const PLAYER_HEIGHT = 810;

export function PlayerViewport({
  content,
  selectedLessonId,
  fill = false,
  persistProgress = false,
  aiIdentity,
  assistant,
  onAssistantAnswer,
  onLessonChange,
  initialView,
  bypassNavigationLocks = false,
  skipChapterIntroForInitialSection = true,
}: {
  content: NormalizedCourseContent;
  selectedLessonId?: string;
  fill?: boolean;
  persistProgress?: boolean;
  aiIdentity?: RevisionIdentity;
  assistant?: OfflineAssistantPayload;
  onAssistantAnswer?: (context: {
    question: string;
    matchedQaId: string | null;
    answer: string;
  }) => void;
  onLessonChange?: (lessonId: string) => void;
  initialView?: 'cover';
  bypassNavigationLocks?: boolean;
  skipChapterIntroForInitialSection?: boolean;
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

  const imageSizes = scale > 0 ? `${Math.ceil(PLAYER_WIDTH * scale)}px` : '100vw';

  return (
    <div
      ref={containerRef}
      className={`flex min-h-0 w-full items-center justify-center overflow-hidden ${
        fill ? 'h-full' : 'aspect-video'
      }`}
    >
      <div
        className="border-border bg-background relative shrink-0 overflow-hidden rounded-xl border"
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
            preview={!persistProgress}
            aiIdentity={aiIdentity}
            assistant={assistant}
            onAssistantAnswer={onAssistantAnswer}
            onLessonChange={onLessonChange}
            initialView={initialView}
            bypassNavigationLocks={bypassNavigationLocks}
            imageSizes={imageSizes}
            skipChapterIntroForInitialSection={skipChapterIntroForInitialSection}
          />
        </div>
      </div>
    </div>
  );
}
