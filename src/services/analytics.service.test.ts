import { expect, test, describe } from 'vitest';
import { computeWeakTopics, type LessonTopicMeta, type LessonEngagementRow } from './analytics.service';

describe('computeWeakTopics', () => {
  const mockLessons: LessonTopicMeta[] = [
    { id: 'lesson-1', headline: 'L1', topics: ['topic-a', 'topic-b'] },
    { id: 'lesson-2', headline: 'L2', topics: ['topic-c', 'topic-d'] },
    { id: 'lesson-3', headline: 'L3', topics: ['topic-e', 'topic-f'] },
    { id: 'lesson-4', headline: 'L4', topics: ['topic-g', 'topic-h'] },
  ];

  test('empty engagement returns all topics from lessons', () => {
    const result = computeWeakTopics([], mockLessons);
    expect(result).toEqual([
      'topic-a', 'topic-b',
      'topic-c', 'topic-d',
      'topic-e', 'topic-f',
      'topic-g', 'topic-h'
    ]);
  });

  test('identifies weak topics for lessons below or at the median view count', () => {
    // view counts: lesson-1=10, lesson-2=2, lesson-3=5, lesson-4=8
    // sorted: 2, 5, 8, 10
    // median: (5 + 8) / 2 = 6.5
    // weak lessons (<= 6.5): lesson-2 (2), lesson-3 (5)
    // weak topics: topic-c, topic-d, topic-e, topic-f
    const engagement: LessonEngagementRow[] = [
      { lessonId: 'lesson-1', viewCount: 10 },
      { lessonId: 'lesson-2', viewCount: 2 },
      { lessonId: 'lesson-3', viewCount: 5 },
      { lessonId: 'lesson-4', viewCount: 8 },
    ];

    const result = computeWeakTopics(engagement, mockLessons);
    expect(result).toEqual(['topic-c', 'topic-d', 'topic-e', 'topic-f']);
  });

  test('includes lessons that have never been viewed (zero views)', () => {
    // view counts: lesson-1=10, lesson-3=12 (others are zero views)
    // sorted: 10, 12
    // median: 11
    // weak lessons by median (<= 11): lesson-1 (10)
    // zero view lessons: lesson-2, lesson-4
    // weak topics: topic-a, topic-b (from lesson-1), topic-c, topic-d (lesson-2), topic-g, topic-h (lesson-4)
    const engagement: LessonEngagementRow[] = [
      { lessonId: 'lesson-1', viewCount: 10 },
      { lessonId: 'lesson-3', viewCount: 12 },
    ];

    const result = computeWeakTopics(engagement, mockLessons);
    expect(result).toEqual([
      'topic-a', 'topic-b',
      'topic-c', 'topic-d',
      'topic-g', 'topic-h'
    ]);
  });

  test('caps the returned topics list to a maximum of 15', () => {
    const manyLessons: LessonTopicMeta[] = Array.from({ length: 20 }, (_, i) => ({
      id: `lesson-${i}`,
      headline: `L${i}`,
      topics: [`topic-${i}`],
    }));

    const result = computeWeakTopics([], manyLessons);
    expect(result).toHaveLength(15);
    expect(result[0]).toBe('topic-0');
    expect(result[14]).toBe('topic-14');
  });
});
