import { describe, expect, test } from 'vitest';
import { deriveCourseStructure } from '@/lib/course-structure';
import { lessonSchema, type LessonSection } from '@/lib/contracts/sanity';
import {
  deriveSessionWeakTopics,
  mergeWeakTopics,
} from './useWeakTopics';

type HotspotFixture = {
  _key?: string;
  label: string;
  topic?: string;
};

const makeLesson = (
  key: string,
  headline: string,
  hotspots: HotspotFixture[] = [],
): LessonSection => ({
  ...lessonSchema.parse({
    sectionType: 'lesson',
    _key: key,
    headline,
    hotspots: hotspots.map((hotspot, index) => ({
      ...hotspot,
      _key: hotspot._key ?? `${key}-h-${index + 1}`,
    })),
  }),
  chapterIndex: 0,
  chapterTitle: 'Chapter 1',
});

describe('deriveSessionWeakTopics', () => {
  test('collects unique unvisited hotspot topics and falls back to labels', () => {
    const structure = deriveCourseStructure([
      makeLesson('lesson-1', 'Intro', [
        { _key: 'h-1', label: 'ABS', topic: ' Brakes ' },
        { _key: 'h-2', label: 'Helmet', topic: '' },
      ]),
      makeLesson('lesson-2', 'Cornering', [
        { _key: 'h-3', label: 'Countersteer', topic: 'Brakes' },
      ]),
    ]);

    expect(
      deriveSessionWeakTopics(structure.lessonSections, {
        'lesson-1': new Set(['ABS']),
      }),
    ).toEqual(['Helmet', 'Brakes']);
  });

  test('limits session weak topics to ten entries', () => {
    const structure = deriveCourseStructure(
      Array.from({ length: 12 }, (_, index) =>
        makeLesson(`lesson-${index + 1}`, `Lesson ${index + 1}`, [
          { _key: `h-${index + 1}`, label: `Topic ${index + 1}` },
        ]),
      ),
    );

    expect(deriveSessionWeakTopics(structure.lessonSections, {})).toHaveLength(10);
  });
});

describe('mergeWeakTopics', () => {
  test('returns merged unique topics only during quiz phases', () => {
    expect(mergeWeakTopics(true, ['Brakes', 'Helmet'], ['Helmet', 'Throttle'])).toEqual([
      'Brakes',
      'Helmet',
      'Throttle',
    ]);
    expect(mergeWeakTopics(false, ['Brakes'], ['Throttle'])).toEqual([]);
  });

  test('limits merged weak topics to fifteen entries', () => {
    const sessionTopics = Array.from({ length: 10 }, (_, index) => `Session ${index + 1}`);
    const apiTopics = Array.from({ length: 10 }, (_, index) => `API ${index + 1}`);

    expect(mergeWeakTopics(true, sessionTopics, apiTopics)).toHaveLength(15);
  });
});
