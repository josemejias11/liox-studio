import { prisma } from "@/lib/db";

type SessionData = {
  id: string;
  lessonCount: number;
  hotspotsVisited: number;
  hasCompletion: boolean;
  lastActivity: Date;
};

export async function getAnalyticsData() {
  const [sessions, allQuizzes, totalHotspotsVisited, topHotspots] = await Promise.all([
    // Get all sessions with their counts
    prisma.session.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        _count: { select: { progress: true, hotspots: true } },
        progress: {
          where: { completed: true },
          take: 1,
        },
      },
      take: 12,
    }),

    // Get all quiz attempts for averages
    prisma.quizAttempt.findMany({
      select: { score: true, total: true },
    }),

    // Total hotspot visits globally
    prisma.hotspotVisit.count(),

    // Top hotspots by grouping
    prisma.hotspotVisit.groupBy({
      by: ["label"],
      _count: { label: true },
      orderBy: { _count: { label: "desc" } },
      take: 8,
    }),
  ]);

  const totalSessions = await prisma.session.count();

  const recentSessions: SessionData[] = sessions.map((s) => ({
    id: s.id,
    lessonCount: s._count.progress,
    hotspotsVisited: s._count.hotspots,
    hasCompletion: s.progress.length > 0,
    lastActivity: s.updatedAt,
  }));

  const avgQuizPct =
    allQuizzes.length > 0
      ? Math.round(
          (allQuizzes.reduce((sum, q) => sum + q.score / q.total, 0) / allQuizzes.length) * 100
        )
      : null;

  const scoreBuckets = [
    { label: "Perfect (100%)", count: allQuizzes.filter((q) => q.score === q.total).length, color: "bg-accent" },
    { label: "Great (≥ 80%)", count: allQuizzes.filter((q) => q.score / q.total >= 0.8 && q.score < q.total).length, color: "bg-muted" },
    { label: "Good (≥ 60%)", count: allQuizzes.filter((q) => q.score / q.total >= 0.6 && q.score / q.total < 0.8).length, color: "bg-muted" },
    { label: "Below 60%", count: allQuizzes.filter((q) => q.score / q.total < 0.6).length, color: "bg-background" },
  ];

  return {
    totalSessions,
    totalHotspotsVisited,
    topHotspots: topHotspots.map((h) => ({ label: h.label, count: h._count.label })),
    avgQuizPct,
    scoreBuckets,
    recentSessions,
    totalQuizzes: allQuizzes.length,
  };
}
