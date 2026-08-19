'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LessonFrame } from './LessonFrame';
import { useLessonProgress } from './hooks/useLessonProgress';
import { useCourseNavigation } from './hooks/useCourseNavigation';
import { getChapterLessons } from '@/learning/course-structure';
import { deriveCourseFlow } from '@/learning/course-flow';
import type { CourseSection, CourseContent } from '@/shared/contracts/player-course';
import type { RevisionIdentity } from '@/shared/contracts/api';
import type { OfflineAssistantPayload } from '@moto-ai/contracts';
import { useCourseSession } from './hooks/useCourseSession';
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

const COURSE_RESUME_KEY_PREFIX = 'mototutor_course_resume:';
const PREVIEW_RESUME_KEY_PREFIX = 'mototutor_preview_resume:';

export default function MotoViewer({
  course,
  sections,
  preview = false,
  initialSectionKey,
  imageSizes = '100vw',
  aiIdentity,
  assistant,
  onAssistantAnswer,
  onLessonChange,
  initialView,
  initialChapterId,
  bypassNavigationLocks = false,
}: {
  course: CourseContent;
  sections: CourseSection[];
  preview?: boolean;
  initialSectionKey?: string;
  imageSizes?: string;
  aiIdentity?: RevisionIdentity;
  assistant?: OfflineAssistantPayload;
  onAssistantAnswer?: (context: { question: string; matchedQaId: string | null; answer: string }) => void;
  onLessonChange?: (lessonId: string) => void;
  initialView?: 'cover';
  initialChapterId?: string;
  bypassNavigationLocks?: boolean;
}) {
  const flow = useMemo(
    () => deriveCourseFlow(sections, course.chapters ?? [], course.finalQuiz),
    [sections, course.chapters, course.finalQuiz],
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

  const nav = useCourseNavigation(flow, visited, bypassNavigationLocks);
  const restoredResumeKeyRef = useRef<string | null>(null);
  const appliedInitialSectionKeyRef = useRef<string | undefined>(undefined);
  const appliedInitialViewRef = useRef<'cover' | undefined>(undefined);
  const appliedInitialChapterIdRef = useRef<string | undefined>(undefined);
  const resumeKey = `${preview ? PREVIEW_RESUME_KEY_PREFIX : COURSE_RESUME_KEY_PREFIX}${course._id}`;

  useEffect(() => {
    if (!sessionId || restoredResumeKeyRef.current === resumeKey) return;

    restoredResumeKeyRef.current = resumeKey;
    const savedResume = localStorage.getItem(resumeKey);
    if (savedResume === 'complete') {
      nav.restoreComplete();
      return;
    }

    const sectionIndex = Number(savedResume);
    if (Number.isInteger(sectionIndex) && sectionIndex >= 0 && sectionIndex < flow.items.length) {
      nav.navigateToSectionUnrestricted(sectionIndex);
    }
  }, [flow.items.length, nav, preview, resumeKey, sessionId]);
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
    if (appliedInitialViewRef.current === initialView) return;
    appliedInitialViewRef.current = initialView;
    if (initialView === 'cover') nav.restart();
  }, [initialView, nav]);

  useEffect(() => {
    if (!initialChapterId) {
      appliedInitialChapterIdRef.current = undefined;
      return;
    }
    if (appliedInitialChapterIdRef.current === initialChapterId) return;

    const chapterIndex = course.chapters?.findIndex((chapter) => chapter._id === initialChapterId) ?? -1;
    const firstChapterLesson = flow.items.find(
      (item) => item.kind === 'lesson' && item.key === course.chapters?.[chapterIndex]?.lessons?.[0]?._key,
    );
    if (firstChapterLesson === undefined) return;

    appliedInitialChapterIdRef.current = initialChapterId;
    navigateToPreviewSection(firstChapterLesson.index);
  }, [course.chapters, flow.items, initialChapterId, navigateToPreviewSection]);

  useEffect(() => {
    if (!initialSectionKey) {
      appliedInitialSectionKeyRef.current = undefined;
      return;
    }
    if (appliedInitialSectionKeyRef.current === initialSectionKey) return;

    const target = flow.items.find(
      (item) => item.kind === 'lesson' && item.key === initialSectionKey,
    );
    if (!target) return;

    appliedInitialSectionKeyRef.current = initialSectionKey;
    navigateToPreviewSection(target.index);
    dismissPreviewChapterIntro();
  }, [
    dismissPreviewChapterIntro,
    flow.items,
    initialSectionKey,
    navigateToPreviewSection,
  ]);
  const currentLesson =
    phase.phase === 'chapter'
      ? getChapterLessons(structure, phase.chapterIndex)[phase.lessonIndex]
      : undefined;
  useEffect(() => {
    if (showChapterIntro || !currentLesson) return;
    onLessonChange?.(currentLesson._key);
  }, [currentLesson, onLessonChange, showChapterIntro]);
  const lessonRuntime = useLessonRuntime({
    currentLesson,
    visited,
    baseMarkVisited,
    nextLocked,
  });
  const { lessonKey } = lessonRuntime;
  const goNext = nav.goNext;
  const goPrev = nav.goPrev;

  useEffect(() => {
    if (!sessionId) return;

    if (phase.phase === 'complete') {
      localStorage.setItem(resumeKey, 'complete');
      return;
    }

    const sectionIndex = nav.currentSectionIndex;
    if (sectionIndex >= 0 && sectionIndex < flow.items.length) {
      localStorage.setItem(resumeKey, String(sectionIndex));
    }
  }, [flow.items.length, nav.currentSectionIndex, phase.phase, preview, resumeKey, sessionId]);

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
              sessionId={sessionId}
              persistSession={persistSession}
              showChapterIntro={showChapterIntro}
              totalHotspotsVisited={totalHotspotsVisited}
              totalHotspots={totalHotspots}
              goNext={goNext}
              goPrev={goPrev}
              finishChapterQuiz={nav.finishChapterQuiz}
              finishQuiz={nav.finishQuiz}
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
        showNavMap={showNavMap}
        showBurst={showBurst}
        progressError={progressError}
        persistSession={persistSession}
        assistant={assistant}
        onAssistantAnswer={onAssistantAnswer}
        onNavigate={navigateToSection}
        onCloseNavMap={() => setShowNavMap(false)}
      />
    </LessonFrame>
  );
}
