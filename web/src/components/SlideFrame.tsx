"use client";

import { ReactNode } from "react";
import { ChevronLeft, ChevronRight, LayoutGrid, StickyNote } from "lucide-react";

interface SlideFrameProps {
  children: ReactNode;
  // Nav — omit all three to hide the nav bar entirely (e.g. cover / stage / quiz slides)
  currentSlide?: number;
  totalSlides?: number;
  onPrev?: () => void;
  onNext?: () => void;
  nextDisabled?: boolean;
  // Completion hint shown above nav when nextDisabled
  completionHint?: string;
  // Applied to the 16:9 box itself
  className?: string;
  // Navigation map toggle
  onToggleNavMap?: () => void;
  // Speaker notes
  onToggleNotes?: () => void;
  notesOpen?: boolean;
  speakerNotes?: string;
}

export function SlideFrame({
  children,
  currentSlide,
  totalSlides,
  onPrev,
  onNext,
  nextDisabled = false,
  completionHint,
  className = "",
  onToggleNavMap,
  onToggleNotes,
  notesOpen = false,
  speakerNotes,
}: SlideFrameProps) {
  const showNav = currentSlide !== undefined && totalSlides !== undefined;

  return (
    // Centering shell
    <div className="w-full h-full bg-zinc-950 flex items-center justify-center overflow-hidden">
      {/* 16:9 locked frame */}
      <div
        className={`relative overflow-hidden bg-black ${className}`}
        style={{
          aspectRatio: "16 / 9",
          width: "min(100%, calc((100vh - 4rem) * 16 / 9))",
        }}
      >
        {children}

        {/* ── Speaker notes panel — slides up from just above the nav bar ── */}
        {onToggleNotes && (
          <div
            className={`absolute left-0 right-0 z-40 flex flex-col
              bg-zinc-950/97 backdrop-blur-2xl border-t border-amber-400/[0.18]
              transition-[transform,opacity] duration-300 ease-out
              ${notesOpen
                ? "translate-y-0 opacity-100"
                : "translate-y-full opacity-0 pointer-events-none"
              }`}
            style={{ bottom: showNav ? "2.25rem" : "0", maxHeight: "38%" }}
          >
            {/* Header row */}
            <div className="shrink-0 flex items-center gap-2 px-4 pt-3 pb-2">
              <StickyNote className="h-3 w-3 text-amber-400/60 shrink-0" />
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-amber-400/50 flex-1">
                Speaker Notes
              </p>
              <kbd className="text-[8px] text-white/15 font-mono border border-white/10 rounded px-1 py-px">
                N
              </kbd>
            </div>

            {/* Notes content */}
            <div
              className="overflow-y-auto px-4 pb-3"
              style={{ scrollbarWidth: "none" }}
            >
              {speakerNotes ? (
                <p className="text-white/60 text-[12px] leading-relaxed whitespace-pre-wrap">
                  {speakerNotes}
                </p>
              ) : (
                <p className="text-white/18 text-[11px] italic">
                  No speaker notes for this slide.
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Floating utility buttons (slides without nav bar) ── */}
        {!showNav && onToggleNavMap && (
          <button
            onClick={onToggleNavMap}
            aria-label="Open course navigation"
            title="Course map"
            className="absolute bottom-3 left-3 z-50 h-7 w-7 rounded-full flex items-center justify-center
              bg-black/35 backdrop-blur-sm text-white/35 hover:text-white/80 hover:bg-black/55
              transition-all duration-150"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
        )}
        {!showNav && onToggleNotes && (
          <button
            onClick={onToggleNotes}
            aria-label="Toggle speaker notes"
            aria-pressed={notesOpen}
            title="Speaker notes (N)"
            className={`absolute bottom-3 right-3 z-50 h-7 w-7 rounded-full flex items-center justify-center
              transition-all duration-150
              ${notesOpen
                ? "bg-amber-400/20 text-amber-400"
                : "bg-black/35 backdrop-blur-sm text-white/35 hover:text-white/80 hover:bg-black/55"
              }`}
          >
            <StickyNote className="h-3.5 w-3.5" />
          </button>
        )}

        {/* ── Nav bar — lives INSIDE the 16:9 frame at the bottom ── */}
        {showNav && (
          <>
            {/* Completion hint */}
            {nextDisabled && completionHint && (
              <div className="absolute bottom-9 left-0 right-0 flex justify-center pointer-events-none z-10">
                <span className="bg-black/70 backdrop-blur-sm text-white/70 text-[10px] font-medium px-3 py-1 rounded-full border border-white/10">
                  {completionHint}
                </span>
              </div>
            )}

            <div className="absolute bottom-0 left-0 right-0 h-9 z-20 flex items-center px-3 gap-1 bg-gradient-to-t from-black/60 to-transparent">
              {/* Left cluster — map + notes */}
              {onToggleNavMap && (
                <button
                  onClick={onToggleNavMap}
                  aria-label="Open course navigation"
                  title="Course map"
                  className="h-6 w-6 rounded-full flex items-center justify-center text-white/35 hover:text-white hover:bg-white/15 transition-all"
                >
                  <LayoutGrid className="h-3 w-3" />
                </button>
              )}
              {onToggleNotes && (
                <button
                  onClick={onToggleNotes}
                  aria-label="Toggle speaker notes"
                  aria-pressed={notesOpen}
                  title="Speaker notes (N)"
                  className={`h-6 w-6 rounded-full flex items-center justify-center transition-all
                    ${notesOpen
                      ? "text-amber-400 bg-amber-400/15"
                      : "text-white/35 hover:text-white hover:bg-white/15"
                    }`}
                >
                  <StickyNote className="h-3 w-3" />
                </button>
              )}

              <div className="flex-1" />

              {/* Right cluster — prev / counter / next */}
              <button
                onClick={onPrev}
                disabled={currentSlide === 1}
                className="h-6 w-6 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/15 disabled:opacity-25 disabled:cursor-not-allowed transition-all"
                aria-label="Previous slide"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>

              <span className="text-[10px] text-white/40 w-10 text-center tabular-nums select-none" aria-hidden="true">
                {currentSlide} / {totalSlides}
              </span>
              {/* Announced to screen readers on each slide change */}
              <span aria-live="polite" aria-atomic="true" className="sr-only">
                Slide {currentSlide} of {totalSlides}
              </span>

              <button
                onClick={onNext}
                disabled={currentSlide === totalSlides || nextDisabled}
                className="h-6 w-6 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/15 disabled:opacity-25 disabled:cursor-not-allowed transition-all"
                aria-label="Next slide"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Progress bar — 1px stripe along the very bottom edge */}
            <div
              role="progressbar"
              aria-valuenow={currentSlide}
              aria-valuemin={1}
              aria-valuemax={totalSlides}
              aria-label="Course progress"
              className="absolute bottom-0 left-0 right-0 h-px bg-white/10 z-30"
            >
              <div
                className="h-full bg-primary transition-[width] duration-500 ease-out"
                style={{ width: `${(currentSlide / totalSlides) * 100}%` }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
