import Link from "next/link";
import { Bot, Users, Zap, Trophy, BookOpen, ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";

// ── Helpers ────────────────────────────────────────────────────────────────

function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  accent: string;
}) {
  return (
    <div className="bg-zinc-900 border border-white/8 rounded-2xl px-5 py-5 flex flex-col gap-2.5">
      <Icon className={`h-4 w-4 ${accent}`} aria-hidden="true" />
      <p className={`text-[32px] font-bold tabular-nums leading-none ${accent}`}>{value}</p>
      <p className="text-[10px] text-white/30 font-semibold uppercase tracking-widest">{label}</p>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default async function AnalyticsPage() {
  const [allProgress, allQuizzes] = await Promise.all([
    prisma.slideProgress.findMany({ orderBy: { updatedAt: "desc" } }),
    prisma.quizAttempt.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  // ── Aggregate per-session ────────────────────────────────────────────────
  type SessionData = {
    slides: Set<string>;
    hotspotsVisited: number;
    hasCompletion: boolean;
    lastActivity: Date;
  };
  const sessionMap = new Map<string, SessionData>();
  const hotspotCounts = new Map<string, number>();

  for (const r of allProgress) {
    const hotspots = JSON.parse(r.visitedHotspots) as string[];

    if (!sessionMap.has(r.sessionId)) {
      sessionMap.set(r.sessionId, {
        slides: new Set(),
        hotspotsVisited: 0,
        hasCompletion: false,
        lastActivity: r.updatedAt,
      });
    }
    const s = sessionMap.get(r.sessionId)!;
    s.slides.add(r.slideId);
    s.hotspotsVisited += hotspots.length;
    if (r.completed) s.hasCompletion = true;
    if (r.updatedAt > s.lastActivity) s.lastActivity = r.updatedAt;

    for (const label of hotspots) {
      hotspotCounts.set(label, (hotspotCounts.get(label) ?? 0) + 1);
    }
  }

  const totalSessions = sessionMap.size;
  const totalHotspotsVisited = allProgress.reduce(
    (sum, r) => sum + (JSON.parse(r.visitedHotspots) as string[]).length,
    0,
  );

  const topHotspots = [...hotspotCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, count]) => ({ label, count }));
  const maxCount = topHotspots[0]?.count ?? 1;

  const avgQuizPct =
    allQuizzes.length > 0
      ? Math.round(
          (allQuizzes.reduce((sum, q) => sum + q.score / q.total, 0) / allQuizzes.length) * 100,
        )
      : null;

  const scoreBuckets = [
    { label: "Perfect (100%)", count: allQuizzes.filter((q) => q.score === q.total).length,                                                    color: "bg-amber-400"  },
    { label: "Great (≥ 80%)",  count: allQuizzes.filter((q) => q.score / q.total >= 0.8 && q.score < q.total).length,                         color: "bg-sky-400"    },
    { label: "Good (≥ 60%)",   count: allQuizzes.filter((q) => q.score / q.total >= 0.6 && q.score / q.total < 0.8).length,                   color: "bg-emerald-400"},
    { label: "Below 60%",      count: allQuizzes.filter((q) => q.score / q.total < 0.6).length,                                               color: "bg-zinc-600"   },
  ];

  const recentSessions = [...sessionMap.entries()]
    .sort((a, b) => b[1].lastActivity.getTime() - a[1].lastActivity.getTime())
    .slice(0, 12)
    .map(([id, data]) => ({
      id,
      slideCount: data.slides.size,
      hotspotsVisited: data.hotspotsVisited,
      hasCompletion: data.hasCompletion,
      lastActivity: relativeTime(data.lastActivity),
    }));

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b border-white/8 bg-zinc-950/95 backdrop-blur-sm px-6">
        <div className="flex items-center gap-2 font-semibold text-lg text-primary">
          <Bot className="h-6 w-6" aria-hidden="true" />
          <span>DeckTutor AI</span>
        </div>
        <span className="text-white/20 select-none">·</span>
        <span className="text-white/45 text-sm font-medium">Instructor Dashboard</span>

        <div className="ml-auto">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-white/40 hover:text-white text-[12px] font-medium
              px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 hover:bg-white/[0.04]
              transition-all duration-150"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Course Player
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 flex flex-col gap-8">

        {totalSessions === 0 ? (
          /* ── Empty state ── */
          <div className="flex flex-col items-center justify-center py-32 gap-4 text-center">
            <Users className="h-10 w-10 text-white/10" aria-hidden="true" />
            <p className="text-white/40 text-base font-medium">No learner activity yet.</p>
            <p className="text-white/20 text-sm">Share the course link to start tracking progress.</p>
            <Link href="/" className="mt-2 text-sky-400 text-sm hover:underline transition-colors">
              Open Course →
            </Link>
          </div>
        ) : (
          <>
            {/* ── Stat cards ── */}
            <section aria-label="Summary statistics">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatCard icon={Users}    label="Sessions"          value={totalSessions}        accent="text-sky-400"    />
                <StatCard icon={Zap}      label="Features Explored" value={totalHotspotsVisited} accent="text-emerald-400" />
                <StatCard icon={Trophy}   label="Avg Quiz Score"    value={avgQuizPct !== null ? `${avgQuizPct}%` : "—"} accent="text-amber-400" />
                <StatCard icon={BookOpen} label="Quiz Attempts"     value={allQuizzes.length}    accent="text-purple-400" />
              </div>
            </section>

            {/* ── Charts row ── */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">

              {/* Top features bar chart */}
              <section
                aria-label="Top features explored"
                className="bg-zinc-900 border border-white/8 rounded-2xl p-6 flex flex-col gap-5"
              >
                <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/25">
                  Top Features Explored
                </h2>

                {topHotspots.length === 0 ? (
                  <p className="text-white/20 text-sm italic">No hotspot data yet.</p>
                ) : (
                  <ul className="flex flex-col gap-3" role="list">
                    {topHotspots.map(({ label, count }) => (
                      <li key={label} className="flex items-center gap-3">
                        <span className="text-white/50 text-[12px] w-36 truncate shrink-0">{label}</span>
                        <div
                          className="flex-1 bg-white/[0.05] rounded-full h-1.5 overflow-hidden"
                          role="progressbar"
                          aria-valuenow={count}
                          aria-valuemax={maxCount}
                          aria-label={`${label}: ${count} visits`}
                        >
                          <div
                            className="h-full bg-emerald-400 rounded-full transition-[width] duration-700"
                            style={{ width: `${Math.round((count / maxCount) * 100)}%` }}
                          />
                        </div>
                        <span className="text-white/25 text-[11px] w-5 text-right tabular-nums shrink-0">
                          {count}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Quiz breakdown */}
              <section
                aria-label="Quiz statistics"
                className="bg-zinc-900 border border-white/8 rounded-2xl p-6 flex flex-col gap-5"
              >
                <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/25">
                  Quiz Breakdown
                </h2>

                {allQuizzes.length === 0 ? (
                  <p className="text-white/20 text-sm italic">No quiz attempts yet.</p>
                ) : (
                  <div className="flex flex-col gap-5">
                    <div>
                      <p className="text-[42px] font-bold text-amber-400 tabular-nums leading-none">
                        {avgQuizPct}%
                      </p>
                      <p className="text-white/25 text-[11px] mt-1">average score</p>
                    </div>

                    <div className="h-px bg-white/8" />

                    <ul className="flex flex-col gap-2.5" role="list">
                      {scoreBuckets.map(({ label, count, color }) => (
                        <li key={label} className="flex items-center gap-2.5">
                          <span className={`h-2 w-2 rounded-full shrink-0 ${color}`} aria-hidden="true" />
                          <span className="text-[11px] text-white/40 flex-1">{label}</span>
                          <span className="text-[11px] text-white/30 tabular-nums font-semibold">{count}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            </div>

            {/* ── Recent sessions table ── */}
            <section aria-label="Recent learner sessions">
              <div className="bg-zinc-900 border border-white/8 rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-white/[0.06]">
                  <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/25">
                    Recent Sessions
                  </h2>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left" role="table">
                    <thead>
                      <tr className="border-b border-white/[0.05]">
                        {["Session ID", "Slides", "Features", "Status", "Last Active"].map((h) => (
                          <th
                            key={h}
                            scope="col"
                            className="px-6 py-3 text-[10px] font-semibold uppercase tracking-wider text-white/20"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {recentSessions.map((s) => (
                        <tr
                          key={s.id}
                          className="border-b border-white/[0.035] hover:bg-white/[0.02] transition-colors"
                        >
                          <td className="px-6 py-3">
                            <code className="text-[11px] text-white/35 font-mono">
                              {s.id.slice(0, 8)}…
                            </code>
                          </td>
                          <td className="px-6 py-3 text-[12px] text-white/55 tabular-nums">
                            {s.slideCount}
                          </td>
                          <td className="px-6 py-3 text-[12px] text-emerald-400 tabular-nums font-semibold">
                            {s.hotspotsVisited}
                          </td>
                          <td className="px-6 py-3">
                            <span
                              className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border
                                ${s.hasCompletion
                                  ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/25"
                                  : "text-white/25 bg-white/[0.04] border-white/10"
                                }`}
                            >
                              {s.hasCompletion ? "Active" : "Started"}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-[12px] text-white/25">
                            {s.lastActivity}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
