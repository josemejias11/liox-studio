import { describe, expect, test } from 'vitest';

import {
  ALL_LESSON_TYPES,
  STANDARD_LESSON_TYPES,
  CANVAS_LESSON_TYPES,
} from './course-modes';

describe('course lesson classification', () => {
  test('classifies every lesson type exactly once', () => {
    const allClassified = [...STANDARD_LESSON_TYPES, ...CANVAS_LESSON_TYPES];

    expect(new Set(allClassified).size).toBe(allClassified.length);
    expect(new Set(allClassified)).toEqual(new Set(ALL_LESSON_TYPES));
    expect(allClassified).toHaveLength(10);
  });

  test('adds Canvas as a lesson capability without reclassifying legacy lessons', () => {
    expect(CANVAS_LESSON_TYPES).toEqual(['canvas']);
    expect(STANDARD_LESSON_TYPES).toContain('dragDrop');
    expect(STANDARD_LESSON_TYPES).toContain('colorSwitcher');
    expect(STANDARD_LESSON_TYPES).toContain('scrollStory');
  });
});
