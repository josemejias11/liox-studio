import Link from 'next/link';
import { Bot, Users, Zap, Trophy, BookOpen, ArrowLeft } from 'lucide-react';
import { getAnalyticsData } from '@/services/analytics.service';
import React from 'react';

// Always render fresh data — without this the dashboard would be frozen at
// build time. TODO(auth): gate this instructor dashboard behind authentication
// in a later phase; it is currently public.
export const dynamic = 'force-dynamic';

// ── Helpers ────────────────────────────────────────────────────────────────

function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
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
    <div className="bg-background border-border/8 flex flex-col gap-2.5 rounded-2xl border px-5 py-5">
      <Icon className={`h-4 w-4 ${accent}`} aria-hidden="true" />
      <p className={`text-[32px] leading-none font-bold tabular-nums ${accent}`}>{value}</p>
      <p className="text-foreground/30 text-[10px] font-semibold tracking-widest uppercase">
        {label}
      </p>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default async function AnalyticsPage() {
  const {
    totalSessions,
    totalHotspotsVisited,
    topHotspots,
    avgQuizPct,
    scoreBuckets,
    recentSessions,
    totalQuizzes,
  } = await getAnalyticsData();

  const maxCount = topHotspots[0]?.count ?? 1;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="bg-background text-foreground min-h-screen">
      {/* Header */}
      <header className="border-border bg-background/95 sticky top-0 z-10 flex h-16 items-center gap-3 border-b px-6 backdrop-blur-sm">
        <div className="text-primary flex items-center gap-2 text-lg font-semibold">
          <Bot className="h-6 w-6" aria-hidden="true" />
          <span>Moto Tutor AI</span>
        </div>
        <span className="text-muted-foreground select-none">·</span>
        <span className="text-muted-foreground text-sm font-medium">Instructor Dashboard</span>

        <div className="ml-auto">
          <Link
            href="/"
            className="text-muted-foreground hover:text-foreground border-border hover:bg-accent flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-150"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Course Player
          </Link>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-8">
        {totalSessions === 0 ? (
          /* ── Empty state ── */
          <div className="flex flex-col items-center justify-center gap-4 py-32 text-center">
            <Users className="text-muted-foreground h-10 w-10" aria-hidden="true" />
            <p className="text-muted-foreground text-base font-medium">No learner activity yet.</p>
            <p className="text-muted-foreground/50 text-sm">
              Share the course link to start tracking progress.
            </p>
            <Link href="/" className="text-primary mt-2 text-sm transition-colors hover:underline">
              Open Course →
            </Link>
          </div>
        ) : (
          <>
            {/* ── Stat cards ── */}
            <section aria-label="Summary statistics">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatCard
                  icon={Users}
                  label="Sessions"
                  value={totalSessions}
                  accent="text-accent"
                />
                <StatCard
                  icon={Zap}
                  label="Features Explored"
                  value={totalHotspotsVisited}
                  accent="text-accent"
                />
                <StatCard
                  icon={Trophy}
                  label="Avg Quiz Score"
                  value={avgQuizPct !== null ? `${avgQuizPct}%` : '—'}
                  accent="text-muted-foreground"
                />
                <StatCard
                  icon={BookOpen}
                  label="Quiz Attempts"
                  value={totalQuizzes}
                  accent="text-muted-foreground"
                />
              </div>
            </section>

            {/* ── Charts row ── */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
              {/* Top features bar chart */}
              <section
                aria-label="Top features explored"
                className="bg-card border-border flex flex-col gap-5 rounded-2xl border p-6"
              >
                <h2 className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                  Top Features Explored
                </h2>

                {topHotspots.length === 0 ? (
                  <p className="text-muted-foreground text-sm italic">No hotspot data yet.</p>
                ) : (
                  <ul className="flex flex-col gap-3" role="list">
                    {topHotspots.map(({ label, count }) => (
                      <li key={label} className="flex items-center gap-3">
                        <span className="text-muted-foreground w-36 shrink-0 truncate text-xs">
                          {label}
                        </span>
                        <div
                          className="bg-secondary h-1.5 flex-1 overflow-hidden rounded-full"
                          role="progressbar"
                          aria-valuenow={count}
                          aria-valuemax={maxCount}
                          aria-label={`${label}: ${count} visits`}
                        >
                          <div
                            className="bg-accent h-full rounded-full transition-[width] duration-700"
                            style={{ width: `${Math.round((count / maxCount) * 100)}%` }}
                          />
                        </div>
                        <span className="text-muted-foreground w-5 shrink-0 text-right text-xs tabular-nums">
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
                className="bg-card border-border flex flex-col gap-5 rounded-2xl border p-6"
              >
                <h2 className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                  Quiz Breakdown
                </h2>

                {totalQuizzes === 0 ? (
                  <p className="text-muted-foreground text-sm italic">No quiz attempts yet.</p>
                ) : (
                  <div className="flex flex-col gap-5">
                    <div>
                      <p className="text-muted-foreground text-4xl leading-none font-bold tabular-nums">
                        {avgQuizPct}%
                      </p>
                      <p className="text-muted-foreground mt-1 text-xs">average score</p>
                    </div>

                    <div className="bg-border h-px" />

                    <ul className="flex flex-col gap-2.5" role="list">
                      {scoreBuckets.map(({ label, count, color }) => (
                        <li key={label} className="flex items-center gap-2.5">
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${color}`}
                            aria-hidden="true"
                          />
                          <span className="text-muted-foreground flex-1 text-xs">{label}</span>
                          <span className="text-muted-foreground text-xs font-semibold tabular-nums">
                            {count}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            </div>

            {/* ── Recent sessions table ── */}
            <section aria-label="Recent learner sessions">
              <div className="bg-card border-border overflow-hidden rounded-2xl border">
                <div className="border-border border-b px-6 py-4">
                  <h2 className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                    Recent Sessions
                  </h2>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left" role="table">
                    <thead>
                      <tr className="border-border border-b">
                        {['Session ID', 'Lessons', 'Features', 'Status', 'Last Active'].map((h) => (
                          <th
                            key={h}
                            scope="col"
                            className="text-muted-foreground px-6 py-3 text-xs font-semibold tracking-wider uppercase"
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
                          className="border-border hover:bg-accent border-b transition-colors"
                        >
                          <td className="px-6 py-3">
                            <code className="text-muted-foreground font-mono text-xs">
                              {s.id.slice(0, 8)}…
                            </code>
                          </td>
                          <td className="text-muted-foreground px-6 py-3 text-sm tabular-nums">
                            {s.lessonCount}
                          </td>
                          <td className="text-accent px-6 py-3 text-sm font-semibold tabular-nums">
                            {s.hotspotsVisited}
                          </td>
                          <td className="px-6 py-3">
                            <span
                              className={`inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${
                                s.hasCompletion
                                  ? 'text-accent bg-accent/10 border-accent/25'
                                  : 'text-muted-foreground bg-accent border-border'
                              }`}
                            >
                              {s.hasCompletion ? 'Active' : 'Started'}
                            </span>
                          </td>
                          <td className="text-muted-foreground px-6 py-3 text-sm">
                            {relativeTime(s.lastActivity)}
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
