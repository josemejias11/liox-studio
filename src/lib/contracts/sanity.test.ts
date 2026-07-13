import { describe, expect, test } from 'vitest';

import { courseSchema, courseSummarySchema } from './sanity';

describe('course contracts', () => {
  test('accepts standard and canvas modes and defaults missing mode to standard', () => {
    const base = { _id: 'course-1', title: 'Course' };

    expect(courseSchema.parse(base).courseMode).toBe('standard');
    expect(courseSchema.parse({ ...base, courseMode: 'standard' }).courseMode).toBe('standard');
    expect(courseSchema.parse({ ...base, courseMode: 'canvas' }).courseMode).toBe('canvas');
  });

  test('defaults a course summary missing mode to standard', () => {
    expect(
      courseSummarySchema.parse({
        _id: 'course-1',
        title: 'Course',
        slug: { current: 'course' },
      }).courseMode,
    ).toBe('standard');
  });
});
