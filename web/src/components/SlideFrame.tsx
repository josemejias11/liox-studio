"use client";

import { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface SlideFrameProps {
  children: ReactNode;
  // Nav — omit all three to hide the nav bar entirely (e.g. cover slide)
  currentSlide?: number;
  totalSlides?: number;
  onPrev?: () => void;
  onNext?: () => void;
  nextDisabled?: boolean;
  // Completion hint shown above nav when nextDisabled
  completionHint?: string;
  // Applied to the 16:9 box itself — override bg, border, shadow, etc.
  className?: string;
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
}: SlideFrameProps) {
  const showNav = currentSlide !== undefined && totalSlides !== undefined;

  return (
    // Centering shell — fills whatever space DeckViewer gives it
    <div className="w-full h-full bg-zinc-950 flex items-center justify-center overflow-hidden">
      {/*
        16:9 locked frame.
        Width = min(100% of container width, height × 16/9).
        This keeps the frame pixel-perfect 16:9 with black bars on the sides
        when the viewport is taller than wide, and fills width otherwise.
      */}
      <div
        className={`relative overflow-hidden bg-black ${className}`}
        style={{
          aspectRatio: "16 / 9",
          width: "min(100%, calc((100vh - 4rem) * 16 / 9))",
        }}
      >
        {children}

        {/* ── Nav bar — lives INSIDE the 16:9 frame at the bottom ── */}
        {showNav && (
          <>
            {/* Completion hint — appears above nav when next is locked */}
            {nextDisabled && completionHint && (
              <div className="absolute bottom-9 left-0 right-0 flex justify-center pointer-events-none z-10">
                <span className="bg-black/70 backdrop-blur-sm text-white/70 text-[10px] font-medium px-3 py-1 rounded-full border border-white/10">
                  {completionHint}
                </span>
              </div>
            )}

            <div className="absolute bottom-0 left-0 right-0 h-9 z-20 flex items-center justify-end px-3 gap-1 bg-gradient-to-t from-black/60 to-transparent">
              <button
                onClick={onPrev}
                disabled={currentSlide === 1}
                className="h-6 w-6 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/15 disabled:opacity-25 disabled:cursor-not-allowed transition-all"
                aria-label="Previous slide"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>

              <span className="text-[10px] text-white/40 w-10 text-center tabular-nums select-none">
                {currentSlide} / {totalSlides}
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
            <div className="absolute bottom-0 left-0 right-0 h-px bg-white/10 z-30">
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
