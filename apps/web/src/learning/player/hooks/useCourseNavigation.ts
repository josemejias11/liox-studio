'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { getChapterLessons, type CourseStructure } from '@/learning/course-structure';
import { getFlowItemByIndex, type CourseFlow } from '@/learning/course-flow';
import { getLessonCompletionMode, LessonCompletionMode } from '../lesson-types/registry';
import { isCanvasComplete } from '@/learning/canvas';
import { getCoveredFeatureLabels, isRefresherComplete } from '@/learning/refresher';

export type CoursePhase =
  | { phase: 'cover' }
  | { phase: 'chapter'; chapterIndex: number; lessonIndex: number }
  | { phase: 'chapter-quiz'; chapterIndex: number }
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
  | { type: 'NEXT'; visited?: Record<string, Set<string>> }
  | { type: 'PREV' }
  | { type: 'GO_TO_SECTION'; index: number; visited?: Record<string, Set<string>> }
  | { type: 'QUIZ_DONE' }
  | { type: 'CHAPTER_QUIZ_DONE'; chapterIndex: number }
  | { type: 'DISMISS_CHAPTER_INTRO' }
  | { type: 'RESTART' };

const INITIAL_STATE: CourseNavState = {
  phase: { phase: 'cover' },
  navDirection: 1,
  showChapterIntro: false,
};

function findFlowIndex(flow: CourseFlow, kind: 'quiz' | 'disclaimer'): number {
  return flow.items.find((item) => item.kind === kind)?.index ?? flow.items.length;
}

export function getSectionIndex(flow: CourseFlow, phase: CoursePhase): number {
  const structure = flow.structure;
  switch (phase.phase) {
    case 'cover':
      return -1;
    case 'chapter': {
      const lessonsBeforeThisChapter = structure.lessonSections.filter(
        (ls) => ls.chapterIndex < phase.chapterIndex,
      ).length;
      return lessonsBeforeThisChapter + phase.lessonIndex;
    }
    case 'chapter-quiz': {
      const lessonsBeforeThisChapter = structure.lessonSections.filter(
        (ls) => ls.chapterIndex < phase.chapterIndex,
      ).length;
      const chapterLessons = getChapterLessons(structure, phase.chapterIndex);
      return lessonsBeforeThisChapter + Math.max(0, chapterLessons.length - 1);
    }
    case 'specifications':
      return structure.specSections.length > phase.specIndex
        ? flow.items.find(
            (item) =>
              item.kind === 'specification' &&
              item.key === (structure.specSections[phase.specIndex]?._key ?? `spec-${phase.specIndex}`),
          )?.index ?? -1
        : -1;
    case 'quiz':
      return findFlowIndex(flow, 'quiz');
    case 'disclaimer':
      return findFlowIndex(flow, 'disclaimer');
    case 'complete':
      return flow.items.length;
  }
}


function postChapterPhase(s: CourseStructure): CoursePhase {
  if (s.specSections.length > 0) return { phase: 'specifications', specIndex: 0 };
  return { phase: 'quiz' };
}


function lastChapterOrCover(s: CourseStructure): CoursePhase {
  const lastChapter = s.chapters[s.chapters.length - 1];
  if (!lastChapter) return { phase: 'cover' };
  return {
    phase: 'chapter',
    chapterIndex: lastChapter.chapterIndex,
    lessonIndex: Math.max(0, lastChapter.lessons.length - 1),
  };
}


function phaseBeforeQuiz(s: CourseStructure): CoursePhase {
  if (s.specSections.length > 0) {
    return { phase: 'specifications', specIndex: s.specSections.length - 1 };
  }
  return lastChapterOrCover(s);
}


function phaseBeforeDisclaimer(_s: CourseStructure): CoursePhase {
  return { phase: 'quiz' };
}

export function isLessonLocked(
  structure: CourseStructure,
  phase: CoursePhase,
  visited?: Record<string, Set<string>>,
): boolean {
  if (!visited || phase.phase !== 'chapter') return false;
  const currentLesson = getChapterLessons(structure, phase.chapterIndex)[phase.lessonIndex];
  if (!currentLesson) return false;

  const lessonKey = currentLesson._key;
  const hotspots = currentLesson.hotspots ?? [];
  const completionMode = getLessonCompletionMode(currentLesson);
  const visitedOnLesson = visited[lessonKey] ?? new Set<string>();

  if (completionMode === LessonCompletionMode.MANUAL) {
    return !visitedOnLesson.has('completed');
  }

  if (getCoveredFeatureLabels(currentLesson).length > 0) {
    return !isRefresherComplete(currentLesson, visitedOnLesson);
  }

  if (currentLesson.lessonType === 'canvas') {
    return !isCanvasComplete(currentLesson, visitedOnLesson);
  }

  const hotspotsLocked =
    completionMode === LessonCompletionMode.HOTSPOT &&
    hotspots.length > 0 &&
    hotspots.some((h) => !visitedOnLesson.has(h.label));

  return hotspotsLocked;
}

