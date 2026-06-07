"use client";

import { ReactNode } from "react";
import { ChevronLeft, ChevronRight, LayoutGrid } from "lucide-react";

type SectionType = "lesson" | "specification" | "quiz" | "disclaimer";

interface LessonFrameProps {
  children: ReactNode;
  // Nav — omit all three to hide the nav bar entirely (e.g. cover / stage / quiz lessons)
  currentLesson?: number;
  totalLessons?: number;
  onPrev?: () => void;
  onNext?: () => void;
  nextDisabled?: boolean;
  // Completion hint shown above nav when nextDisabled
  completionHint?: string;
  className?: string;
  // Navigation map toggle
  onToggleNavMap?: () => void;
  // Device banner — shown as a fixed bottom bar below the fullscreen frame
  moduleTitle?: string;
  // Section type controls the banner sub-label and hides the numeric nav counter for non-lesson types
  sectionType?: SectionType;
}



const SECTION_LABELS: Record<SectionType, string | null> = {
  lesson: null,
  specification: "Specifications",
  quiz: "Knowledge Check",
  disclaimer: "Disclaimer",
};

export function LessonFrame({
  children,
  currentLesson,
  totalLessons,
  onPrev,
  onNext,
  nextDisabled = false,
  completionHint,
  className = "",
  onToggleNavMap,
  moduleTitle,
  sectionType = "lesson",
}: LessonFrameProps) {
  const showNav = currentLesson !== undefined && totalLessons !== undefined;
  const navGradient = "bg-gradient-to-t from-background via-background/80 to-transparent";

  const showProgress = currentLesson !== undefined && totalLessons !== undefined && totalLessons > 0;
  const sectionLabel = SECTION_LABELS[sectionType];
  const isLessonType = sectionType === "lesson";

  return (
    // Outer shell — flex-col so the device banner stacks below the frame.
    <div className="w-full h-dvh bg-background flex flex-col items-center justify-start overflow-hidden">
      {/* Fullscreen frame — fills all remaining vertical space after the banner */}
      <div
        className={`relative overflow-clip bg-background rounded-none flex-1 w-full ${className}`}
      >
        {children}

        {/* ── Bottom vignette — blends lesson content into the black banner below ── */}
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-background to-transparent pointer-events-none z-10" />


        {/* ── Floating utility buttons (lessons without nav bar) ── */}
        {!showNav && onToggleNavMap && (
          <button
            onClick={onToggleNavMap}
            aria-label="Open course navigation"
            title="Course map"
            className="absolute bottom-4 left-4 z-50 h-10 w-10 rounded-full flex items-center justify-center
              bg-background/50 backdrop-blur-sm text-foreground/40 hover:text-foreground hover:bg-background/80
              transition-all duration-150 shadow-md"
          >
            <LayoutGrid className="h-5 w-5" />
          </button>
        )}


        {/* ── Nav bar — lives INSIDE the 16:9 frame at the bottom ── */}
        {showNav && (
          <>
            {/* Completion hint */}
            {nextDisabled && completionHint && (
              <div className="absolute bottom-16 left-0 right-0 flex justify-center pointer-events-none z-10">
                <span className="bg-background/80 backdrop-blur-md text-foreground shadow-md text-sm font-medium px-5 py-2 rounded-full border border-border/30">
                  {completionHint}
                </span>
              </div>
            )}

            <div className={`absolute bottom-0 left-0 right-0 h-14 z-20 flex items-center px-6 gap-3 ${navGradient}`}>
              {/* Left cluster — map + notes */}
              {onToggleNavMap && (
                <button
                  onClick={onToggleNavMap}
                  aria-label="Open course navigation"
                  title="Course map"
                  className="h-10 w-10 rounded-full flex items-center justify-center text-foreground/40 hover:text-foreground hover:bg-foreground/10 transition-all"
                >
                  <LayoutGrid className="h-5 w-5" />
                </button>
              )}


              <div className="flex-1" />

              {/* Right cluster — prev / counter / next */}
              <button
                onClick={onPrev}
                disabled={currentLesson === 1}
                className="h-10 w-10 rounded-full flex items-center justify-center text-foreground/60 hover:text-foreground hover:bg-foreground/10 disabled:opacity-25 disabled:cursor-not-allowed transition-all"
                aria-label="Previous lesson"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>

              {/* Counter — visible only for lesson sections */}
              {isLessonType && (
                <>
                  <span className="text-sm font-medium text-foreground/80 min-w-[3rem] text-center tabular-nums select-none" aria-hidden="true">
                    {currentLesson} / {totalLessons}
                  </span>
                  <span aria-live="polite" aria-atomic="true" className="sr-only">
                    Lesson {currentLesson} of {totalLessons}
                  </span>
                </>
              )}

              <button
                onClick={onNext}
                disabled={currentLesson === totalLessons || nextDisabled}
                className="h-10 w-10 rounded-full flex items-center justify-center text-foreground/60 hover:text-foreground hover:bg-foreground/10 disabled:opacity-25 disabled:cursor-not-allowed transition-all"
                aria-label="Next lesson"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </div>

            {/* Progress bar — 1px stripe along the very bottom edge */}
            <div
              role="progressbar"
              aria-valuenow={currentLesson}
              aria-valuemin={1}
              aria-valuemax={totalLessons}
              aria-label="Course progress"
              className="absolute bottom-0 left-0 right-0 h-px bg-foreground/10 z-30"
            >
              <div
                className="h-full bg-accent transition-[width] duration-500 ease-out"
                style={{ width: `${(currentLesson / totalLessons) * 100}%` }}
              />
            </div>
          </>
        )}
      </div>

      {/* ── Device banner — fixed bottom bar below the frame ── */}
      {moduleTitle && (
        <div
          aria-hidden="true"
          className="shrink-0 w-full flex flex-col items-center justify-center py-3 gap-1 bg-background"
        >
          {/* "You are learning about" label */}
          <p className="text-[11px] uppercase tracking-[0.22em] font-medium text-muted-foreground leading-none">
            You are learning about
          </p>

          {/* Device / module name — the hero text */}
          <p className="text-3xl font-bold text-foreground leading-none text-center">
            {moduleTitle}
          </p>

          {/* Indigo underline accent */}
          <span className="block mt-1 h-[2px] w-10 rounded-full bg-accent" />

          {/* Progress / section label — always rendered to keep banner height constant */}
          {sectionLabel ? (
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-accent leading-none">
              {sectionLabel}
            </p>
          ) : (
            <p className={`mt-1 text-xs tabular-nums text-muted-foreground/70 leading-none ${showProgress ? "" : "invisible"}`}>
              lesson {currentLesson}&thinsp;/&thinsp;{totalLessons}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
