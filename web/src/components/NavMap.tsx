"use client";

import { useEffect, useRef } from "react";
import { X, FileText, MousePointer2, Layers, PlayCircle, HelpCircle } from "lucide-react";
import { useFocusTrap } from "@/lib/useFocusTrap";

interface NavMapSlide {
  _key: string;
  headline: string;
  slideType: string;
  hotspots?: { _key: string; label: string }[];
}

interface NavMapProps {
  slides: NavMapSlide[];
  currentIndex: number;
  visited: Record<string, Set<string>>;
  onNavigate: (index: number) => void;
  onClose: () => void;
}

const TYPE_META: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  content:     { icon: FileText,      color: "text-white/35",   label: "Content"     },
  interaction: { icon: MousePointer2, color: "text-white/35",   label: "Interaction" },
  stage:       { icon: Layers,        color: "text-sky-400",    label: "Stage"       },
  video:       { icon: PlayCircle,    color: "text-purple-400", label: "Video"       },
  quiz:        { icon: HelpCircle,    color: "text-amber-400",  label: "Quiz"        },
};

function slideCompletion(slide: NavMapSlide, visited: Record<string, Set<string>>) {
  const hs = slide.hotspots ?? [];
  if (hs.length === 0) return "auto";
  const visitedCount = visited[slide._key]?.size ?? 0;
  if (visitedCount === 0) return "none";
  if (visitedCount >= hs.length) return "full";
  return "partial";
}

export function NavMap({ slides, currentIndex, visited, onNavigate, onClose }: NavMapProps) {
  const panelRef  = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  // NavMap is always mounted when open, so active = true
  useFocusTrap(panelRef as { current: HTMLElement | null }, true);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCloseRef.current();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const exploredCount = slides.filter((s) => {
    const st = slideCompletion(s, visited);
    return st === "auto" || st === "full";
  }).length;

  return (
    <div className="absolute inset-0 z-[60] flex">
      {/* ── Slide-in panel ── */}
      <nav
        ref={panelRef as React.RefObject<HTMLElement>}
        aria-label="Course navigation"
        className="nav-map-in relative h-full w-[220px] flex flex-col bg-zinc-950/96 backdrop-blur-2xl border-r border-white/[0.07] shadow-2xl"
      >

        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-4 pt-3.5 pb-3 border-b border-white/[0.07]">
          <p className="text-[9.5px] font-bold uppercase tracking-[0.2em] text-white/35">
            Course Map
          </p>
          <button
            onClick={onClose}
            aria-label="Close navigation map"
            className="h-5 w-5 rounded-full flex items-center justify-center text-white/25 hover:text-white/80 hover:bg-white/10 transition-all"
          >
            <X className="h-3 w-3" />
          </button>
        </div>

        {/* Slide list */}
        <div
          className="flex-1 overflow-y-auto py-2 px-2 flex flex-col gap-0.5"
          style={{ scrollbarWidth: "none" }}
        >
          {slides.map((slide, i) => {
            const meta = TYPE_META[slide.slideType] ?? TYPE_META.content;
            const Icon = meta.icon;
            const isCurrent = i === currentIndex;
            const completion = slideCompletion(slide, visited);

            return (
              <button
                key={slide._key}
                onClick={() => onNavigate(i)}
                className={`
                  w-full text-left flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg
                  transition-all duration-150 active:scale-[0.97]
                  ${isCurrent
                    ? "bg-sky-500/14 ring-1 ring-inset ring-sky-400/35"
                    : "hover:bg-white/[0.045]"}
                `}
              >
                {/* Slide number */}
                <span className={`shrink-0 text-[9px] font-bold tabular-nums w-[14px] text-right
                  ${isCurrent ? "text-sky-400" : "text-white/18"}`}>
                  {i + 1}
                </span>

                {/* Type icon */}
                <Icon className={`shrink-0 h-[11px] w-[11px] ${meta.color}`} />

                {/* Headline */}
                <span className={`flex-1 text-[11px] font-medium leading-tight truncate
                  ${isCurrent ? "text-white" : "text-white/45"}`}>
                  {slide.headline}
                </span>

                {/* Completion dot */}
                <span className={`shrink-0 h-[7px] w-[7px] rounded-full
                  ${completion === "full"    ? "bg-emerald-400"
                  : completion === "partial" ? "bg-amber-400"
                  : completion === "auto"    ? "bg-white/18"
                  :                           "border border-zinc-600"}`}
                />
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-white/[0.07] px-4 py-2.5">
          <p className="text-[9px] text-white/20">
            <span className="text-white/45 font-semibold">{exploredCount}</span>
            {" "}of {slides.length} slides explored
          </p>
        </div>
      </nav>

      {/* ── Backdrop — click to close ── */}
      <div
        className="flex-1 bg-black/35 backdrop-blur-[2px] cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      />
    </div>
  );
}
