import { expect, test, describe } from 'vitest';
import { courseNavigationReducer, type CourseNavState } from './useCourseNavigation';
import { deriveCourseStructure } from '../lib/course-structure';
import { lessonSchema, type LessonSection } from '../lib/contracts/sanity';

describe('courseNavigationReducer', () => {
  // Built through the real schema so fixtures stay valid as the contract evolves.
  const makeLesson = (key: string, headline: string): LessonSection => ({
    ...lessonSchema.parse({ sectionType: 'lesson', _key: key, headline }),
    chapterIndex: 0,
    chapterTitle: 'Chapter 1',
  });
  const structure = deriveCourseStructure([
    makeLesson('lesson-1', 'Lesson 1'),
    makeLesson('lesson-2', 'Lesson 2'),
  ]);

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
