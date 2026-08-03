'use client';

import { CompletionBurst } from './CompletionBurst';
import { CourseAIFab } from './CourseAIFab';
import type { CourseFlow } from '@/learning/course-flow';
import type { LessonSection } from '@/shared/contracts/player-course';
import type { RevisionIdentity } from '@/shared/contracts/api';
import type { CoursePhase } from './hooks/useCourseNavigation';
import { NavMap } from './NavMap';

interface PlayerOverlaysProps {
  flow: CourseFlow;
  phase: CoursePhase;
  currentLesson?: LessonSection;
  currentSectionIndex: number;
  visited: Record<string, Set<string>>;
  courseId: string;
  showNavMap: boolean;
  showBurst: boolean;
  progressError: unknown;
  persistSession: boolean;
  allowAssistant: boolean;
  aiIdentity?: RevisionIdentity;
  onNavigate: (index: number) => void;
  onCloseNavMap: () => void;
}

export function PlayerOverlays({
  flow,
  phase,
  currentLesson,
  currentSectionIndex,
  visited,
  courseId,
  showNavMap,
  showBurst,
  progressError,
  persistSession,
  allowAssistant,
  aiIdentity,
  onNavigate,
  onCloseNavMap,
}: PlayerOverlaysProps) {
  const showAssistant =
    phase.phase !== 'cover' &&
    phase.phase !== 'quiz' &&
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

      {allowAssistant && aiIdentity && showAssistant && (
        <CourseAIFab courseId={courseId} {...aiIdentity} />
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
