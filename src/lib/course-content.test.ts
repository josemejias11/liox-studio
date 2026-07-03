import { describe, expect, test } from 'vitest';

import { normalizeCourseContent } from './course-content';

const makeRaw = () => ({
  _id: 'course-1',
  title: 'Moto Safety',
  description: 'A safety course',
  chapters: [
    {
      _id: 'ch-1',
      title: 'Chapter One',
      estimatedDuration: 10,
      lessons: [
        {
          sectionType: 'lesson' as const,
          _key: 'les-1',
          headline: 'Lesson A',
          lessonType: 'content' as const,
        },
        {
          sectionType: 'lesson' as const,
          _key: 'les-2',
          headline: 'Lesson B',
          lessonType: 'interaction' as const,
        },
      ],
    },
    {
      _id: 'ch-2',
      title: 'Chapter Two',
      estimatedDuration: 5,
      lessons: [
        {
          sectionType: 'lesson' as const,
          _key: 'les-3',
          headline: 'Lesson C',
          lessonType: 'stage' as const,
        },
      ],
    },
  ],
  specifications: [
    {
      sectionType: 'specification' as const,
      _key: 'spec-1',
      title: 'Specs',
      specGroups: [],
    },
  ],
  disclaimer: {
    sectionType: 'disclaimer' as const,
    _key: 'disc-1',
    title: 'Safety Notice',
    body: 'Be careful.',
  },
});

describe('normalizeCourseContent', () => {
  test('returns null for invalid payload', () => {
    const result = normalizeCourseContent({ invalid: true });
    expect(result).toBeNull();
  });

  test('enriches lessons with chapterTitle and chapterIndex', () => {
    const content = normalizeCourseContent(makeRaw());
    expect(content).not.toBeNull();

    const sections = content!.sections;
    const lessons = sections.filter((s) => s.sectionType === 'lesson');

    expect(lessons).toHaveLength(3);
    expect(lessons[0]).toHaveProperty('chapterTitle', 'Chapter One');
    expect(lessons[0]).toHaveProperty('chapterIndex', 0);
    expect(lessons[1]).toHaveProperty('chapterTitle', 'Chapter One');
    expect(lessons[1]).toHaveProperty('chapterIndex', 0);
    expect(lessons[2]).toHaveProperty('chapterTitle', 'Chapter Two');
    expect(lessons[2]).toHaveProperty('chapterIndex', 1);
  });

  test('orders sections as lessons then specifications then disclaimer', () => {
    const content = normalizeCourseContent(makeRaw());
    expect(content).not.toBeNull();

    const types = content!.sections.map((s) => s.sectionType);
    expect(types).toEqual([
      'lesson', 'lesson', 'lesson',
      'specification',
      'disclaimer',
    ]);
  });

  test('handles missing chapters gracefully', () => {
    const raw = { _id: 'course-2', title: 'Empty' };
    const content = normalizeCourseContent(raw);
    expect(content).not.toBeNull();
    expect(content!.sections).toEqual([]);
    expect(content!.course.chapters).toBeUndefined();
  });
});
