'use client';

import Link from 'next/link';
import { GraduationCap, Home } from 'lucide-react';

interface CourseCompleteProps {
  moduleTitle: string;
  totalLessons: number;
  totalHotspotsVisited: number;
  totalHotspots: number;
}

export function CourseComplete({
  moduleTitle,
  totalLessons,
  totalHotspotsVisited,
  totalHotspots,
}: CourseCompleteProps) {
  const exploredPct =
    totalHotspots > 0 ? Math.round((totalHotspotsVisited / totalHotspots) * 100) : 100;

  return (
    <div className="bg-background absolute inset-0 flex items-center justify-center overflow-hidden">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_55%_at_50%_45%,rgba(104,91,199,0.08),transparent)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_40%_35%_at_55%_75%,rgba(104,91,199,0.06),transparent)]" />

      {/* Decorative rings */}
      <div className="cc-spin border-border/4 absolute h-130 w-130 rounded-full border" />
      <div className="cc-spin-rev border-accent/8 absolute h-90 w-90 rounded-full border" />
      <div className="cc-spin border-border/6 absolute h-55 w-55 rounded-full border" />

      {/* Content card */}
      <div className="relative z-10 flex w-full max-w-75 flex-col items-center gap-5 px-6 text-center">
        {/* Badge */}
        <div className="cc-badge-in bg-accent flex h-17 w-17 items-center justify-center rounded-full shadow-[0_0_48px_rgba(104,91,199,0.32),0_0_80px_rgba(104,91,199,0.18)]">
          <GraduationCap className="text-accent-foreground h-8.5 w-8.5 stroke-[1.5]" />
        </div>

        {/* Eyebrow + title */}
        <div
          className="cc-rise flex flex-col items-center gap-1.5"
          style={{ animationDelay: '160ms' }}
        >
          {/* Prominent "Course Complete" banner chip */}
          <span className="bg-accent/15 border-accent/25 text-accent inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[9px] font-bold tracking-[0.22em] uppercase">
            Course Complete
          </span>
          <p className="text-foreground/40 mt-0.5 text-[11px] font-semibold tracking-[0.18em] uppercase">
            Course Approved
          </p>
          <h2 className="text-foreground text-[20px] leading-tight font-bold">{moduleTitle}</h2>
        </div>

        {/* Stats row */}
        <div className="cc-rise w-full" style={{ animationDelay: '260ms' }}>
          <div className="bg-background/4 border-border/[0.07] flex items-stretch overflow-hidden rounded-2xl border">
            <div className="flex flex-1 flex-col items-center justify-center gap-0.5 py-3">
              <span className="text-foreground text-[28px] leading-none font-bold tabular-nums">
                {totalLessons}
              </span>
              <span className="text-muted-foreground text-[9px] font-semibold tracking-wider uppercase">
                Lessons
              </span>
            </div>

            <div className="bg-background/[0.07] w-px self-stretch" />

            <div className="flex flex-1 flex-col items-center justify-center gap-0.5 py-3">
              <span className="text-accent text-[28px] leading-none font-bold tabular-nums">
                {totalHotspotsVisited}
              </span>
              <span className="text-muted-foreground text-[9px] font-semibold tracking-wider uppercase">
                Discovered
              </span>
            </div>

            <div className="bg-background/[0.07] w-px self-stretch" />

            <div className="flex flex-1 flex-col items-center justify-center gap-0.5 py-3">
              <span className="text-muted-foreground text-[28px] leading-none font-bold tabular-nums">
                {exploredPct}%
              </span>
              <span className="text-muted-foreground text-[9px] font-semibold tracking-wider uppercase">
                Explored
              </span>
            </div>
          </div>
        </div>

        {/* Return to Library */}
        <div className="cc-rise" style={{ animationDelay: '360ms' }}>
          <Link
            href="/"
            className="text-foreground/50 hover:text-foreground/90 border-border/10 hover:border-border/25 hover:bg-foreground/4 flex items-center gap-1.5 rounded-full border px-5 py-2 text-[11px] font-medium transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-95"
          >
            <Home className="h-3 w-3" />
            Return to Library
          </Link>
        </div>
      </div>
    </div>
  );
}
