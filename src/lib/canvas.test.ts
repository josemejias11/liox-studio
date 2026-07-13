import { describe, expect, test } from 'vitest';

import { clampCanvasZoom, getRequiredCanvasTargetCount, isCanvasComplete } from './canvas';

const canvasLesson = {
  lessonType: 'canvas' as const,
  hotspots: [
    { _key: 'camera', label: 'Camera', required: true },
    { _key: 'display', label: 'Display', required: true },
    { _key: 'finish', label: 'Finish', required: false },
  ],
};

describe('Canvas lesson completion', () => {
  test('counts only required feature targets', () => {
    expect(getRequiredCanvasTargetCount(canvasLesson)).toBe(2);
  });

  test('requires every required target but ignores optional targets', () => {
    expect(isCanvasComplete(canvasLesson, new Set(['Finish']))).toBe(false);
    expect(isCanvasComplete(canvasLesson, new Set(['Camera', 'Display']))).toBe(true);
  });

  test('clamps image inspection zoom from 1x through 3x', () => {
    expect(clampCanvasZoom(0.5)).toBe(1);
    expect(clampCanvasZoom(1.25)).toBe(1.25);
    expect(clampCanvasZoom(4)).toBe(3);
  });
});
