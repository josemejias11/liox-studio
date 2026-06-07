"use client";

import { useEffect, useRef } from "react";
import {
  X,
  FileText,
  MousePointer2,
  Layers,
  PlayCircle,
  HelpCircle,
  ShieldAlert,
  CircleCheck,
} from "lucide-react";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { ThemeToggle } from "./ThemeToggle";
import type { CourseSection, LessonSection } from "./DeckViewer";
import type { SanitySpecification } from "./SpecificationPage";

// ── Icon/color metadata per sectionType / lessonType ─────────────────────────

const LESSON_TYPE_META: Record<
  string,
  { icon: React.ElementType; color: string; label: string }
> = {
  content:     { icon: FileText,      color: "text-foreground/35",      label: "Content"      },
  interaction: { icon: MousePointer2, color: "text-foreground/35",      label: "Interaction"  },
  stage:       { icon: Layers,        color: "text-accent",             label: "Stage"        },
  video:       { icon: PlayCircle,    color: "text-muted-foreground",   label: "Video"        },
  quiz:        { icon: HelpCircle,    color: "text-muted-foreground",   label: "Quiz"         },
};

const SECTION_TYPE_META: Record<
  "specification" | "quiz" | "disclaimer",
  { icon: React.ElementType; color: string; label: string }
> = {
  specification: { icon: FileText,    color: "text-accent/70",         label: "Specifications" },
  quiz:          { icon: CircleCheck, color: "text-muted-foreground",  label: "Knowledge Check" },
  disclaimer:    { icon: ShieldAlert, color: "text-muted-foreground",  label: "Disclaimer"      },
};

// ── Completion state for a lesson section ─────────────────────────────────────

