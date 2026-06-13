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
const CourseQuizDynamic = dynamic(() =>
  import('./course-ai/CourseQuiz').then((m) => ({ default: m.CourseQuiz })),
);
const VideoLesson = dynamic(() =>
  import('./VideoLesson').then((m) => ({ default: m.VideoLesson })),
);
const SpecificationPage = dynamic(() =>
  import('./SpecificationPage').then((m) => ({ default: m.SpecificationPage })),
);
const DisclaimerPage = dynamic(() =>
  import('./DisclaimerPage').then((m) => ({ default: m.DisclaimerPage })),
);
const ColorSwitcherLesson = dynamic(() =>
  import('./ColorSwitcherLesson').then((m) => ({ default: m.ColorSwitcherLesson })),
);
const SplitScreenLesson = dynamic(() =>
  import('./SplitScreenLesson').then((m) => ({ default: m.SplitScreenLesson })),
);
const DragDropLesson = dynamic(() =>
  import('./DragDropLesson').then((m) => ({ default: m.default })),
);
const ScrollStoryLesson = dynamic(() =>
  import('./ScrollStoryLesson').then((m) => ({ default: m.default })),
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
    markLessonViewed,
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
  
  const isSpecialLesson = currentLesson?.lessonType === 'dragDrop' || currentLesson?.lessonType === 'scrollStory';
  const isSpecialComplete = visited[lessonKey]?.has('completed');
  
  const nextLocked = 
    (hotspots.length > 0 && hotspots.some((h) => !visited[lessonKey]?.has(h.label))) ||
    (isSpecialLesson && !isSpecialComplete);

  const markVisited = (label: string) => baseMarkVisited(lessonKey, label, isSpecialLesson ? 1 : hotspots.length);

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

  // ── Lesson view tracking ──────────────────────────────────────────────────
  // Fire once each time the learner lands on a new lesson (any type).
  useEffect(() => {
    if (!lessonKey || phase.phase !== 'chapter' || showChapterIntro) return;
    markLessonViewed(lessonKey, course._id);
    // lessonKey changes on every navigation — markLessonViewed is stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonKey]);

  // ── Weak topics for AI quiz generation ───────────────────────────────────
  // Seed from session-local unvisited hotspots; augment with cross-session
  // population data from /api/analytics/weak-topics when the quiz phase loads.
  const [weakTopics, setWeakTopics] = useState<string[]>([]);

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
    (phase.phase === 'chapter' && currentLesson?.lessonType === 'quiz');

  useEffect(() => {
    if (!isQuizPhase) return;
    setWeakTopics(sessionWeakTopics);

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
        setWeakTopics((prev) => {
          const merged = new Set([...prev, ...data.weakTopics]);
          return Array.from(merged).slice(0, 15);
        });
      })
      .catch(() => {});
  // Only re-fetch when the quiz phase first becomes active
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isQuizPhase]);

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
          screen: (
            <QuizLesson
              sanityQuiz={structure.quizSection}
              weakTopics={weakTopics}
              onPass={nav.finishQuiz}
              onFail={nav.finishQuiz}
              sessionId={persistSession ? sessionId : undefined}
              courseId={course._id}
            />
          ),
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
                  body={currentLesson.body}
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
                <div className="bg-background absolute inset-0 flex items-center justify-center overflow-y-auto p-6">
                  <CourseQuizDynamic
                    weakTopics={weakTopics}
                    onPass={goNext}
                    onFail={goNext}
                    sessionId={persistSession ? sessionId : undefined}
                    courseId={course._id}
                  />
                </div>
              ),
            };
          case 'colorSwitcher':
            return {
              slideKey: `colorSwitcher-${currentLesson._key}`,
              screen: (
                <ColorSwitcherLesson
                  lesson={currentLesson}
                />
              ),
            };
          case 'splitScreen':
            return {
              slideKey: `splitScreen-${currentLesson._key}`,
              screen: (
                <SplitScreenLesson
                  lesson={currentLesson}
                />
              ),
            };
          case 'dragDrop':
            return {
              slideKey: `dragDrop-${currentLesson._key}`,
              screen: (
                <DragDropLesson
                  lesson={currentLesson}
                  isCompleted={isSpecialComplete ?? false}
                  onComplete={() => markVisited('completed')}
                />
              ),
            };
          case 'scrollStory':
            return {
              slideKey: `scrollStory-${currentLesson._key}`,
              screen: (
                <ScrollStoryLesson
                  lesson={currentLesson}
                  isCompleted={isSpecialComplete ?? false}
                  onComplete={() => markVisited('completed')}
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
