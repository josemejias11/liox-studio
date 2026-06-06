"use client";

import { ChevronLeft, GraduationCap } from "lucide-react";

interface CourseCompleteProps {
  moduleTitle: string;
  totalSlides: number;
  totalHotspotsVisited: number;
  totalHotspots: number;
  onRestart: () => void;
}

export function CourseComplete({
  moduleTitle,
  totalSlides,
  totalHotspotsVisited,
  totalHotspots,
  onRestart,
}: CourseCompleteProps) {
  const exploredPct =
    totalHotspots > 0
      ? Math.round((totalHotspotsVisited / totalHotspots) * 100)
      : 100;

  return (
    <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-zinc-900 to-slate-900 flex items-center justify-center overflow-hidden">
      {/* Ambient glows */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_55%_at_50%_45%,rgba(56,189,248,0.08),transparent)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_35%_at_55%_75%,rgba(52,211,153,0.06),transparent)] pointer-events-none" />

      {/* Decorative rings */}
      <div className="cc-spin absolute w-[520px] h-[520px] rounded-full border border-white/[0.04]" />
      <div className="cc-spin-rev absolute w-[360px] h-[360px] rounded-full border border-sky-400/[0.08]" />
      <div className="cc-spin absolute w-[220px] h-[220px] rounded-full border border-emerald-400/[0.06]" />

      {/* Content card */}
      <div className="relative z-10 flex flex-col items-center text-center gap-5 px-6 max-w-[300px] w-full">

        {/* Badge */}
        <div
          className="cc-badge-in w-[68px] h-[68px] rounded-full flex items-center justify-center
            bg-gradient-to-br from-sky-400 to-emerald-400
            shadow-[0_0_48px_rgba(56,189,248,0.32),0_0_80px_rgba(52,211,153,0.18)]"
        >
          <GraduationCap className="h-[34px] w-[34px] text-white stroke-[1.5]" />
        </div>

        {/* Eyebrow + title */}
        <div className="cc-rise flex flex-col gap-1.5" style={{ animationDelay: "160ms" }}>
          <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/30">
            Course Complete
          </p>
          <h2 className="text-white text-[20px] font-bold leading-tight">{moduleTitle}</h2>
        </div>

        {/* Stats row */}
        <div
          className="cc-rise w-full"
          style={{ animationDelay: "260ms" }}
        >
          <div className="flex items-stretch bg-white/[0.04] border border-white/[0.07] rounded-2xl overflow-hidden">
            <div className="flex-1 flex flex-col items-center justify-center py-3 gap-0.5">
              <span className="text-[28px] font-bold text-white tabular-nums leading-none">
                {totalSlides}
              </span>
              <span className="text-[9px] text-white/25 font-semibold uppercase tracking-wider">
                Slides
              </span>
            </div>

            <div className="w-px bg-white/[0.07] self-stretch" />

            <div className="flex-1 flex flex-col items-center justify-center py-3 gap-0.5">
              <span className="text-[28px] font-bold text-emerald-400 tabular-nums leading-none">
                {totalHotspotsVisited}
              </span>
              <span className="text-[9px] text-white/25 font-semibold uppercase tracking-wider">
                Features
              </span>
            </div>

            <div className="w-px bg-white/[0.07] self-stretch" />

            <div className="flex-1 flex flex-col items-center justify-center py-3 gap-0.5">
              <span className="text-[28px] font-bold text-sky-400 tabular-nums leading-none">
                {exploredPct}%
              </span>
              <span className="text-[9px] text-white/25 font-semibold uppercase tracking-wider">
                Explored
              </span>
            </div>
          </div>
        </div>

        {/* Review button */}
        <div className="cc-rise" style={{ animationDelay: "360ms" }}>
          <button
            onClick={onRestart}
            className="flex items-center gap-1.5 text-white/50 hover:text-white/90
              text-[11px] font-medium px-5 py-2 rounded-full
              border border-white/10 hover:border-white/25 hover:bg-white/[0.04]
              transition-all duration-200 active:scale-95"
          >
            <ChevronLeft className="h-3 w-3" />
            Review Course
          </button>
        </div>
      </div>
    </div>
  );
}
