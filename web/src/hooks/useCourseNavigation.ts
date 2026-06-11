'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { getChapterLessons, type CourseStructure } from '@/lib/course-structure';

// ── Course phase state machine ────────────────────────────────────────────────

export type CoursePhase =
  | { phase: 'cover' }
  | { phase: 'chapter'; chapterIndex: number; lessonIndex: number }
  | { phase: 'specifications'; specIndex: number }
  | { phase: 'quiz' }
  | { phase: 'disclaimer' }
  | { phase: 'complete' };

export interface CourseNavState {
  phase: CoursePhase;
  navDirection: 1 | -1;
  showChapterIntro: boolean;
}

export type CourseNavAction =
  | { type: 'NEXT'; nextLocked?: boolean }
  | { type: 'PREV' }
  | { type: 'GO_TO_SECTION'; index: number }
  | { type: 'QUIZ_DONE' }
  | { type: 'DISMISS_CHAPTER_INTRO' }
  | { type: 'RESTART' };

const INITIAL_STATE: CourseNavState = {
  phase: { phase: 'cover' },
  navDirection: 1,
  showChapterIntro: false,
};

// ── Absolute section index (progress bar / NavMap highlight) ──────────────────

export function getSectionIndex(structure: CourseStructure, phase: CoursePhase): number {
  switch (phase.phase) {
    case 'cover':
      return -1;
    case 'chapter': {
      const lessonsBeforeThisChapter = structure.lessonSections.filter(
        (ls) => ls.chapterIndex < phase.chapterIndex,
      ).length;
      return lessonsBeforeThisChapter + phase.lessonIndex;
    }
    case 'specifications':
      return structure.specOffset + phase.specIndex;
    case 'quiz':
      return structure.quizOffset;
    case 'disclaimer':
      return structure.disclaimerOffset;
    case 'complete':
      return structure.totalSections;
  }
}

// ── Pure phase helpers ────────────────────────────────────────────────────────

/** Phase that follows the last chapter: specs → quiz → disclaimer → complete. */
function postChapterPhase(s: CourseStructure): CoursePhase {
  if (s.specSections.length > 0) return { phase: 'specifications', specIndex: 0 };
  if (s.quizSection) return { phase: 'quiz' };
  if (s.disclaimerSection) return { phase: 'disclaimer' };
  return { phase: 'complete' };
}

/** Last lesson of the last chapter, or the cover when there are no chapters. */
function lastChapterOrCover(s: CourseStructure): CoursePhase {
  const lastChapter = s.chapters[s.chapters.length - 1];
  if (!lastChapter) return { phase: 'cover' };
  return {
    phase: 'chapter',
    chapterIndex: lastChapter.chapterIndex,
    lessonIndex: Math.max(0, lastChapter.lessons.length - 1),
  };
}

/** Phase that precedes the quiz when navigating backwards. */
function phaseBeforeQuiz(s: CourseStructure): CoursePhase {
  if (s.specSections.length > 0) {
    return { phase: 'specifications', specIndex: s.specSections.length - 1 };
  }
  return lastChapterOrCover(s);
}

/** Phase that precedes the disclaimer when navigating backwards. */
function phaseBeforeDisclaimer(s: CourseStructure): CoursePhase {
  if (s.quizSection) return { phase: 'quiz' };
  return phaseBeforeQuiz(s);
}

// ── Reducer ───────────────────────────────────────────────────────────────────

function reduceNext(
  structure: CourseStructure,
  state: CourseNavState,
  nextLocked: boolean,
): CourseNavState {
  const { phase } = state;
  const forward = (next: CoursePhase, intro = false): CourseNavState => ({
    phase: next,
    navDirection: 1,
    showChapterIntro: intro,
  });

  switch (phase.phase) {
    case 'cover':
      if (structure.lessonSections.length > 0) {
        return forward({ phase: 'chapter', chapterIndex: 0, lessonIndex: 0 }, true);
      }
      return forward(postChapterPhase(structure));

    case 'chapter': {
      if (nextLocked) return state;
      const chapterLessons = getChapterLessons(structure, phase.chapterIndex);
      if (phase.lessonIndex < chapterLessons.length - 1) {
        return forward({
          phase: 'chapter',
          chapterIndex: phase.chapterIndex,
          lessonIndex: phase.lessonIndex + 1,
        });
      }
      // Last lesson of this chapter — cross into the next chapter if it exists.
      const nextChapterIndex = phase.chapterIndex + 1;
      if (getChapterLessons(structure, nextChapterIndex).length > 0) {
        return forward({ phase: 'chapter', chapterIndex: nextChapterIndex, lessonIndex: 0 }, true);
      }
      return forward(postChapterPhase(structure));
    }

    case 'specifications':
      if (phase.specIndex < structure.specSections.length - 1) {
        return forward({
          phase: 'specifications',
          specIndex: phase.specIndex + 1,
        });
      }
      if (structure.quizSection) return forward({ phase: 'quiz' });
      if (structure.disclaimerSection) return forward({ phase: 'disclaimer' });
      return forward({ phase: 'complete' });

    case 'disclaimer':
      return forward({ phase: 'complete' });

    // "quiz" advances via QUIZ_DONE; "complete" stays put.
    default:
      return state;
  }
}

