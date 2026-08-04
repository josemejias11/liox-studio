'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LessonFrame } from './LessonFrame';
import { useLessonProgress } from './hooks/useLessonProgress';
import { useCourseNavigation } from './hooks/useCourseNavigation';
import { getChapterLessons } from '@/learning/course-structure';
import { deriveCourseFlow } from '@/learning/course-flow';
import type { CourseSection, CourseContent } from '@/shared/contracts/player-course';
import type { RevisionIdentity } from '@/shared/contracts/api';
import { useCourseSession } from './hooks/useCourseSession';
import { useWeakTopics } from './hooks/useWeakTopics';
import { CoursePhaseScreen, getCoursePhaseSlideKey } from './CoursePhaseScreen';
import { ErrorBoundary } from '@/shared/ErrorBoundary';
import { useLessonRuntime } from './hooks/useLessonRuntime';
import { PlayerOverlays } from './PlayerOverlays';

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

export default function MotoViewer({
  course,
  sections,
  preview = false,
  initialSectionKey,
  imageSizes = '100vw',
  aiIdentity,
}: {
  course: CourseContent;
  sections: CourseSection[];
  preview?: boolean;
  initialSectionKey?: string;
  imageSizes?: string;
  aiIdentity?: RevisionIdentity;
}) {
  const flow = useMemo(
    () => deriveCourseFlow(sections, course.chapters ?? []),
    [sections, course.chapters],
  );
  const structure = flow.structure;

  const [showNavMap, setShowNavMap] = useState(false);
  const { sessionId, persistSession: userPersistSession } = useCourseSession(preview);
  const persistSession = userPersistSession && !preview;

  const {
    visited,
    markVisited: baseMarkVisited,
    markLessonViewed,
    error: progressError,
  } = useLessonProgress(sessionId, persistSession, course._id);

  const nav = useCourseNavigation(flow, visited);
  const {
    phase,
    navDirection,
    showChapterIntro,
    showBurst,
    nextLocked,
    navigateToSectionUnrestricted: navigateToPreviewSection,
    dismissChapterIntro: dismissPreviewChapterIntro,
  } = nav;

  useEffect(() => {
    if (!preview || !initialSectionKey) return;
    const target = flow.items.find(
      (item) => item.kind === 'lesson' && item.key === initialSectionKey,
    );
    if (!target) return;
    navigateToPreviewSection(target.index);
    dismissPreviewChapterIntro();
  }, [
    dismissPreviewChapterIntro,
    flow.items,
    initialSectionKey,
    navigateToPreviewSection,
    preview,
  ]);
  const currentLesson =
    phase.phase === 'chapter'
      ? getChapterLessons(structure, phase.chapterIndex)[phase.lessonIndex]
      : undefined;
  const lessonRuntime = useLessonRuntime({
    currentLesson,
    visited,
    baseMarkVisited,
    nextLocked,
  });
  const { lessonKey } = lessonRuntime;
  const goNext = nav.goNext;
  const goPrev = nav.goPrev;

  function navigateToSection(i: number) {
    setShowNavMap(false);
    nav.navigateToSection(i);
  }
  const { totalHotspots, totalHotspotsVisited } = useMemo(
    () =>
      structure.lessonSections.reduce(
        (stats, section) => {
          const authoredLabels = section.hotspots?.map((hotspot) => hotspot.label) ?? [];
          const visitedLabels = visited[section._key];

          return {
            totalHotspots: stats.totalHotspots + authoredLabels.length,
            totalHotspotsVisited:
              stats.totalHotspotsVisited +
              authoredLabels.filter((label) => visitedLabels?.has(label)).length,
          };
        },
        { totalHotspots: 0, totalHotspotsVisited: 0 },
      ),
    [structure.lessonSections, visited],
  );
  useEffect(() => {
    if (preview || !lessonKey || phase.phase !== 'chapter' || showChapterIntro) return;
    markLessonViewed(lessonKey, course._id);
  }, [course._id, lessonKey, markLessonViewed, phase.phase, preview, showChapterIntro]);
  const [disclaimerCanProceed, setDisclaimerCanProceed] = useState(true);
  const { topics: weakTopics } = useWeakTopics({
    enabled: !preview,
    phase,
    structure,
    visited,
    courseId: course._id,
    currentLessonType: currentLesson?.lessonType,
  });

  const slideKey = getCoursePhaseSlideKey({ phase, currentLesson, showChapterIntro });
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
            completionHint: lessonRuntime.completionHint,
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
  return (
    <LessonFrame {...frameProps} contained={preview}>
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
                <h2 className="text-lg font-semibold text-red-600">
                  Failed to load course content
                </h2>
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
              lessonRuntime={lessonRuntime}
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
              onDisclaimerCanProceedChange={setDisclaimerCanProceed}
              preview={preview}
              aiIdentity={aiIdentity}
              imageSizes={imageSizes}
            />
          </ErrorBoundary>
        </motion.div>
      </AnimatePresence>

      <PlayerOverlays
        flow={flow}
        phase={phase}
        currentLesson={currentLesson}
        currentSectionIndex={nav.currentSectionIndex}
        visited={visited}
        courseId={course._id}
        showNavMap={showNavMap}
        showBurst={showBurst}
        progressError={progressError}
        persistSession={persistSession}
        allowAssistant={Boolean(aiIdentity)}
        aiIdentity={aiIdentity}
        onNavigate={navigateToSection}
        onCloseNavMap={() => setShowNavMap(false)}
      />
    </LessonFrame>
  );
}
