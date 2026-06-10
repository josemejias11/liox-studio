"use client";

import Link from "next/link";
import { GraduationCap, Home } from "lucide-react";

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
    totalHotspots > 0
      ? Math.round((totalHotspotsVisited / totalHotspots) * 100)
      : 100;

  return (
    <div className="absolute inset-0 bg-background flex items-center justify-center overflow-hidden">
      {/* Ambient glows */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_55%_at_50%_45%,rgba(104,91,199,0.08),transparent)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_35%_at_55%_75%,rgba(104,91,199,0.06),transparent)] pointer-events-none" />

      {/* Decorative rings */}
      <div className="cc-spin absolute w-130 h-130 rounded-full border border-border/4" />
      <div className="cc-spin-rev absolute w-90 h-90 rounded-full border border-accent/8" />
      <div className="cc-spin absolute w-55 h-55 rounded-full border border-border/6" />

      {/* Content card */}
      <div className="relative z-10 flex flex-col items-center text-center gap-5 px-6 max-w-75 w-full">

        {/* Badge */}
        <div
          className="cc-badge-in w-17 h-17 rounded-full flex items-center justify-center
            bg-accent
            shadow-[0_0_48px_rgba(104,91,199,0.32),0_0_80px_rgba(104,91,199,0.18)]"
        >
          <GraduationCap className="h-8.5 w-8.5 text-accent-foreground stroke-[1.5]" />
        </div>

        {/* Eyebrow + title */}
        <div className="cc-rise flex flex-col items-center gap-1.5" style={{ animationDelay: "160ms" }}>
          {/* Prominent "Course Complete" banner chip */}
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/15 border border-accent/25 text-accent text-[9px] font-bold uppercase tracking-[0.22em]">
            Course Complete
          </span>
          <p className="text-foreground/40 text-[11px] font-semibold uppercase tracking-[0.18em] mt-0.5">
            Course Approved
          </p>
          <h2 className="text-foreground text-[20px] font-bold leading-tight">{moduleTitle}</h2>
        </div>

        {/* Stats row */}
        <div
          className="cc-rise w-full"
          style={{ animationDelay: "260ms" }}
        >
          <div className="flex items-stretch bg-background/4 border border-border/[0.07] rounded-2xl overflow-hidden">
            <div className="flex-1 flex flex-col items-center justify-center py-3 gap-0.5">
              <span className="text-[28px] font-bold text-foreground tabular-nums leading-none">
                {totalLessons}
              </span>
              <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider">
                Lessons
              </span>
            </div>

            <div className="w-px bg-background/[0.07] self-stretch" />

            <div className="flex-1 flex flex-col items-center justify-center py-3 gap-0.5">
              <span className="text-[28px] font-bold text-accent tabular-nums leading-none">
                {totalHotspotsVisited}
              </span>
              <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider">
                Discovered
              </span>
            </div>

            <div className="w-px bg-background/[0.07] self-stretch" />

            <div className="flex-1 flex flex-col items-center justify-center py-3 gap-0.5">
              <span className="text-[28px] font-bold text-muted-foreground tabular-nums leading-none">
                {exploredPct}%
              </span>
              <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider">
                Explored
              </span>
            </div>
          </div>
        </div>

        {/* Return to Library */}
        <div className="cc-rise" style={{ animationDelay: "360ms" }}>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-foreground/50 hover:text-foreground/90
              text-[11px] font-medium px-5 py-2 rounded-full
              border border-border/10 hover:border-border/25 hover:bg-foreground/4
              transition-all duration-200 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <Home className="h-3 w-3" />
            Return to Library
          </Link>
        </div>
      </div>
    </div>
  );
}
