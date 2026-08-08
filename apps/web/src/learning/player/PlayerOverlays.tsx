'use client';

import { CompletionBurst } from './CompletionBurst';
import { CourseAssistant } from './CourseAssistant';
import type { CourseFlow } from '@/learning/course-flow';
import type { LessonSection } from '@/shared/contracts/player-course';
import type { OfflineAssistantPayload } from '@moto-ai/contracts';
import type { CoursePhase } from './hooks/useCourseNavigation';
import { NavMap } from './NavMap';

interface PlayerOverlaysProps {
  flow: CourseFlow;
  phase: CoursePhase;
  currentLesson?: LessonSection;
  currentSectionIndex: number;
  visited: Record<string, Set<string>>;
  showNavMap: boolean;
  showBurst: boolean;
  progressError: unknown;
  persistSession: boolean;
  assistant?: OfflineAssistantPayload;
  onAssistantAnswer?: (context: { question: string; matchedQaId: string | null; answer: string }) => void;
  onNavigate: (index: number) => void;
  onCloseNavMap: () => void;
}

export function PlayerOverlays({
  flow,
  phase,
  currentLesson,
  currentSectionIndex,
  visited,
  showNavMap,
  showBurst,
  progressError,
  persistSession,
  assistant,
  onAssistantAnswer,
  onNavigate,
  onCloseNavMap,
}: PlayerOverlaysProps) {
  const showAssistant =
    phase.phase !== 'cover' &&
    phase.phase !== 'chapter-quiz' &&
    currentLesson?.lessonType !== 'quiz';

  return (
    <>
      {showNavMap && (
        <NavMap
          flow={flow}
          currentSectionIndex={currentSectionIndex}
          visited={visited}
          onNavigate={onNavigate}
          onClose={onCloseNavMap}
        />
      )}

      {assistant && showAssistant && (
        <CourseAssistant payload={assistant} onAnswer={onAssistantAnswer} />
      )}

      {progressError && persistSession && (
        <div
          role="status"
          className="bg-card/90 text-muted-foreground border-border/20 fixed bottom-4 left-4 z-50 rounded-full border px-4 py-2 text-xs shadow-lg backdrop-blur-sm"
        >
          Progress sync is unavailable — your progress may not be saved.
        </div>
      )}

      <CompletionBurst active={showBurst} />
    </>
  );
}
