import { prisma } from '@moto-ai/database';

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

function toSessionData(sessions: Awaited<ReturnType<typeof fetchRecentSessions>>): SessionData[] {
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

async function getLessonEngagement(courseId: string): Promise<LessonEngagementRow[]> {
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

async function getAllLessonEngagement(): Promise<LessonEngagementRow[]> {
  const rows = await prisma.lessonProgress.groupBy({
    by: ['lessonId'],
    _sum: { viewCount: true },
    orderBy: { _sum: { viewCount: 'asc' } },
  });
  return rows.map((r) => ({ lessonId: r.lessonId, viewCount: r._sum.viewCount ?? 0 }));
}

export async function getAnalyticsData() {
  try {
    const [
      sessions,
      allQuizzes,
      totalHotspotsVisited,
      topHotspots,
      totalSessions,
      lessonEngagement,
    ] = await Promise.all([
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

export type LessonTopicMeta = {
  id: string;
  headline: string;
  topics: string[];
};

export type WeakTopicsResult = {
  weakTopics: string[];
  engagement: LessonEngagementRow[];
};

function computeWeakTopics(
  engagement: LessonEngagementRow[],
  lessons: LessonTopicMeta[],
): string[] {
  if (engagement.length === 0) {
    const topicSet = new Set<string>();
    for (const l of lessons) {
      for (const t of l.topics) {
        if (t.trim()) topicSet.add(t.trim());
      }
    }
    return Array.from(topicSet).slice(0, 15);
  }

  const counts = engagement.map((e) => e.viewCount).sort((a, b) => a - b);
  const mid = Math.floor(counts.length / 2);
  const median = counts.length % 2 === 0 ? (counts[mid - 1] + counts[mid]) / 2 : counts[mid];

  const weakIds = new Set(engagement.filter((e) => e.viewCount <= median).map((e) => e.lessonId));

  const seenIds = new Set(engagement.map((e) => e.lessonId));
  for (const l of lessons) {
    if (!seenIds.has(l.id)) weakIds.add(l.id);
  }

  const lessonMap = new Map(lessons.map((l) => [l.id, l]));
  const topicSet = new Set<string>();
  for (const id of weakIds) {
    const meta = lessonMap.get(id);
    if (!meta) continue;
    for (const t of meta.topics) {
      if (t.trim()) topicSet.add(t.trim());
    }
  }

  return Array.from(topicSet).slice(0, 15);
}

export async function getWeakTopicsForCourse(
  courseId: string,
  lessons: LessonTopicMeta[],
): Promise<WeakTopicsResult> {
  const engagement = await getLessonEngagement(courseId);
  const weakTopics = computeWeakTopics(engagement, lessons);
  return { weakTopics, engagement };
}