function lessonCompletion(
  lesson: LessonSection,
  visited: Record<string, Set<string>>
): "auto" | "full" | "partial" | "none" {
  const hs = lesson.hotspots ?? [];
  if (hs.length === 0) return "auto";
  const visitedCount = visited[lesson._key]?.size ?? 0;
  if (visitedCount === 0) return "none";
  if (visitedCount >= hs.length) return "full";
  return "partial";
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface NavMapProps {
  sections: CourseSection[];
  /** Absolute index in the flat sections array; -1 for cover, sections.length for complete */
  currentSectionIndex: number;
  visited: Record<string, Set<string>>;
  onNavigate: (absoluteSectionIndex: number) => void;
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function NavMap({
  sections,
  currentSectionIndex,
  visited,
  onNavigate,
  onClose,
}: NavMapProps) {
  const panelRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useFocusTrap(panelRef as { current: HTMLElement | null }, true);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCloseRef.current();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // ── Derive section groups ─────────────────────────────────────────────────

  const lessonSections = sections.filter(
    (s): s is LessonSection => s.sectionType === "lesson"
  );
  const specSections = sections.filter(
    (s): s is SanitySpecification => s.sectionType === "specification"
  );
  const quizSection = sections.find((s) => s.sectionType === "quiz");
  const disclaimerSection = sections.find((s) => s.sectionType === "disclaimer");

  const hasNonLessonSections =
    specSections.length > 0 || quizSection != null || disclaimerSection != null;

  // Group lessons by chapterIndex while preserving their absolute index in sections
  type ChapterGroup = {
    chapterIndex: number;
    chapterTitle: string;
    lessons: Array<{ section: LessonSection; absoluteIndex: number }>;
  };

  const chapterGroups: ChapterGroup[] = [];
  const seenChapters = new Set<number>();
  lessonSections.forEach((ls, lessonPos) => {
    if (!seenChapters.has(ls.chapterIndex)) {
      seenChapters.add(ls.chapterIndex);
      chapterGroups.push({
        chapterIndex: ls.chapterIndex,
        chapterTitle: ls.chapterTitle,
        lessons: [],
      });
    }
    const group = chapterGroups.find((g) => g.chapterIndex === ls.chapterIndex)!;
    group.lessons.push({ section: ls, absoluteIndex: lessonPos });
  });

  // Non-lesson sections start at absolute index = lessonSections.length
  const specOffset = lessonSections.length;
  const quizOffset = specOffset + specSections.length;
  const disclaimerOffset = quizOffset + (quizSection ? 1 : 0);

  // Explored count (lessons only, for footer)
  const exploredCount = lessonSections.filter((ls) => {
    const st = lessonCompletion(ls, visited);
    return st === "auto" || st === "full";
  }).length;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="absolute inset-0 z-[60] flex">
      {/* Side panel */}
      <nav
        ref={panelRef as React.RefObject<HTMLElement>}
        aria-label="Course navigation"
        className="nav-map-in relative h-full w-[260px] flex flex-col bg-background/96 backdrop-blur-2xl border-r border-border/[0.07] shadow-2xl"
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-4 pt-3.5 pb-3 border-b border-border/[0.07]">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/35">
            Course Map
          </p>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={onClose}
              aria-label="Close navigation map"
              className="h-5 w-5 rounded-full flex items-center justify-center text-foreground/25 hover:text-foreground/80 hover:bg-background/10 transition-all"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Scrollable section list */}
        <div
          className="flex-1 overflow-y-auto py-2 px-2 flex flex-col gap-0"
          style={{ scrollbarWidth: "none" }}
        >
          {/* ── Chapter groups ── */}
          {chapterGroups.map((group, groupIdx) => (
            <div key={group.chapterIndex}>
              {/* Chapter label — non-interactive header row */}
              <div className="px-3 pt-3 pb-1">
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-foreground/30 truncate">
                  {chapterGroups.length > 1
                    ? `Chapter ${groupIdx + 1}: ${group.chapterTitle}`
                    : group.chapterTitle}
                </p>
              </div>

              {/* Lessons in this chapter */}
              {group.lessons.map(({ section, absoluteIndex }) => {
                const meta =
                  LESSON_TYPE_META[section.lessonType] ?? LESSON_TYPE_META.content;
                const Icon = meta.icon;
                const isCurrent = absoluteIndex === currentSectionIndex;
                const completion = lessonCompletion(section, visited);

                // Position label within chapter (1-based)
                const posInChapter =
                  group.lessons.findIndex((l) => l.absoluteIndex === absoluteIndex) + 1;

                return (
                  <button
                    key={section._key}
                    onClick={() => onNavigate(absoluteIndex)}
                    className={`
                      w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg
                      transition-all duration-150 active:scale-[0.97]
                      ${
                        isCurrent
                          ? "bg-accent/14 ring-1 ring-inset ring-accent/35"
                          : "hover:bg-background/[0.045]"
                      }
                    `}
                  >
                    {/* Position within chapter */}
                    <span
                      className={`shrink-0 text-xs font-bold tabular-nums w-4 text-right
                        ${isCurrent ? "text-accent" : "text-foreground/25"}`}
                    >
                      {posInChapter}
                    </span>

                    {/* Lesson type icon */}
                    <Icon className={`shrink-0 h-3.5 w-3.5 ${meta.color}`} />

                    {/* Headline */}
                    <span
                      className={`flex-1 text-sm font-medium leading-tight truncate
                        ${isCurrent ? "text-foreground" : "text-foreground/50"}`}
                    >
                      {section.headline}
                    </span>

                    {/* Completion dot */}
                    <span
                      className={`shrink-0 h-2 w-2 rounded-full
                        ${
                          completion === "full"
                            ? "bg-accent"
                            : completion === "partial"
                            ? "bg-muted"
                            : completion === "auto"
                            ? "bg-background/18"
                            : "border border-border"
                        }`}
                    />
                  </button>
                );
              })}
            </div>
          ))}

          {/* ── Divider before non-lesson sections ── */}
          {hasNonLessonSections && (
            <div className="mx-3 my-2 border-t border-border/20" aria-hidden="true" />
          )}

          {/* ── Specification sections ── */}
          {specSections.map((spec, k) => {
            const absoluteIndex = specOffset + k;
            const isCurrent = absoluteIndex === currentSectionIndex;
            const meta = SECTION_TYPE_META.specification;
            const Icon = meta.icon;

            return (
              <button
                key={spec._key ?? `spec-${k}`}
                onClick={() => onNavigate(absoluteIndex)}
                className={`
                  w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg
                  transition-all duration-150 active:scale-[0.97]
                  ${
                    isCurrent
                      ? "bg-accent/14 ring-1 ring-inset ring-accent/35"
                      : "hover:bg-background/[0.045]"
                  }
                `}
              >
                <span
                  className={`shrink-0 text-xs font-bold tabular-nums w-4 text-right
                    ${isCurrent ? "text-accent" : "text-foreground/25"}`}
                >
                  {k + 1}
                </span>
                <Icon className={`shrink-0 h-3.5 w-3.5 ${meta.color}`} />
                <span
                  className={`flex-1 text-sm font-medium leading-tight truncate
                    ${isCurrent ? "text-foreground" : "text-foreground/50"}`}
                >
                  {spec.title}
                </span>
                {/* Spec sections show an empty dot (no hotspot tracking) */}
                <span className="shrink-0 h-2 w-2 rounded-full bg-background/18" />
              </button>
            );
          })}

          {/* ── Quiz section ── */}
          {quizSection && (() => {
            const absoluteIndex = quizOffset;
            const isCurrent = absoluteIndex === currentSectionIndex;
            const meta = SECTION_TYPE_META.quiz;
            const Icon = meta.icon;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const title = (quizSection as any).title ?? "Knowledge Check";

            return (
              <button
                onClick={() => onNavigate(absoluteIndex)}
                className={`
                  w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg
                  transition-all duration-150 active:scale-[0.97]
                  ${
                    isCurrent
                      ? "bg-accent/14 ring-1 ring-inset ring-accent/35"
                      : "hover:bg-background/[0.045]"
                  }
                `}
              >
                <span
                  className={`shrink-0 text-xs font-bold tabular-nums w-4 text-right
                    ${isCurrent ? "text-accent" : "text-foreground/25"}`}
                >
                  ✓
                </span>
                <Icon className={`shrink-0 h-3.5 w-3.5 ${meta.color}`} />
                <span
                  className={`flex-1 text-sm font-medium leading-tight truncate
                    ${isCurrent ? "text-foreground" : "text-foreground/50"}`}
                >
                  {title}
                </span>
                <span className="shrink-0 h-2 w-2 rounded-full bg-background/18" />
              </button>
            );
          })()}

          {/* ── Disclaimer section ── */}
          {disclaimerSection && (() => {
            const absoluteIndex = disclaimerOffset;
            const isCurrent = absoluteIndex === currentSectionIndex;
            const meta = SECTION_TYPE_META.disclaimer;
            const Icon = meta.icon;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const title = (disclaimerSection as any).title ?? "Disclaimer";

            return (
              <button
                onClick={() => onNavigate(absoluteIndex)}
                className={`
                  w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg
                  transition-all duration-150 active:scale-[0.97]
                  ${
                    isCurrent
                      ? "bg-accent/14 ring-1 ring-inset ring-accent/35"
                      : "hover:bg-background/[0.045]"
                  }
                `}
              >
                <span
                  className={`shrink-0 text-xs font-bold tabular-nums w-4 text-right
                    ${isCurrent ? "text-accent" : "text-foreground/25"}`}
                >
                  !
                </span>
                <Icon className={`shrink-0 h-3.5 w-3.5 ${meta.color}`} />
                <span
                  className={`flex-1 text-sm font-medium leading-tight truncate
                    ${isCurrent ? "text-foreground" : "text-foreground/50"}`}
                >
                  {title}
                </span>
                <span className="shrink-0 h-2 w-2 rounded-full bg-background/18" />
              </button>
            );
          })()}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-border/[0.07] px-4 py-2.5">
          <p className="text-xs text-foreground/30">
            <span className="text-foreground/55 font-semibold">{exploredCount}</span>
            {" "}of {lessonSections.length} lessons explored
          </p>
        </div>
      </nav>

      {/* Backdrop — click to close */}
      <div
        className="flex-1 bg-background/35 backdrop-blur-[2px] cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      />
    </div>
  );
}
