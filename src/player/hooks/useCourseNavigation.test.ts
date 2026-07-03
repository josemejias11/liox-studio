import { expect, test, describe } from 'vitest';
import { courseNavigationReducer, type CourseNavState } from './useCourseNavigation';
import { deriveCourseStructure } from '../../lib/course-structure';
import { lessonSchema, type LessonSection } from '../../lib/contracts/sanity';

describe('courseNavigationReducer', () => {
  // Built through the real schema so fixtures stay valid as the contract evolves.
  const makeLesson = (key: string, headline: string, hotspots?: Array<{ label: string }>): LessonSection => ({
    ...lessonSchema.parse({
      sectionType: 'lesson',
      _key: key,
      headline,
      hotspots: hotspots?.map((h, i) => ({ ...h, _key: `${key}-h-${i}` })),
    }),
    chapterIndex: 0,
    chapterTitle: 'Chapter 1',
  });

  const structure = deriveCourseStructure([
    makeLesson('lesson-1', 'Lesson 1'),
    makeLesson('lesson-2', 'Lesson 2'),
  ]);

  const structureWithHotspots = deriveCourseStructure([
    makeLesson('lesson-1', 'Lesson 1', [{ label: 'hotspot-1' }]),
    makeLesson('lesson-2', 'Lesson 2'),
  ]);

  const structureWithScrollStory = deriveCourseStructure([
    {
      ...lessonSchema.parse({
        sectionType: 'lesson',
        _key: 'lesson-scroll-story',
        headline: 'Scroll Story Lesson',
        lessonType: 'scrollStory',
      }),
      chapterIndex: 0,
      chapterTitle: 'Chapter 1',
    },
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

  test('NEXT from lesson-1 is blocked when hotspots are not visited', () => {
    const initialState: CourseNavState = {
      phase: { phase: 'chapter', chapterIndex: 0, lessonIndex: 0 },
      navDirection: 1,
      showChapterIntro: false,
    };
    const nextState = courseNavigationReducer(structureWithHotspots, initialState, {
      type: 'NEXT',
      visited: {},
    });
    expect(nextState.phase).toEqual({ phase: 'chapter', chapterIndex: 0, lessonIndex: 0 });
  });

  test('NEXT from lesson-1 goes to lesson-2 when hotspots are visited', () => {
    const initialState: CourseNavState = {
      phase: { phase: 'chapter', chapterIndex: 0, lessonIndex: 0 },
      navDirection: 1,
      showChapterIntro: false,
    };
    const nextState = courseNavigationReducer(structureWithHotspots, initialState, {
      type: 'NEXT',
      visited: { 'lesson-1': new Set(['hotspot-1']) },
    });
    expect(nextState.phase).toEqual({ phase: 'chapter', chapterIndex: 0, lessonIndex: 1 });
  });

  test('GO_TO_SECTION forward jump is blocked when current lesson is locked', () => {
    const initialState: CourseNavState = {
      phase: { phase: 'chapter', chapterIndex: 0, lessonIndex: 0 },
      navDirection: 1,
      showChapterIntro: false,
    };
    const nextState = courseNavigationReducer(structureWithHotspots, initialState, {
      type: 'GO_TO_SECTION',
      index: 1,
      visited: {},
    });
    expect(nextState.phase).toEqual({ phase: 'chapter', chapterIndex: 0, lessonIndex: 0 });
  });

  test('GO_TO_SECTION forward jump is allowed when current lesson is complete', () => {
    const initialState: CourseNavState = {
      phase: { phase: 'chapter', chapterIndex: 0, lessonIndex: 0 },
      navDirection: 1,
      showChapterIntro: false,
    };
    const nextState = courseNavigationReducer(structureWithHotspots, initialState, {
      type: 'GO_TO_SECTION',
      index: 1,
      visited: { 'lesson-1': new Set(['hotspot-1']) },
    });
    expect(nextState.phase).toEqual({ phase: 'chapter', chapterIndex: 0, lessonIndex: 1 });
  });

  test('NEXT from scrollStory lesson is blocked until it is marked completed', () => {
    const initialState: CourseNavState = {
      phase: { phase: 'chapter', chapterIndex: 0, lessonIndex: 0 },
      navDirection: 1,
      showChapterIntro: false,
    };

    const lockedState = courseNavigationReducer(structureWithScrollStory, initialState, {
      type: 'NEXT',
      visited: {},
    });
    expect(lockedState.phase).toEqual({ phase: 'chapter', chapterIndex: 0, lessonIndex: 0 });

    const unlockedState = courseNavigationReducer(structureWithScrollStory, initialState, {
      type: 'NEXT',
      visited: { 'lesson-scroll-story': new Set(['completed']) },
    });
    expect(unlockedState.phase).toEqual({ phase: 'chapter', chapterIndex: 0, lessonIndex: 1 });
  });
});
