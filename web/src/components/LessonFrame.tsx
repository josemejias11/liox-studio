"use client";

import { ReactNode } from "react";
import { ChevronLeft, ChevronRight, LayoutGrid, StickyNote, X } from "lucide-react";

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
  // Speaker notes
  onToggleNotes?: () => void;
  notesOpen?: boolean;
  speakerNotes?: string;
  // Device banner — shown as a fixed bottom bar below the fullscreen frame
  moduleTitle?: string;
}



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
  onToggleNotes,
  notesOpen = false,
  speakerNotes,
  moduleTitle,
}: LessonFrameProps) {
  const showNav = currentLesson !== undefined && totalLessons !== undefined;
  const navGradient = "bg-gradient-to-t from-background via-background/80 to-transparent";

  const showProgress = currentLesson !== undefined && totalLessons !== undefined && totalLessons > 0;
  const progressPct = showProgress ? (currentLesson / totalLessons) * 100 : 0;

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

        {/* ── Click-Outside Overlay ── */}
        {notesOpen && (
          <div
            className="absolute inset-0 z-30"
            onClick={() => onToggleNotes && onToggleNotes()}
            aria-label="Close notes overlay"
          />
        )}

        {/* ── Speaker notes panel — lessons up from just above the nav bar ── */}
        {onToggleNotes && (
          <div
            className={`absolute left-0 right-0 z-40 flex flex-col
              bg-background/95 backdrop-blur-2xl border-t border-border
              shadow-[0_-8px_30px_rgba(0,0,0,0.5)]
              transition-all duration-300 ease-out
              ${showNav ? "bottom-14" : "bottom-0"}
              ${notesOpen
                ? "translate-y-0 opacity-100"
                : "translate-y-full opacity-0 pointer-events-none"
              }`}
            style={{ maxHeight: "40vh" }}
          >
            {/* Header row */}
            <div className="shrink-0 flex items-center justify-between px-6 pt-4 pb-3">
              <div className="flex items-center gap-3">
                <StickyNote className="h-4 w-4 text-moto-indigo shrink-0" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-moto-indigo">
                  Speaker Notes
                </h3>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-3">
                <kbd className="hidden sm:inline-block text-[10px] text-muted-foreground font-mono border border-border rounded px-1.5 py-0.5 bg-muted">
                  N
                </kbd>
                <button
                  onClick={() => onToggleNotes && onToggleNotes()}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1 -mr-1 rounded-md hover:bg-foreground/10"
                  aria-label="Close speaker notes"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Notes content */}
            <div
              className="overflow-y-auto px-6 pb-6"
              style={{ scrollbarWidth: "thin", scrollbarColor: "var(--color-moto-slate) transparent" }}
            >
              {speakerNotes ? (
                <p className="text-foreground text-base leading-relaxed whitespace-pre-wrap">
                  {speakerNotes}
                </p>
              ) : (
                <p className="text-muted-foreground text-sm italic">
                  No speaker notes for this lesson.
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Floating utility buttons (lessons without nav bar) ── */}
        {!showNav && onToggleNavMap && (
          <button
            onClick={onToggleNavMap}
            aria-label="Open course navigation"
            title="Course map"
            className="absolute bottom-4 left-4 z-50 h-10 w-10 rounded-full flex items-center justify-center
              bg-moto-black/50 backdrop-blur-sm text-moto-white/40 hover:text-moto-white hover:bg-moto-black/80
              transition-all duration-150 shadow-md"
          >
            <LayoutGrid className="h-5 w-5" />
          </button>
        )}
        {!showNav && onToggleNotes && (
          <button
            onClick={onToggleNotes}
            aria-label="Toggle speaker notes"
            aria-pressed={notesOpen}
            title="Speaker notes (N)"
            className={`absolute bottom-4 right-4 z-50 h-10 w-10 rounded-full flex items-center justify-center
              transition-all duration-150 shadow-md
              ${notesOpen
                ? "bg-accent/20 text-accent"
                : "bg-background/50 backdrop-blur-sm text-foreground/40 hover:text-foreground hover:bg-background/80"
              }`}
          >
            <StickyNote className="h-5 w-5" />
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
              {onToggleNotes && (
                <button
                  onClick={onToggleNotes}
                  aria-label="Toggle speaker notes"
                  aria-pressed={notesOpen}
                  title="Speaker notes (N)"
                  className={`h-10 w-10 rounded-full flex items-center justify-center transition-all
                    ${notesOpen
                      ? "text-accent bg-accent/15"
                      : "text-foreground/40 hover:text-foreground hover:bg-foreground/10"
                    }`}
                >
                  <StickyNote className="h-5 w-5" />
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

              <span className="text-sm font-medium text-foreground/80 min-w-[3rem] text-center tabular-nums select-none" aria-hidden="true">
                {currentLesson} / {totalLessons}
              </span>
              {/* Announced to screen readers on each lesson change */}
              <span aria-live="polite" aria-atomic="true" className="sr-only">
                Lesson {currentLesson} of {totalLessons}
              </span>

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
          <p className="text-3xl font-bold tracking-tight text-foreground leading-none text-center">
            {moduleTitle}
          </p>

          {/* Indigo underline accent */}
          <span className="block mt-1 h-[2px] w-10 rounded-full bg-accent" />

          {/* Progress indicator — always rendered to keep banner height constant */}
          <p className={`mt-1 text-xs tabular-nums text-muted-foreground/70 leading-none ${showProgress ? "" : "invisible"}`}>
            lesson {currentLesson}&thinsp;/&thinsp;{totalLessons}
          </p>
        </div>
      )}
    </div>
  );
}
