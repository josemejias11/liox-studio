import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
  loadSessionProgress,
  recordHotspots,
  recordLessonView,
  type ProgressStoreDb,
} from './progress-store';

function createDb() {
  const tx = {
    session: { upsert: vi.fn().mockResolvedValue(undefined) },
    lessonProgress: { upsert: vi.fn().mockResolvedValue(undefined) },
    hotspotVisit: { upsert: vi.fn().mockResolvedValue(undefined) },
  };

  const db: ProgressStoreDb = {
    lessonProgress: { findMany: vi.fn().mockResolvedValue([]) },
    hotspotVisit: { findMany: vi.fn().mockResolvedValue([]) },
    $transaction: vi.fn(async (callback) => callback(tx)),
  };

  return { db, tx };
}

describe('progress-store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('loadSessionProgress merges lesson completion and hotspot visits', async () => {
    const { db } = createDb();

    vi.mocked(db.lessonProgress.findMany).mockResolvedValue([
      { lessonId: 'lesson-1', completed: true },
      { lessonId: 'lesson-2', completed: false },
    ]);
    vi.mocked(db.hotspotVisit.findMany).mockResolvedValue([
      { lessonId: 'lesson-1', label: 'engine' },
      { lessonId: 'lesson-1', label: 'engine' },
      { lessonId: 'lesson-3', label: 'battery' },
    ]);

    await expect(loadSessionProgress('session-1', db)).resolves.toEqual({
      lessons: {
        'lesson-1': { visitedHotspots: ['engine'], completed: true },
        'lesson-2': { visitedHotspots: [], completed: false },
        'lesson-3': { visitedHotspots: ['battery'], completed: false },
      },
    });
  });

  test('recordLessonView increments lesson view count', async () => {
    const { db, tx } = createDb();

    await recordLessonView(
      { sessionId: 'session-1', lessonId: 'lesson-1', courseId: 'course-1' },
      db,
    );

    expect(tx.session.upsert).toHaveBeenCalledTimes(1);
    expect(tx.lessonProgress.upsert).toHaveBeenCalledWith({
      where: { sessionId_lessonId: { sessionId: 'session-1', lessonId: 'lesson-1' } },
      update: {
        courseId: 'course-1',
        viewCount: { increment: 1 },
      },
      create: {
        sessionId: 'session-1',
        lessonId: 'lesson-1',
        courseId: 'course-1',
      },
    });
  });

  test('recordHotspots does not increment lesson view count unless asked to record a view', async () => {
    const { db, tx } = createDb();

    await recordHotspots(
      {
        sessionId: 'session-1',
        lessonId: 'lesson-1',
        courseId: 'course-1',
        visitedHotspots: ['engine', 'battery'],
        completed: true,
      },
      db,
    );

    expect(tx.lessonProgress.upsert).toHaveBeenNthCalledWith(1, {
      where: { sessionId_lessonId: { sessionId: 'session-1', lessonId: 'lesson-1' } },
      update: {
        completed: true,
        courseId: 'course-1',
      },
      create: {
        sessionId: 'session-1',
        lessonId: 'lesson-1',
        courseId: 'course-1',
        completed: true,
      },
    });
    expect(tx.hotspotVisit.upsert).toHaveBeenCalledTimes(2);

    await recordHotspots(
      {
        sessionId: 'session-1',
        lessonId: 'lesson-1',
        visitedHotspots: ['engine'],
        recordView: true,
      },
      db,
    );

    expect(tx.lessonProgress.upsert).toHaveBeenNthCalledWith(2, {
      where: { sessionId_lessonId: { sessionId: 'session-1', lessonId: 'lesson-1' } },
      update: {
        completed: false,
        courseId: '',
        viewCount: { increment: 1 },
      },
      create: {
        sessionId: 'session-1',
        lessonId: 'lesson-1',
        courseId: '',
        completed: false,
      },
    });
  });
});
