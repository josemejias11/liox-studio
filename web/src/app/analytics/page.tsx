import Link from "next/link";
import { Bot, Users, Zap, Trophy, BookOpen, ArrowLeft } from "lucide-react";
import { getAnalyticsData } from "@/services/analytics.service";

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
    <div className="bg-background border border-border/8 rounded-2xl px-5 py-5 flex flex-col gap-2.5">
      <Icon className={`h-4 w-4 ${accent}`} aria-hidden="true" />
      <p className={`text-[32px] font-bold tabular-nums leading-none ${accent}`}>{value}</p>
      <p className="text-[10px] text-foreground/30 font-semibold uppercase tracking-widest">{label}</p>
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
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b border-border bg-background/95 backdrop-blur-sm px-6">
        <div className="flex items-center gap-2 font-semibold text-lg text-primary">
          <Bot className="h-6 w-6" aria-hidden="true" />
          <span>DeckTutor AI</span>
        </div>
        <span className="text-muted-foreground select-none">·</span>
        <span className="text-muted-foreground text-sm font-medium">Instructor Dashboard</span>

        <div className="ml-auto">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-xs font-medium
              px-3 py-1.5 rounded-lg border border-border hover:bg-accent
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
            <Users className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
            <p className="text-muted-foreground text-base font-medium">No learner activity yet.</p>
            <p className="text-muted-foreground/50 text-sm">Share the course link to start tracking progress.</p>
            <Link href="/" className="mt-2 text-primary text-sm hover:underline transition-colors">
              Open Course →
            </Link>
          </div>
        ) : (
          <>
            {/* ── Stat cards ── */}
            <section aria-label="Summary statistics">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatCard icon={Users}    label="Sessions"          value={totalSessions}        accent="text-accent"    />
                <StatCard icon={Zap}      label="Features Explored" value={totalHotspotsVisited} accent="text-accent"     />
                <StatCard icon={Trophy}   label="Avg Quiz Score"    value={avgQuizPct !== null ? `${avgQuizPct}%` : "—"} accent="text-muted-foreground" />
                <StatCard icon={BookOpen} label="Quiz Attempts"     value={totalQuizzes}    accent="text-muted-foreground"      />
              </div>
            </section>

            {/* ── Charts row ── */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">

              {/* Top features bar chart */}
              <section
                aria-label="Top features explored"
                className="bg-card border border-border rounded-2xl p-6 flex flex-col gap-5"
              >
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Top Features Explored
                </h2>

                {topHotspots.length === 0 ? (
                  <p className="text-muted-foreground text-sm italic">No hotspot data yet.</p>
                ) : (
                  <ul className="flex flex-col gap-3" role="list">
                    {topHotspots.map(({ label, count }) => (
                      <li key={label} className="flex items-center gap-3">
                        <span className="text-muted-foreground text-xs w-36 truncate shrink-0">{label}</span>
                        <div
                          className="flex-1 bg-secondary rounded-full h-1.5 overflow-hidden"
                          role="progressbar"
                          aria-valuenow={count}
                          aria-valuemax={maxCount}
                          aria-label={`${label}: ${count} visits`}
                        >
                          <div
                            className="h-full bg-accent rounded-full transition-[width] duration-700"
                            style={{ width: `${Math.round((count / maxCount) * 100)}%` }}
                          />
                        </div>
                        <span className="text-muted-foreground text-xs w-5 text-right tabular-nums shrink-0">
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
                className="bg-card border border-border rounded-2xl p-6 flex flex-col gap-5"
              >
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Quiz Breakdown
                </h2>

                {totalQuizzes === 0 ? (
                  <p className="text-muted-foreground text-sm italic">No quiz attempts yet.</p>
                ) : (
                  <div className="flex flex-col gap-5">
                    <div>
                      <p className="text-4xl font-bold text-muted-foreground tabular-nums leading-none">
                        {avgQuizPct}%
                      </p>
                      <p className="text-muted-foreground text-xs mt-1">average score</p>
                    </div>

                    <div className="h-px bg-border" />

                    <ul className="flex flex-col gap-2.5" role="list">
                      {scoreBuckets.map(({ label, count, color }) => (
                        <li key={label} className="flex items-center gap-2.5">
                          <span className={`h-2 w-2 rounded-full shrink-0 ${color}`} aria-hidden="true" />
                          <span className="text-xs text-muted-foreground flex-1">{label}</span>
                          <span className="text-xs text-muted-foreground tabular-nums font-semibold">{count}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            </div>

            {/* ── Recent sessions table ── */}
            <section aria-label="Recent learner sessions">
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-border">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Recent Sessions
                  </h2>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left" role="table">
                    <thead>
                      <tr className="border-b border-border">
                        {["Session ID", "Lessons", "Features", "Status", "Last Active"].map((h) => (
                          <th
                            key={h}
                            scope="col"
                            className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
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
                          className="border-b border-border hover:bg-accent transition-colors"
                        >
                          <td className="px-6 py-3">
                            <code className="text-xs text-muted-foreground font-mono">
                              {s.id.slice(0, 8)}…
                            </code>
                          </td>
                          <td className="px-6 py-3 text-sm text-muted-foreground tabular-nums">
                            {s.lessonCount}
                          </td>
                          <td className="px-6 py-3 text-sm text-accent tabular-nums font-semibold">
                            {s.hotspotsVisited}
                          </td>
                          <td className="px-6 py-3">
                            <span
                              className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full border
                                ${s.hasCompletion
                                  ? "text-accent bg-accent/10 border-accent/25"
                                  : "text-muted-foreground bg-accent border-border"
                                }`}
                            >
                              {s.hasCompletion ? "Active" : "Started"}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-sm text-muted-foreground">
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
