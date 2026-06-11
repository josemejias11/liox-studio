import { expect, test, describe } from 'vitest';
import {
  courseNavigationReducer,
  type CourseNavState,
  type CoursePhase,
} from './useCourseNavigation';
import { deriveCourseStructure, type CourseStructure } from '../lib/course-structure';
import type { LessonSection } from '../lib/contracts/sanity';

describe('courseNavigationReducer', () => {
  const mockLesson1: LessonSection = {
    sectionType: 'lesson',
    headline: 'Lesson 1',
    chapterIndex: 0,
    chapterTitle: 'Chapter 1',
  } as any;
  const mockLesson2: LessonSection = {
    sectionType: 'lesson',
    headline: 'Lesson 2',
    chapterIndex: 0,
    chapterTitle: 'Chapter 1',
  } as any;
  // @ts-ignore
  const structure = deriveCourseStructure([mockLesson1, mockLesson2]);

  test('NEXT from cover goes to first lesson', () => {
    const initialState: CourseNavState = {
      phase: { phase: 'cover' },
      navDirection: 1,
      showChapterIntro: false,
    };
    const nextState = courseNavigationReducer(structure, initialState, { type: 'NEXT' });
    expect(nextState.phase).toEqual({ phase: 'chapter', chapterIndex: 0, lessonIndex: 0 });
    expect(nextState.showChapterIntro).toBe(true);
  });

  test('NEXT from first lesson goes to second lesson', () => {
    const initialState: CourseNavState = {
      phase: { phase: 'chapter', chapterIndex: 0, lessonIndex: 0 },
      navDirection: 1,
      showChapterIntro: false,
    };
    const nextState = courseNavigationReducer(structure, initialState, { type: 'NEXT' });
    expect(nextState.phase).toEqual({ phase: 'chapter', chapterIndex: 0, lessonIndex: 1 });
  });

  test('PREV from second lesson goes to first lesson', () => {
    const initialState: CourseNavState = {
      phase: { phase: 'chapter', chapterIndex: 0, lessonIndex: 1 },
      navDirection: 1,
      showChapterIntro: false,
    };
    const nextState = courseNavigationReducer(structure, initialState, { type: 'PREV' });
    expect(nextState.phase).toEqual({ phase: 'chapter', chapterIndex: 0, lessonIndex: 0 });
    expect(nextState.navDirection).toBe(-1);
  });
});
