"use client";

import { useEffect, useRef } from "react";
import { X, FileText, MousePointer2, Layers, PlayCircle, HelpCircle } from "lucide-react";
import { useFocusTrap } from "@/lib/useFocusTrap";

interface NavMapLesson {
  _key: string;
  headline: string;
  lessonType: string;
  hotspots?: { _key: string; label: string }[];
}

interface NavMapProps {
  lessons: NavMapLesson[];
  currentIndex: number;
  visited: Record<string, Set<string>>;
  onNavigate: (index: number) => void;
  onClose: () => void;
}

const TYPE_META: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  content:     { icon: FileText,      color: "text-moto-frost/35",   label: "Content"     },
  interaction: { icon: MousePointer2, color: "text-moto-frost/35",   label: "Interaction" },
  stage:       { icon: Layers,        color: "text-moto-indigo",     label: "Stage"       },
  video:       { icon: PlayCircle,    color: "text-moto-slate",      label: "Video"       },
  quiz:        { icon: HelpCircle,    color: "text-moto-sandstone",  label: "Quiz"        },
};

function lessonCompletion(lesson: NavMapLesson, visited: Record<string, Set<string>>) {
  const hs = lesson.hotspots ?? [];
  if (hs.length === 0) return "auto";
  const visitedCount = visited[lesson._key]?.size ?? 0;
  if (visitedCount === 0) return "none";
  if (visitedCount >= hs.length) return "full";
  return "partial";
}

export function NavMap({ lessons, currentIndex, visited, onNavigate, onClose }: NavMapProps) {
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

  const exploredCount = lessons.filter((s) => {
    const st = lessonCompletion(s, visited);
    return st === "auto" || st === "full";
  }).length;

  return (
    <div className="absolute inset-0 z-[60] flex">
      {/* ── Lesson-in panel ── */}
      <nav
        ref={panelRef as React.RefObject<HTMLElement>}
        aria-label="Course navigation"
        className="nav-map-in relative h-full w-[260px] flex flex-col bg-moto-black/96 backdrop-blur-2xl border-r border-moto-frost/[0.07] shadow-2xl"
      >

        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-4 pt-3.5 pb-3 border-b border-moto-frost/[0.07]">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-moto-frost/35">
            Course Map
          </p>
          <button
            onClick={onClose}
            aria-label="Close navigation map"
            className="h-5 w-5 rounded-full flex items-center justify-center text-moto-frost/25 hover:text-moto-frost/80 hover:bg-moto-frost/10 transition-all"
          >
            <X className="h-3 w-3" />
          </button>
        </div>

        {/* Lesson list */}
        <div
          className="flex-1 overflow-y-auto py-2 px-2 flex flex-col gap-0.5"
          style={{ scrollbarWidth: "none" }}
        >
          {lessons.map((lesson, i) => {
            const meta = TYPE_META[lesson.lessonType] ?? TYPE_META.content;
            const Icon = meta.icon;
            const isCurrent = i === currentIndex;
            const completion = lessonCompletion(lesson, visited);

            return (
              <button
                key={lesson._key}
                onClick={() => onNavigate(i)}
                className={`
                  w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg
                  transition-all duration-150 active:scale-[0.97]
                  ${isCurrent
                    ? "bg-moto-indigo/14 ring-1 ring-inset ring-moto-indigo/35"
                    : "hover:bg-moto-frost/[0.045]"}
                `}
              >
                {/* Lesson number */}
                <span className={`shrink-0 text-xs font-bold tabular-nums w-4 text-right
                  ${isCurrent ? "text-moto-indigo" : "text-moto-frost/25"}`}>
                  {i + 1}
                </span>

                {/* Type icon */}
                <Icon className={`shrink-0 h-3.5 w-3.5 ${meta.color}`} />

                {/* Headline */}
                <span className={`flex-1 text-sm font-medium leading-tight truncate
                  ${isCurrent ? "text-moto-frost" : "text-moto-frost/50"}`}>
                  {lesson.headline}
                </span>

                {/* Completion dot */}
                <span className={`shrink-0 h-2 w-2 rounded-full
                  ${completion === "full"    ? "bg-moto-indigo"
                  : completion === "partial" ? "bg-moto-slate"
                  : completion === "auto"    ? "bg-moto-frost/18"
                  :                           "border border-moto-slate"}`}
                />
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-moto-frost/[0.07] px-4 py-2.5">
          <p className="text-xs text-moto-frost/30">
            <span className="text-moto-frost/55 font-semibold">{exploredCount}</span>
            {" "}of {lessons.length} lessons explored
          </p>
        </div>
      </nav>

      {/* ── Backdrop — click to close ── */}
      <div
        className="flex-1 bg-moto-black/35 backdrop-blur-[2px] cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      />
    </div>
  );
}
