"use client";

import { ReactNode } from "react";
import { ChevronLeft, ChevronRight, LayoutGrid, StickyNote, X } from "lucide-react";

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
  // Applied to the frame div itself
  className?: string;
  // Brand theme — drives frame background and nav scrim opacity
  theme?: string;
  // Navigation map toggle
  onToggleNavMap?: () => void;
  // Speaker notes
  onToggleNotes?: () => void;
  notesOpen?: boolean;
  speakerNotes?: string;
  // Device banner — shown as a fixed bottom bar below the fullscreen frame
  moduleTitle?: string;
}

const FRAME_BG: Record<string, string> = {
  "frost-black":  "bg-moto-frost",
  "black-frost":  "bg-moto-black",
  "pearl-black":  "bg-moto-pearl",
  "black-pearl":  "bg-moto-black",
  "indigo-frost": "bg-moto-indigo",
};

export function SlideFrame({
  children,
  currentSlide,
  totalSlides,
  onPrev,
  onNext,
  nextDisabled = false,
  completionHint,
  className = "",
  theme,
  onToggleNavMap,
  onToggleNotes,
  notesOpen = false,
  speakerNotes,
  moduleTitle,
}: SlideFrameProps) {
  const showNav = currentSlide !== undefined && totalSlides !== undefined;
  const frameBg = theme && theme in FRAME_BG ? FRAME_BG[theme] : "bg-moto-black";
  const isLightTheme = theme === "frost-black" || theme === "pearl-black";
  const navGradient = isLightTheme
    ? "bg-gradient-to-t from-moto-black via-moto-black/50 to-transparent"
    : "bg-gradient-to-t from-moto-black via-moto-black/60 to-transparent";

  const showProgress = currentSlide !== undefined && totalSlides !== undefined && totalSlides > 0;
  const progressPct = showProgress ? (currentSlide / totalSlides) * 100 : 0;

  return (
    // Outer shell — flex-col so the device banner stacks below the frame.
    <div className="w-full h-dvh bg-moto-black flex flex-col items-center justify-start overflow-hidden">
      {/* Fullscreen frame — fills all remaining vertical space after the banner */}
      <div
        className={`relative overflow-clip bg-moto-black rounded-none flex-1 w-full ${className}`}
      >
        {children}

        {/* ── Bottom vignette — blends slide content into the black banner below ── */}
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-moto-black to-transparent pointer-events-none z-10" />

        {/* ── Click-Outside Overlay ── */}
        {notesOpen && (
          <div
            className="absolute inset-0 z-30"
            onClick={() => onToggleNotes && onToggleNotes()}
            aria-label="Close notes overlay"
          />
        )}

        {/* ── Speaker notes panel — slides up from just above the nav bar ── */}
        {onToggleNotes && (
          <div
            className={`absolute left-0 right-0 z-40 flex flex-col
              bg-moto-black/95 backdrop-blur-2xl border-t border-moto-indigo/40
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
                <kbd className="hidden sm:inline-block text-[10px] text-moto-frost/60 font-mono border border-moto-slate/50 rounded px-1.5 py-0.5 bg-moto-slate/20">
                  N
                </kbd>
                <button
                  onClick={() => onToggleNotes && onToggleNotes()}
                  className="text-moto-frost/60 hover:text-moto-white transition-colors p-1 -mr-1 rounded-md hover:bg-moto-white/10"
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
                <p className="text-moto-frost text-base leading-relaxed whitespace-pre-wrap">
                  {speakerNotes}
                </p>
              ) : (
                <p className="text-moto-slate text-sm italic">
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
                ? "bg-moto-indigo/20 text-moto-indigo"
                : "bg-moto-black/50 backdrop-blur-sm text-moto-white/40 hover:text-moto-white hover:bg-moto-black/80"
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
                <span className="bg-moto-black/80 backdrop-blur-md text-moto-white shadow-md text-sm font-medium px-5 py-2 rounded-full border border-moto-slate/30">
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
                  className="h-10 w-10 rounded-full flex items-center justify-center text-moto-white/40 hover:text-moto-white hover:bg-moto-white/10 transition-all"
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
                      ? "text-moto-indigo bg-moto-indigo/15"
                      : "text-moto-white/40 hover:text-moto-white hover:bg-moto-white/10"
                    }`}
                >
                  <StickyNote className="h-5 w-5" />
                </button>
              )}

              <div className="flex-1" />

              {/* Right cluster — prev / counter / next */}
              <button
                onClick={onPrev}
                disabled={currentSlide === 1}
                className="h-10 w-10 rounded-full flex items-center justify-center text-moto-white/60 hover:text-moto-white hover:bg-moto-white/10 disabled:opacity-25 disabled:cursor-not-allowed transition-all"
                aria-label="Previous slide"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>

              <span className="text-sm font-medium text-moto-white/80 min-w-[3rem] text-center tabular-nums select-none" aria-hidden="true">
                {currentSlide} / {totalSlides}
              </span>
              {/* Announced to screen readers on each slide change */}
              <span aria-live="polite" aria-atomic="true" className="sr-only">
                Slide {currentSlide} of {totalSlides}
              </span>

              <button
                onClick={onNext}
                disabled={currentSlide === totalSlides || nextDisabled}
                className="h-10 w-10 rounded-full flex items-center justify-center text-moto-white/60 hover:text-moto-white hover:bg-moto-white/10 disabled:opacity-25 disabled:cursor-not-allowed transition-all"
                aria-label="Next slide"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </div>

            {/* Progress bar — 1px stripe along the very bottom edge */}
            <div
              role="progressbar"
              aria-valuenow={currentSlide}
              aria-valuemin={1}
              aria-valuemax={totalSlides}
              aria-label="Course progress"
              className="absolute bottom-0 left-0 right-0 h-px bg-moto-white/10 z-30"
            >
              <div
                className="h-full bg-moto-indigo transition-[width] duration-500 ease-out"
                style={{ width: `${(currentSlide / totalSlides) * 100}%` }}
              />
            </div>
          </>
        )}
      </div>

      {/* ── Device banner — fixed bottom bar below the frame ── */}
      {moduleTitle && (
        <div
          aria-hidden="true"
          className="shrink-0 w-full flex flex-col items-center justify-center py-3 gap-1 bg-moto-black"
        >
          {/* "You are learning about" label */}
          <p className="text-[11px] uppercase tracking-[0.22em] font-medium text-moto-slate leading-none">
            You are learning about
          </p>

          {/* Device / module name — the hero text */}
          <p className="text-3xl font-bold tracking-tight text-moto-frost leading-none text-center">
            {moduleTitle}
          </p>

          {/* Indigo underline accent */}
          <span className="block mt-1 h-[2px] w-10 rounded-full bg-moto-indigo" />

          {/* Progress indicator — always rendered to keep banner height constant */}
          <p className={`mt-1 text-xs tabular-nums text-moto-slate/70 leading-none ${showProgress ? "" : "invisible"}`}>
            slide {currentSlide}&thinsp;/&thinsp;{totalSlides}
          </p>
        </div>
      )}
    </div>
  );
}
