import { describe, expect, test } from 'vitest';

import { getCoveredFeatureLabels, isRefresherComplete } from './refresher';

const refresherLesson = {
  coveredFeatures: [
    { _key: 'camera', label: 'Camera', summary: 'Review the camera controls.' },
    { _key: 'display', label: 'Display', summary: 'Review the display settings.' },
  ],
};

describe('refresher lesson completion', () => {
  test('returns the feature labels configured for a lesson', () => {
    expect(getCoveredFeatureLabels(refresherLesson)).toEqual(['Camera', 'Display']);
    expect(getCoveredFeatureLabels({})).toEqual([]);
  });

  test('requires every covered feature to be opened', () => {
    expect(isRefresherComplete(refresherLesson, new Set(['Camera']))).toBe(false);
    expect(isRefresherComplete(refresherLesson, new Set(['Camera', 'Display']))).toBe(true);
  });
});
