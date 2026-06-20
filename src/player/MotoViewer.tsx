'use client';

import React, { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { LessonFrame } from './LessonFrame';
import { CourseCover } from '@/components/CourseCover';
import { CourseComplete } from '@/components/CourseComplete';
import { ChapterIntro } from './ChapterIntro';
import { NavMap } from './NavMap';
import { CompletionBurst } from '@/components/CompletionBurst';
import { CourseAIFab } from '@/components/CourseAIFab';
import { LessonRenderer } from './LessonRenderer';
import { useLessonProgress } from './hooks/useLessonProgress';
import { useCourseNavigation } from './hooks/useCourseNavigation';
import { deriveCourseStructure, getChapterLessons } from '@/lib/course-structure';
import { CONSENT_EVENT, SESSION_KEY, getConsent, type ConsentStatus } from '@/lib/consent';
import type { CourseSection, SanityCourse } from '@/lib/contracts/sanity';

const CourseQuizDynamic = dynamic(() =>
  import('@/components/course-ai/CourseQuiz').then((m) => ({ default: m.CourseQuiz })),
);
const QuizLessonDynamic = dynamic(() =>
  import('./lesson-types/QuizLesson').then((m) => ({ default: m.QuizLesson })),
);
const SpecificationPage = dynamic(() =>
  import('@/components/SpecificationPage').then((m) => ({ default: m.SpecificationPage })),
);
const DisclaimerPage = dynamic(() =>
  import('@/components/DisclaimerPage').then((m) => ({ default: m.DisclaimerPage })),
);

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
  const structure = useMemo(
    () => deriveCourseStructure(sections, course.chapters ?? []),
    [sections, course.chapters],
  );

  const [showNavMap, setShowNavMap] = useState(false);

  // ── Session ───────────────────────────────────────────────────────────────
  const [sessionId, setSessionId] = useState<string>('');
  const [persistSession, setPersistSession] = useState(false);
  useEffect(() => {
    const consent = getConsent();
    let sid = consent === 'accepted' ? localStorage.getItem(SESSION_KEY) : null;
    if (consent === 'accepted' && !sid) {
      sid = crypto.randomUUID();
      localStorage.setItem(SESSION_KEY, sid);
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSessionId(sid ?? crypto.randomUUID());
    setPersistSession(consent === 'accepted');

    function onConsentChange(e: Event) {
      const status = (e as CustomEvent<ConsentStatus>).detail;
      if (status === 'accepted') {
        setSessionId((prev) => {
          const id = prev || crypto.randomUUID();
          localStorage.setItem(SESSION_KEY, id);
          return id;
        });
        setPersistSession(true);
      } else {
        setPersistSession(false);
      }
    }
    window.addEventListener(CONSENT_EVENT, onConsentChange);
    return () => window.removeEventListener(CONSENT_EVENT, onConsentChange);
  }, []);

  const {
    visited,
    markVisited: baseMarkVisited,
    markLessonViewed,
    error: progressError,
  } = useLessonProgress(sessionId, persistSession);

  const nav = useCourseNavigation(structure, visited);
  const { phase, navDirection, showChapterIntro, showBurst, nextLocked } = nav;

  // ── Current lesson (chapter phase only) ───────────────────────────────────
  const currentLesson =
    phase.phase === 'chapter'
      ? getChapterLessons(structure, phase.chapterIndex)[phase.lessonIndex]
      : undefined;
  const lessonKey = currentLesson?._key ?? '';
  const hotspots = useMemo(() => currentLesson?.hotspots ?? [], [currentLesson]);
  const visitedOnLesson = visited[lessonKey]?.size ?? 0;

  const isSpecialLesson = ['dragDrop', 'video'].includes(currentLesson?.lessonType ?? '');
  const isSpecialComplete = visited[lessonKey]?.has('completed');

  const markVisited = (label: string) =>
    baseMarkVisited(lessonKey, label, isSpecialLesson ? 1 : hotspots.length);

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
  const [apiWeakTopics, setApiWeakTopics] = useState<string[]>([]);

  const sessionWeakTopics = useMemo(() => {
    const topics = new Set<string>();
    for (const s of structure.lessonSections) {
      for (const h of s.hotspots ?? []) {
        const topic = (h.topic || h.label).trim();
        if (topic && !visited[s._key]?.has(h.label)) topics.add(topic);
      }
    }
    return Array.from(topics).slice(0, 10);
  }, [structure.lessonSections, visited]);

  const isQuizPhase =
    phase.phase === 'quiz' ||
    phase.phase === 'chapter-quiz' ||
    (phase.phase === 'chapter' && currentLesson?.lessonType === 'quiz');

  const weakTopics = useMemo(() => {
    if (!isQuizPhase) return [];
    const merged = new Set([...sessionWeakTopics, ...apiWeakTopics]);
    return Array.from(merged).slice(0, 15);
  }, [isQuizPhase, sessionWeakTopics, apiWeakTopics]);

  useEffect(() => {
    if (!isQuizPhase) return;

    const lessonMeta = structure.lessonSections.map((s) => ({
      id: s._key,
      headline: s.headline,
      topics: [
        ...(s.hotspots ?? []).map((h) => h.topic || h.label).filter(Boolean),
        s.headline,
      ],
    }));

    fetch('/api/analytics/weak-topics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId: course._id, lessons: lessonMeta }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.weakTopics?.length) return;
        setApiWeakTopics(data.weakTopics);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isQuizPhase]);

  // ── Phase switch ──────────────────────────────────────────────────────────
  function renderPhase(): { slideKey: string; screen: React.ReactNode } {
    switch (phase.phase) {
      case 'cover': {
        const coverImage =
          course.coverImage?.asset?.url ||
          course.thumbnail?.asset?.url ||
          structure.lessonSections[0]?.media?.asset?.url;
        return {
          slideKey: 'cover',
          screen: (
            <CourseCover
              title={course.title}
              coverHeadline={course.coverHeadline}
              coverImage={coverImage}
              buttonText={course.coverButtonText}
              buttonColor={course.coverButtonColor}
              learningObjectives={course.learningObjectives}
              onStart={goNext}
            />
          ),
        };
      }

      case 'specifications': {
        const spec = structure.specSections[phase.specIndex];
        return {
          slideKey: `spec-${phase.specIndex}`,
          screen: spec ? (
            <SpecificationPage spec={spec} />
          ) : null,
        };
      }

      case 'quiz':
        return {
          slideKey: 'quiz',
          screen: (
            <div className="bg-background absolute inset-0 flex items-center justify-center overflow-y-auto p-6">
              <CourseQuizDynamic
                weakTopics={weakTopics}
                onPass={nav.finishQuiz}
                onFail={nav.finishQuiz}
                sessionId={persistSession ? sessionId : undefined}
                courseId={course._id}
              />
            </div>
          ),
        };

      case 'chapter-quiz': {
        const chapterGroup = structure.chapters.find(
          (c) => c.chapterIndex === phase.chapterIndex,
        );
        return {
          slideKey: `chapter-quiz-${phase.chapterIndex}`,
          screen: (
            <div className="bg-background absolute inset-0 flex items-center justify-center overflow-y-auto p-6">
              <QuizLessonDynamic
                sanityQuiz={chapterGroup?.quickCheck}
                weakTopics={weakTopics}
                onPass={() => nav.finishChapterQuiz(phase.chapterIndex)}
                onFail={() => nav.finishChapterQuiz(phase.chapterIndex)}
                sessionId={persistSession ? sessionId : undefined}
                courseId={course._id}
              />
            </div>
          ),
        };
      }

      case 'disclaimer':
        return {
          slideKey: 'disclaimer',
          screen: structure.disclaimerSection ? (
            <DisclaimerPage
              disclaimer={structure.disclaimerSection}
              onNext={goNext}
              onCanProceedChange={setDisclaimerCanProceed}
            />
          ) : null,
        };

      case 'complete':
        return {
          slideKey: 'complete',
          screen: (
            <CourseComplete
              moduleTitle={course.title}
              totalLessons={structure.lessonSections.length}
              totalHotspotsVisited={totalHotspotsVisited}
              totalHotspots={totalHotspots}
            />
          ),
        };

      case 'chapter': {
        if (!currentLesson) return { slideKey: 'empty', screen: null };

        if (showChapterIntro) {
          const chapter = structure.chapters.find((c) => c.chapterIndex === phase.chapterIndex);
          return {
            slideKey: `intro-${phase.chapterIndex}`,
            screen: (
              <ChapterIntro
                chapterTitle={chapter?.chapterTitle ?? ''}
                onContinue={nav.dismissChapterIntro}
              />
            ),
          };
        }

        return {
          slideKey: `lesson-${currentLesson._key}`,
          screen: (
            <LessonRenderer
              lesson={currentLesson}
              lessonKey={lessonKey}
              hotspots={hotspots}
              visited={visited[lessonKey] ?? new Set()}
              isSpecialComplete={isSpecialComplete ?? false}
              goNext={goNext}
              goPrev={goPrev}
              markVisited={markVisited}
              baseMarkVisited={baseMarkVisited}
              weakTopics={weakTopics}
              sessionId={sessionId}
              persistSession={persistSession}
              courseId={course._id}
            />
          ),
        };
      }
    }
  }

  const { slideKey, screen } = renderPhase();

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
              nextLocked && hotspots.length > 0
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
          {screen}
        </motion.div>
      </AnimatePresence>

      {showNavMap && (
        <NavMap
          structure={structure}
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
