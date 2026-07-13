'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LessonFrame } from './LessonFrame';
import { NavMap } from './NavMap';
import { CompletionBurst } from '@/components/CompletionBurst';
import { CourseAIFab } from '@/components/CourseAIFab';
import { getLessonCompletionMode, LessonCompletionMode } from './lesson-types/registry';
import { getRequiredCanvasTargetCount, isCanvasComplete } from '@/lib/canvas';
import { getCoveredFeatureLabels, isRefresherComplete } from '@/lib/refresher';
import { useLessonProgress } from './hooks/useLessonProgress';
import { useCourseNavigation } from './hooks/useCourseNavigation';
import { getChapterLessons } from '@/lib/course-structure';
import { deriveCourseFlow } from '@/lib/course-flow';
import type { CourseSection, SanityCourse } from '@/lib/contracts/sanity';
import { useCourseSession } from './hooks/useCourseSession';
import { useWeakTopics } from './hooks/useWeakTopics';
import { CoursePhaseScreen, getCoursePhaseSlideKey } from './CoursePhaseScreen';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// ── Framer Motion slide variants ─────────────────────────────────────────────

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 24 : -24,
    opacity: 0,
    scale: 0.98,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
    transition: { duration: 0.32, ease: [0.34, 1.15, 0.64, 1] as [number, number, number, number] },
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 24 : -24,
    opacity: 0,
    scale: 0.98,
    transition: { duration: 0.18, ease: [0.32, 0.72, 0, 1] as [number, number, number, number] },
  }),
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function MotoViewer({
  course,
  sections,
}: {
  course: SanityCourse;
  sections: CourseSection[];
}) {
  const flow = useMemo(
    () => deriveCourseFlow(sections, course.chapters ?? []),
    [sections, course.chapters],
  );
  const structure = flow.structure;

  const [showNavMap, setShowNavMap] = useState(false);

  // ── Session ───────────────────────────────────────────────────────────────
  const { sessionId, persistSession } = useCourseSession();

  const {
    visited,
    markVisited: baseMarkVisited,
    markLessonViewed,
    error: progressError,
  } = useLessonProgress(sessionId, persistSession);

  const nav = useCourseNavigation(flow, visited);
  const { phase, navDirection, showChapterIntro, showBurst, nextLocked } = nav;

  // ── Current lesson (chapter phase only) ───────────────────────────────────
  const currentLesson =
    phase.phase === 'chapter'
      ? getChapterLessons(structure, phase.chapterIndex)[phase.lessonIndex]
      : undefined;
  const lessonKey = currentLesson?._key ?? '';
  const hotspots = useMemo(() => currentLesson?.hotspots ?? [], [currentLesson]);
  const visitedOnLesson = visited[lessonKey]?.size ?? 0;
  const completionMode = currentLesson
    ? getLessonCompletionMode(currentLesson)
    : LessonCompletionMode.NONE;
  const requiredCanvasTargets = currentLesson ? getRequiredCanvasTargetCount(currentLesson) : 0;
  const canvasLesson = currentLesson?.lessonType === 'canvas' ? currentLesson : undefined;
  const refresherFeatureLabels = currentLesson ? getCoveredFeatureLabels(currentLesson) : [];
  const refresherLesson = refresherFeatureLabels.length > 0 ? currentLesson : undefined;
  const visitedRefresherFeatures = refresherLesson
    ? refresherFeatureLabels.filter((label) => visited[lessonKey]?.has(label)).length
    : 0;
  const visitedRequiredCanvasTargets = canvasLesson
    ? [...(visited[lessonKey] ?? [])].filter((label) =>
        canvasLesson.hotspots?.some((target) => target.required && target.label === label),
      ).length
    : 0;

  const requiresManualCompletion = completionMode === LessonCompletionMode.MANUAL;
  const isSpecialComplete = requiresManualCompletion && visited[lessonKey]?.has('completed');

  const markVisited = (label: string) =>
    baseMarkVisited(
      lessonKey,
      label,
      refresherLesson ? refresherFeatureLabels.length : completionMode === LessonCompletionMode.MANUAL ? 1 : hotspots.length,
      refresherLesson
        ? (nextVisited) => isRefresherComplete(refresherLesson, nextVisited)
        : canvasLesson
        ? (nextVisited) => isCanvasComplete(canvasLesson, nextVisited)
        : undefined,
    );

  // ── Navigation wrappers ───────────────────────────────────────────────────
  const goNext = nav.goNext;
  const goPrev = nav.goPrev;

  function navigateToSection(i: number) {
    setShowNavMap(false);
    nav.navigateToSection(i);
  }

  // ── Completion stats ──────────────────────────────────────────────────────
  const totalHotspotsVisited = Object.values(visited).reduce((sum, s) => sum + s.size, 0);
  const totalHotspots = structure.lessonSections.reduce(
    (sum, s) => sum + (s.hotspots?.length ?? 0),
    0,
  );

  // ── Lesson view tracking ──────────────────────────────────────────────────
  useEffect(() => {
    if (!lessonKey || phase.phase !== 'chapter' || showChapterIntro) return;
    markLessonViewed(lessonKey, course._id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonKey]);

  // ── Weak topics for AI quiz generation ───────────────────────────────────
  const [disclaimerCanProceed, setDisclaimerCanProceed] = useState(true);
  const { topics: weakTopics } = useWeakTopics({
    phase,
    structure,
    visited,
    courseId: course._id,
    currentLessonType: currentLesson?.lessonType,
  });

  const slideKey = getCoursePhaseSlideKey({ phase, currentLesson, showChapterIntro });

  // ── LessonFrame props vary by phase ───────────────────────────────────────
  const isContentLesson =
    phase.phase === 'chapter' &&
    !showChapterIntro &&
    currentLesson !== undefined &&
    currentLesson.lessonType !== 'quiz';

  const frameProps =
    phase.phase === 'cover'
      ? { moduleTitle: course.title }
      : isContentLesson
        ? {
            currentLesson: nav.currentSectionIndex >= 0 ? nav.currentSectionIndex + 1 : 1,
            totalLessons: structure.totalSections,
            onPrev: goPrev,
            onNext: goNext,
            nextDisabled: nextLocked,
            onToggleNavMap: () => setShowNavMap((v) => !v),
            moduleTitle: course.title,
            completionHint:
              nextLocked && refresherLesson
                ? `Review every feature (${visitedRefresherFeatures} / ${refresherFeatureLabels.length})`
                : nextLocked && canvasLesson && requiredCanvasTargets > 0
                ? `Explore all required features (${visitedRequiredCanvasTargets} / ${requiredCanvasTargets})`
                : nextLocked && hotspots.length > 0
                ? `Tap all ${hotspots.length} features to continue (${visitedOnLesson} / ${hotspots.length})`
                : undefined,
          }
        : phase.phase === 'disclaimer'
          ? {
              sectionType: 'disclaimer' as const,
              onNext: goNext,
              nextDisabled: !disclaimerCanProceed,
              onToggleNavMap: () => setShowNavMap((v) => !v),
              moduleTitle: course.title,
            }
          : phase.phase === 'specifications'
          ? {
              sectionType: 'specification' as const,
              onPrev: goPrev,
              onNext: goNext,
              onToggleNavMap: () => setShowNavMap((v) => !v),
              moduleTitle: course.title,
            }
          : { onToggleNavMap: () => setShowNavMap((v) => !v), moduleTitle: course.title };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <LessonFrame {...frameProps}>
      <AnimatePresence mode="wait" custom={navDirection}>
        <motion.div
          key={slideKey}
          custom={navDirection}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          className="absolute inset-0"
        >
          <ErrorBoundary
            fallback={
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <h2 className="text-lg font-semibold text-red-600">Failed to load course content</h2>
                <p className="mt-2 text-sm text-gray-600">
                  Please try refreshing the page or contact support if the issue persists.
                </p>
                <button
                  className="mt-4 rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
                  onClick={() => window.location.reload()}
                >
                  Refresh page
                </button>
              </div>
            }
          >
            <CoursePhaseScreen
              phase={phase}
              course={course}
              structure={structure}
              currentLesson={currentLesson}
              lessonKey={lessonKey}
              hotspots={hotspots}
              visitedLesson={visited[lessonKey] ?? new Set()}
              isSpecialComplete={isSpecialComplete ?? false}
              weakTopics={weakTopics}
              sessionId={sessionId}
              persistSession={persistSession}
              showChapterIntro={showChapterIntro}
              totalHotspotsVisited={totalHotspotsVisited}
              totalHotspots={totalHotspots}
              goNext={goNext}
              goPrev={goPrev}
              finishQuiz={nav.finishQuiz}
              finishChapterQuiz={nav.finishChapterQuiz}
              dismissChapterIntro={nav.dismissChapterIntro}
              markVisited={markVisited}
              baseMarkVisited={baseMarkVisited}
              onDisclaimerCanProceedChange={setDisclaimerCanProceed}
            />
          </ErrorBoundary>
        </motion.div>
      </AnimatePresence>

      {showNavMap && (
        <NavMap
          flow={flow}
          currentSectionIndex={nav.currentSectionIndex}
          visited={visited}
          onNavigate={navigateToSection}
          onClose={() => setShowNavMap(false)}
        />
      )}

      {phase.phase !== 'cover' &&
        phase.phase !== 'quiz' &&
        phase.phase !== 'chapter-quiz' &&
        currentLesson?.lessonType !== 'quiz' && <CourseAIFab courseId={course._id} />}

      {progressError && persistSession && (
        <div
          role="status"
          className="bg-card/90 text-muted-foreground border-border/20 fixed bottom-4 left-4 z-50 rounded-full border px-4 py-2 text-xs shadow-lg backdrop-blur-sm"
        >
          Progress sync is unavailable — your progress may not be saved.
        </div>
      )}

      <CompletionBurst active={showBurst} />
    </LessonFrame>
  );
}
