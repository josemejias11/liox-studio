'use client';

import React, { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { LessonFrame } from './LessonFrame';
import { CourseCover } from './CourseCover';
import { CourseComplete } from './CourseComplete';
import { ChapterIntro } from './ChapterIntro';
import { NavMap } from './NavMap';
import { CompletionBurst } from './CompletionBurst';
import { ContentLesson } from './ContentLesson';
import { CourseAIFab } from './CourseAIFab';
import { useLessonProgress } from '@/hooks/useLessonProgress';
import { useCourseNavigation } from '@/hooks/useCourseNavigation';
import { deriveCourseStructure, getChapterLessons } from '@/lib/course-structure';
import { CONSENT_EVENT, SESSION_KEY, getConsent, type ConsentStatus } from '@/lib/consent';
import type { CourseSection, SanityCourse } from '@/lib/contracts/sanity';

const ProductStage = dynamic(() =>
  import('./ProductStage').then((m) => ({ default: m.ProductStage })),
);
const QuizLesson = dynamic(() => import('./QuizLesson').then((m) => ({ default: m.QuizLesson })));
const VideoLesson = dynamic(() =>
  import('./VideoLesson').then((m) => ({ default: m.VideoLesson })),
);
const SpecificationPage = dynamic(() =>
  import('./SpecificationPage').then((m) => ({ default: m.SpecificationPage })),
);
const DisclaimerPage = dynamic(() =>
  import('./DisclaimerPage').then((m) => ({ default: m.DisclaimerPage })),
);

// ── Framer Motion slide variants ─────────────────────────────────────────────

const slideVariants = {
  enter: (direction: number) => ({ x: direction > 0 ? '50%' : '-50%', opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction < 0 ? '50%' : '-50%', opacity: 0 }),
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function MotoViewer({
  course,
  sections,
}: {
  course: SanityCourse;
  sections: CourseSection[];
}) {
  // One source of truth for section grouping/indexing (shared with NavMap)
  const structure = useMemo(() => deriveCourseStructure(sections), [sections]);
  const nav = useCourseNavigation(structure);
  const { phase, navDirection, showChapterIntro, showBurst } = nav;

  const [showNavMap, setShowNavMap] = useState(false);

  // ── Session ───────────────────────────────────────────────────────────────
  // Initialize as "" so SSR and the first client render agree (no hydration
  // mismatch); the UUID is resolved on the client. Persistence is gated on
  // cookie consent: without "accepted", the id is ephemeral (in-memory only)
  // and no progress/quiz data is written to localStorage or the server.
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

    // If the user accepts mid-session, start persisting the current id so
    // progress carries across visits; on decline, stop persisting immediately
    // (setConsent already removed the stored id).
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
    error: progressError,
  } = useLessonProgress(sessionId, persistSession);

  // ── Current lesson (chapter phase only) ───────────────────────────────────
  const currentLesson =
    phase.phase === 'chapter'
      ? getChapterLessons(structure, phase.chapterIndex)[phase.lessonIndex]
      : undefined;
  const lessonKey = currentLesson?._key ?? '';
  const hotspots = useMemo(() => currentLesson?.hotspots ?? [], [currentLesson]);
  const visitedOnLesson = visited[lessonKey]?.size ?? 0;
  const nextLocked = hotspots.length > 0 && hotspots.some((h) => !visited[lessonKey]?.has(h.label));

  const markVisited = (label: string) => baseMarkVisited(lessonKey, label, hotspots.length);

  // ── Navigation wrappers (close transient overlays before moving) ──────────
  const goNext = () => nav.goNext(nextLocked);
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

  // ── Weak topics for lesson-type AI quizzes ────────────────────────────────
  // Real learner data: hotspot topics not yet explored in this session steer
  // the RAG quiz generation toward the learner's gaps.
  const buildWeakTopics = () => {
    const topics = new Set<string>();
    for (const s of structure.lessonSections) {
      for (const h of s.hotspots ?? []) {
        const topic = (h.topic || h.label).trim();
        if (topic && !visited[s._key]?.has(h.label)) topics.add(topic);
      }
    }
    return Array.from(topics).slice(0, 10);
  };

  // ── Phase switch — slide key + screen content ─────────────────────────────
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
            <SpecificationPage spec={spec} onNext={goNext} onPrev={goPrev} showPrev={true} />
          ) : null,
        };
      }

      case 'quiz':
        return {
          slideKey: 'quiz',
          screen: structure.quizSection ? (
            <QuizLesson
              sanityQuiz={structure.quizSection}
              onPass={nav.finishQuiz}
              onFail={nav.finishQuiz}
              sessionId={persistSession ? sessionId : undefined}
              courseId={course._id}
            />
          ) : null,
        };

      case 'disclaimer':
        return {
          slideKey: 'disclaimer',
          screen: structure.disclaimerSection ? (
            <DisclaimerPage disclaimer={structure.disclaimerSection} onNext={goNext} />
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

        switch (currentLesson.lessonType) {
          case 'stage':
            return {
              slideKey: `stage-${currentLesson._key}`,
              screen: (
                <ProductStage
                  headline={currentLesson.headline}
                  productImage={currentLesson.media?.asset?.url}
                  stageBackground={currentLesson.stageBackground?.asset?.url}
                  enableCompletionAnimation={currentLesson.enableCompletionAnimation}
                  completionTransition={currentLesson.completionTransition}
                  hotspots={hotspots}
                  visited={visited[lessonKey] ?? new Set()}
                  onVisit={markVisited}
                  onNext={goNext}
                  onPrev={goPrev}
                  courseId={course._id}
                />
              ),
            };
          case 'video':
            return {
              slideKey: `video-${currentLesson._key}`,
              screen: (
                <VideoLesson
                  headline={currentLesson.headline}
                  videoFileUrl={currentLesson.videoFile?.asset?.url}
                  videoAspectRatio={currentLesson.videoAspectRatio}
                  onNext={goNext}
                />
              ),
            };
          case 'quiz':
            return {
              slideKey: `quiz-lesson-${currentLesson._key}`,
              screen: (
                <QuizLesson
                  weakTopics={buildWeakTopics()}
                  onPass={goNext} // lesson-type quiz advances on pass and fail (no gate)
                  onFail={goNext}
                  sessionId={persistSession ? sessionId : undefined}
                  courseId={course._id}
                />
              ),
            };
          default:
            return {
              slideKey: `lesson-${currentLesson._key}`,
              screen: (
                <ContentLesson
                  lesson={currentLesson}
                  hotspots={hotspots}
                  visitedLabels={visited[lessonKey] ?? new Set()}
                  onVisit={markVisited}
                  courseId={course._id}
                />
              ),
            };
        }
      }
    }
  }

  const { slideKey, screen } = renderPhase();

  // ── LessonFrame props vary by phase ───────────────────────────────────────
  const isContentLesson =
    phase.phase === 'chapter' &&
    !showChapterIntro &&
    currentLesson !== undefined &&
    !['stage', 'video', 'quiz'].includes(currentLesson.lessonType);

  const frameProps =
    phase.phase === 'cover'
      ? { moduleTitle: course.title }
      : isContentLesson
        ? {
            // True totals — LessonFrame no longer infers "last lesson" from the
            // count; the navigation reducer owns that boundary and nextDisabled
            // covers the hotspot gate.
            currentLesson: nav.currentSectionIndex >= 0 ? nav.currentSectionIndex + 1 : 1,
            totalLessons: structure.totalSections,
            onPrev: goPrev,
            onNext: goNext,
            nextDisabled: nextLocked,
            onToggleNavMap: () => setShowNavMap((v) => !v),
            moduleTitle: course.title,
            completionHint: nextLocked
              ? `Tap all ${hotspots.length} features to continue (${visitedOnLesson} / ${hotspots.length})`
              : undefined,
          }
        : { onToggleNavMap: () => setShowNavMap((v) => !v), moduleTitle: course.title };

  // ── Render — one persistent AnimatePresence across all phases ─────────────
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
          transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
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

      {/* Floating AI Assistant Widget */}
      {phase.phase !== 'cover' && 
       phase.phase !== 'quiz' && 
       currentLesson?.lessonType !== 'quiz' && (
         <CourseAIFab courseId={course._id} />
      )}

      {/* Progress sync failure — non-blocking notice; optimistic updates roll back */}
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