function reduceNext(
  structure: CourseStructure,
  state: CourseNavState,
  visited?: Record<string, Set<string>>,
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
      if (isLessonLocked(structure, phase, visited)) return state;
      const chapterLessons = getChapterLessons(structure, phase.chapterIndex);
      if (phase.lessonIndex < chapterLessons.length - 1) {
        return forward({
          phase: 'chapter',
          chapterIndex: phase.chapterIndex,
          lessonIndex: phase.lessonIndex + 1,
        });
      }
      const currentChapterGroup = structure.chapters.find(
        (c) => c.chapterIndex === phase.chapterIndex,
      );
      if (currentChapterGroup?.quickCheck) {
        return forward({ phase: 'chapter-quiz', chapterIndex: phase.chapterIndex });
      }
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
      return forward({ phase: 'quiz' });

    case 'disclaimer':
      return forward({ phase: 'complete' });
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

    case 'chapter-quiz': {
      const chapterLessons = getChapterLessons(structure, phase.chapterIndex);
      return back({
        phase: 'chapter',
        chapterIndex: phase.chapterIndex,
        lessonIndex: Math.max(0, chapterLessons.length - 1),
      });
    }

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
  flow: CourseFlow,
  state: CourseNavState,
  index: number,
  visited?: Record<string, Set<string>>,
): CourseNavState {
  const structure = flow.structure;
  const item = getFlowItemByIndex(flow, index);
  if (!item) return state;

  const currentIdx = getSectionIndex(flow, state.phase);
  const isForward = index > currentIdx;
  if (isForward && isLessonLocked(structure, state.phase, visited)) {
     return state;
  }

  const navDirection: 1 | -1 = isForward ? 1 : -1;
  const jump = (next: CoursePhase, intro = false): CourseNavState => ({
    phase: next,
    navDirection,
    showChapterIntro: intro,
  });

  switch (item.kind) {
    case 'lesson': {
      const group = structure.chapters.find((chapter) =>
        chapter.lessons.some((lesson) => lesson.section._key === item.key),
      );
      const lessonIdx = group?.lessons.findIndex((lesson) => lesson.section._key === item.key) ?? -1;
      return jump(
        {
          phase: 'chapter',
          chapterIndex: group?.chapterIndex ?? 0,
          lessonIndex: lessonIdx >= 0 ? lessonIdx : 0,
        },
        lessonIdx <= 0,
      );
    }
    case 'specification': {
      const specIdx = structure.specSections.findIndex(
        (spec, specIndex) => (spec._key ?? `spec-${specIndex}`) === item.key,
      );
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


export function courseNavigationReducer(
  flow: CourseFlow,
  state: CourseNavState,
  action: CourseNavAction,
): CourseNavState {
  const structure = flow.structure;
  switch (action.type) {
    case 'NEXT':
      return reduceNext(structure, state, action.visited);
    case 'PREV':
      return reducePrev(structure, state);
    case 'GO_TO_SECTION':
      return reduceGoToSection(flow, state, action.index, action.visited);
    case 'QUIZ_DONE':
      return {
        phase: structure.disclaimerSection ? { phase: 'disclaimer' } : { phase: 'complete' },
        navDirection: 1,
        showChapterIntro: false,
      };
    case 'CHAPTER_QUIZ_DONE': {
      const nextChapterIndex = action.chapterIndex + 1;
      if (getChapterLessons(structure, nextChapterIndex).length > 0) {
        return {
          phase: { phase: 'chapter', chapterIndex: nextChapterIndex, lessonIndex: 0 },
          navDirection: 1,
          showChapterIntro: true,
        };
      }
      return {
        phase: postChapterPhase(structure),
        navDirection: 1,
        showChapterIntro: false,
      };
    }
    case 'DISMISS_CHAPTER_INTRO':
      return { ...state, showChapterIntro: false };
    case 'RESTART':
      return INITIAL_STATE;
  }
}

export function useCourseNavigation(
  flow: CourseFlow,
  visited?: Record<string, Set<string>>,
) {
  const structure = flow.structure;
  const [state, dispatch] = useReducer(
    (s: CourseNavState, a: CourseNavAction) => courseNavigationReducer(flow, s, a),
    INITIAL_STATE,
  );
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

  const nextLocked = useMemo(() => {
    return isLessonLocked(structure, state.phase, visited);
  }, [structure, state.phase, visited]);

  const goNext = useCallback(() => dispatch({ type: 'NEXT', visited }), [visited]);
  const goPrev = useCallback(() => dispatch({ type: 'PREV' }), []);
  const navigateToSection = useCallback(
    (index: number) => dispatch({ type: 'GO_TO_SECTION', index, visited }),
    [visited],
  );
  const navigateToSectionUnrestricted = useCallback(
    (index: number) => dispatch({ type: 'GO_TO_SECTION', index }),
    [],
  );
  const finishQuiz = useCallback(() => dispatch({ type: 'QUIZ_DONE' }), []);
  const finishChapterQuiz = useCallback(
    (chapterIndex: number) => dispatch({ type: 'CHAPTER_QUIZ_DONE', chapterIndex }),
    [],
  );
  const dismissChapterIntro = useCallback(() => dispatch({ type: 'DISMISS_CHAPTER_INTRO' }), []);
  const restart = useCallback(() => dispatch({ type: 'RESTART' }), []);

  return {
    phase: state.phase,
    navDirection: state.navDirection,
    showChapterIntro: state.showChapterIntro,
    showBurst,
    nextLocked,
    currentSectionIndex: getSectionIndex(flow, state.phase),
    goNext,
    goPrev,
    navigateToSection,
    navigateToSectionUnrestricted,
    finishQuiz,
    finishChapterQuiz,
    dismissChapterIntro,
    restart,
  };
}
