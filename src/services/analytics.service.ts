import { prisma } from '@/lib/db';

// ── Types ─────────────────────────────────────────────────────────────────────

export type LessonEngagementRow = { lessonId: string; viewCount: number };

type SessionData = {
  id: string;
  lessonCount: number;
  hotspotsVisited: number;
  hasCompletion: boolean;
  lastActivity: Date;
};

type ScoreBucket = { label: string; count: number; color: string };

type QuizRow = { score: number; total: number };

// ── Pure helpers ──────────────────────────────────────────────────────────────

function toSessionData(
  sessions: Awaited<ReturnType<typeof fetchRecentSessions>>,
): SessionData[] {
  return sessions.map((s) => ({
    id: s.id,
    lessonCount: s._count.progress,
    hotspotsVisited: s._count.hotspots,
    hasCompletion: s.progress.length > 0,
    lastActivity: s.updatedAt,
  }));
}

function computeAverageQuizPct(quizzes: QuizRow[]): number | null {
  if (quizzes.length === 0) return null;
  const sum = quizzes.reduce((acc, q) => acc + q.score / q.total, 0);
  return Math.round((sum / quizzes.length) * 100);
}

function buildScoreBuckets(quizzes: QuizRow[]): ScoreBucket[] {
  const pct = (q: QuizRow) => q.score / q.total;
  return [
    {
      label: 'Perfect (100%)',
      count: quizzes.filter((q) => q.score === q.total).length,
      color: 'bg-accent',
    },
    {
      label: 'Great (≥ 80%)',
      count: quizzes.filter((q) => pct(q) >= 0.8 && q.score < q.total).length,
      color: 'bg-muted',
    },
    {
      label: 'Good (≥ 60%)',
      count: quizzes.filter((q) => pct(q) >= 0.6 && pct(q) < 0.8).length,
      color: 'bg-muted',
    },
    {
      label: 'Below 60%',
      count: quizzes.filter((q) => pct(q) < 0.6).length,
      color: 'bg-background',
    },
  ];
}

// ── DB fetchers (grouped for single Promise.all) ──────────────────────────────

function fetchRecentSessions() {
  return prisma.session.findMany({
    orderBy: { updatedAt: 'desc' },
    include: {
      _count: { select: { progress: true, hotspots: true } },
      progress: { where: { completed: true }, take: 1 },
    },
    take: 12,
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Return lesson engagement aggregated by lesson, ordered ascending by view
 * count (least-viewed first — used for weak-topic detection).
 *
 * @param courseId - Required. Pass an explicit course ID; use
 *   `getAllLessonEngagement` when you need cross-course data.
 */
export async function getLessonEngagement(courseId: string): Promise<LessonEngagementRow[]> {
  if (!courseId) {
    throw new Error('getLessonEngagement requires a non-empty courseId');
  }
  const rows = await prisma.lessonProgress.groupBy({
    by: ['lessonId'],
    where: { courseId },
    _sum: { viewCount: true },
    orderBy: { _sum: { viewCount: 'asc' } },
  });
  return rows.map((r) => ({ lessonId: r.lessonId, viewCount: r._sum.viewCount ?? 0 }));
}

/**
 * Return lesson engagement across ALL courses.
 * Prefer `getLessonEngagement(courseId)` when a specific course is known.
 */
export async function getAllLessonEngagement(): Promise<LessonEngagementRow[]> {
  const rows = await prisma.lessonProgress.groupBy({
    by: ['lessonId'],
    _sum: { viewCount: true },
    orderBy: { _sum: { viewCount: 'asc' } },
  });
  return rows.map((r) => ({ lessonId: r.lessonId, viewCount: r._sum.viewCount ?? 0 }));
}

export async function getAnalyticsData() {
  try {
    const [sessions, allQuizzes, totalHotspotsVisited, topHotspots, totalSessions, lessonEngagement] =
      await Promise.all([
        fetchRecentSessions(),
        prisma.quizAttempt.findMany({ select: { score: true, total: true } }),
        prisma.hotspotVisit.count(),
        prisma.hotspotVisit.groupBy({
          by: ['label'],
          _count: { label: true },
          orderBy: { _count: { label: 'desc' } },
          take: 8,
        }),
        prisma.session.count(),
        getAllLessonEngagement(),
      ]);

    return {
      totalSessions,
      totalHotspotsVisited,
      topHotspots: topHotspots.map((h) => ({ label: h.label, count: h._count.label })),
      avgQuizPct: computeAverageQuizPct(allQuizzes),
      scoreBuckets: buildScoreBuckets(allQuizzes),
      recentSessions: toSessionData(sessions),
      totalQuizzes: allQuizzes.length,
      lessonEngagement,
    };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Database error';
    throw new Error(`Analytics data unavailable: ${message}`);
  }
}