function reducePrev(structure: CourseStructure, state: CourseNavState): CourseNavState {
  const { phase } = state;
  const back = (prev: CoursePhase): CourseNavState => ({
    phase: prev,
    navDirection: -1,
    showChapterIntro: false,
  });

  switch (phase.phase) {
    case 'chapter': {
      if (phase.lessonIndex > 0) {
        return back({
          phase: 'chapter',
          chapterIndex: phase.chapterIndex,
          lessonIndex: phase.lessonIndex - 1,
        });
      }
      if (phase.chapterIndex > 0) {
        const prevChapterIndex = phase.chapterIndex - 1;
        const prevChapterLessons = getChapterLessons(structure, prevChapterIndex);
        return back({
          phase: 'chapter',
          chapterIndex: prevChapterIndex,
          lessonIndex: Math.max(0, prevChapterLessons.length - 1),
        });
      }
      return back({ phase: 'cover' });
    }

    case 'specifications':
      if (phase.specIndex > 0) {
        return back({ phase: 'specifications', specIndex: phase.specIndex - 1 });
      }
      return back(lastChapterOrCover(structure));

    case 'quiz':
      return back(phaseBeforeQuiz(structure));

    case 'disclaimer':
      return back(phaseBeforeDisclaimer(structure));

    case 'complete':
      if (structure.disclaimerSection) return back({ phase: 'disclaimer' });
      return back(phaseBeforeDisclaimer(structure));

    default:
      return state;
  }
}

function reduceGoToSection(
  structure: CourseStructure,
  state: CourseNavState,
  index: number,
): CourseNavState {
  const section = structure.sections[index];
  if (!section) return state;

  const currentIdx = getSectionIndex(structure, state.phase);
  const navDirection: 1 | -1 = index > currentIdx ? 1 : -1;
  const jump = (next: CoursePhase, intro = false): CourseNavState => ({
    phase: next,
    navDirection,
    showChapterIntro: intro,
  });

  switch (section.sectionType) {
    case 'lesson': {
      const group = structure.chapters.find((c) => c.chapterIndex === section.chapterIndex);
      const lessonIdx = group?.lessons.findIndex((l) => l.section === section) ?? -1;
      return jump(
        {
          phase: 'chapter',
          chapterIndex: section.chapterIndex,
          lessonIndex: lessonIdx >= 0 ? lessonIdx : 0,
        },
        lessonIdx <= 0, // first lesson of a chapter (or not found) shows the intro
      );
    }
    case 'specification': {
      const specIdx = index - structure.specOffset;
      return jump({
        phase: 'specifications',
        specIndex: specIdx >= 0 ? specIdx : 0,
      });
    }
    case 'quiz':
      return jump({ phase: 'quiz' });
    case 'disclaimer':
      return jump({ phase: 'disclaimer' });
  }
}

/** Pure, testable navigation reducer over the derived course structure. */
export function courseNavigationReducer(
  structure: CourseStructure,
  state: CourseNavState,
  action: CourseNavAction,
): CourseNavState {
  switch (action.type) {
    case 'NEXT':
      return reduceNext(structure, state, action.nextLocked ?? false);
    case 'PREV':
      return reducePrev(structure, state);
    case 'GO_TO_SECTION':
      return reduceGoToSection(structure, state, action.index);
    case 'QUIZ_DONE':
      // Pass and fail-without-retry both advance past the quiz gate.
      return {
        phase: structure.disclaimerSection ? { phase: 'disclaimer' } : { phase: 'complete' },
        navDirection: 1,
        showChapterIntro: false,
      };
    case 'DISMISS_CHAPTER_INTRO':
      return { ...state, showChapterIntro: false };
    case 'RESTART':
      return INITIAL_STATE;
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useCourseNavigation(structure: CourseStructure) {
  const [state, dispatch] = useReducer(
    (s: CourseNavState, a: CourseNavAction) => courseNavigationReducer(structure, s, a),
    INITIAL_STATE,
  );

  // Completion burst — fires whenever the course transitions into "complete".
  const [showBurst, setShowBurst] = useState(false);
  const prevPhaseRef = useRef(state.phase.phase);
  useEffect(() => {
    const wasComplete = prevPhaseRef.current === 'complete';
    prevPhaseRef.current = state.phase.phase;
    if (state.phase.phase === 'complete' && !wasComplete) {
      setShowBurst(true);
      const t = setTimeout(() => setShowBurst(false), 1200);
      return () => clearTimeout(t);
    }
  }, [state.phase.phase]);

  const goNext = useCallback((nextLocked = false) => dispatch({ type: 'NEXT', nextLocked }), []);
  const goPrev = useCallback(() => dispatch({ type: 'PREV' }), []);
  const navigateToSection = useCallback(
    (index: number) => dispatch({ type: 'GO_TO_SECTION', index }),
    [],
  );
  const finishQuiz = useCallback(() => dispatch({ type: 'QUIZ_DONE' }), []);
  const dismissChapterIntro = useCallback(() => dispatch({ type: 'DISMISS_CHAPTER_INTRO' }), []);
  const restart = useCallback(() => dispatch({ type: 'RESTART' }), []);

  return {
    phase: state.phase,
    navDirection: state.navDirection,
    showChapterIntro: state.showChapterIntro,
    showBurst,
    currentSectionIndex: getSectionIndex(structure, state.phase),
    goNext,
    goPrev,
    navigateToSection,
    finishQuiz,
    dismissChapterIntro,
    restart,
  };
}
