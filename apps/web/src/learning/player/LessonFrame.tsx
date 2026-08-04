'use client';

import { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, LayoutGrid, Lock } from 'lucide-react';

type SectionType = 'lesson' | 'specification' | 'quiz' | 'disclaimer';

interface LessonFrameProps {
  children: ReactNode;
  contained?: boolean;
  currentLesson?: number;
  totalLessons?: number;
  onPrev?: () => void;
  onNext?: () => void;
  nextDisabled?: boolean;
  completionHint?: string;
  className?: string;
  onToggleNavMap?: () => void;
  moduleTitle?: string;
  sectionType?: SectionType;
}

const SECTION_LABELS: Record<SectionType, string | null> = {
  lesson: null,
  specification: 'Specifications',
  quiz: 'Knowledge Check',
  disclaimer: 'Disclaimer',
};

export function LessonFrame({
  children,
  contained = false,
  currentLesson,
  totalLessons,
  onPrev,
  onNext,
  nextDisabled = false,
  completionHint,
  className = '',
  onToggleNavMap,
  moduleTitle,
  sectionType = 'lesson',
}: LessonFrameProps) {
  const showNav = (currentLesson !== undefined && totalLessons !== undefined) || onNext !== undefined;

  const showProgress =
    currentLesson !== undefined && totalLessons !== undefined && totalLessons > 0;
  const sectionLabel = SECTION_LABELS[sectionType];
  const isLessonType = sectionType === 'lesson';

  return (
    <div
      className={`font-product bg-glass-gradient flex w-full flex-col items-center justify-start overflow-hidden ${
        contained ? 'h-full' : 'h-dvh'
      }`}
    >
      <div
        className={`relative w-full flex-1 overflow-clip rounded-none ${className}`}
      >
        {children}

        <div className="from-background pointer-events-none absolute right-0 bottom-0 left-0 z-10 h-40 bg-linear-to-t to-transparent" />

        {!showNav && onToggleNavMap && (
          <button
            onClick={onToggleNavMap}
            aria-label="Open course navigation"
            title="Course map"
            className="bg-background/50 text-foreground/40 hover:text-foreground hover:bg-background/80 absolute bottom-4 left-4 z-50 flex h-10 w-10 items-center justify-center rounded-full shadow-md backdrop-blur-sm transition-[color,background-color,opacity] duration-150"
          >
            <LayoutGrid className="h-5 w-5" />
          </button>
        )}

        {showNav && (
          <>
            {nextDisabled && completionHint && (
              <div className="pointer-events-none absolute right-0 bottom-24 left-0 z-10 flex justify-center">
                <span className="glass-panel text-foreground rounded-full px-5 py-2 text-sm font-medium shadow-xl">
                  {completionHint}
                </span>
              </div>
            )}

            <div className="pointer-events-none absolute right-4 bottom-6 left-4 z-20 flex items-end justify-between">
              {onToggleNavMap ? (
                <button
                  onClick={onToggleNavMap}
                  aria-label="Open course navigation"
                  title="Course map"
                  className="pointer-events-auto glass-panel text-foreground/60 hover:text-foreground flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-[color,background-color,opacity,transform] hover:scale-105 active:scale-95"
                >
                  <LayoutGrid className="h-5 w-5" />
                </button>
              ) : (
                <div />
              )}

              <div className="pointer-events-auto glass-panel flex h-14 items-center gap-2 rounded-full px-2 shadow-lg">
                {onPrev !== undefined && (
                  <button
                    onClick={onPrev}
                    disabled={currentLesson === 1}
                    className="text-foreground/60 hover:text-foreground hover:bg-foreground/10 flex h-10 w-10 items-center justify-center rounded-full transition-[color,background-color,opacity] disabled:cursor-not-allowed disabled:opacity-25"
                    aria-label="Previous lesson"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                )}

                {isLessonType && (
                  <>
                    <span
                      className="text-foreground/80 min-w-10 text-center text-sm font-medium tabular-nums select-none"
                      aria-hidden="true"
                    >
                      {currentLesson} / {totalLessons}
                    </span>
                    <span aria-live="polite" aria-atomic="true" className="sr-only">
                      Lesson {currentLesson} of {totalLessons}
                    </span>
                  </>
                )}

                <button
                  onClick={onNext}
                  disabled={nextDisabled}
                  className={`flex h-10 w-10 items-center justify-center rounded-full transition-[color,background-color,opacity] ${
                    nextDisabled 
                      ? 'text-foreground/40 bg-foreground/5 cursor-not-allowed' 
                      : 'text-foreground hover:bg-foreground/10 bg-accent/10 completion-button-glow'
                  }`}
                  aria-label="Next lesson"
                >
                  {nextDisabled ? <Lock className="h-4 w-4" /> : <ChevronRight className="h-6 w-6" />}
                </button>
              </div>
            </div>

            {currentLesson !== undefined && totalLessons !== undefined && (
              <div
                role="progressbar"
                aria-valuenow={currentLesson}
                aria-valuemin={1}
                aria-valuemax={totalLessons}
                aria-label="Course progress"
                className="bg-foreground/10 absolute right-0 bottom-0 left-0 z-30 h-px"
              >
                <div
                  className="bg-accent h-full transition-[width] duration-500 ease-out"
                  style={{ width: `${(currentLesson / totalLessons) * 100}%` }}
                />
              </div>
            )}
          </>
        )}
      </div>

      {moduleTitle && (
        <div
          aria-hidden="true"
          className="glass-panel rounded-t-3xl border-b-0 flex w-full shrink-0 flex-col items-center justify-center gap-1 py-3"
        >
          <p className="text-muted-foreground text-[11px] leading-none font-medium tracking-[0.22em] uppercase">
            You are learning about
          </p>

          <p className="text-foreground text-center text-3xl leading-none font-bold">
            {moduleTitle}
          </p>

          <span className="bg-accent mt-1 block h-0.5 w-10 rounded-full" />

          {sectionLabel ? (
            <p className="text-accent mt-1 text-xs leading-none font-semibold tracking-[0.18em] uppercase">
              {sectionLabel}
            </p>
          ) : (
            <p
              className={`text-muted-foreground/70 mt-1 text-xs leading-none tabular-nums ${showProgress ? '' : 'invisible'}`}
            >
              lesson {currentLesson}&thinsp;/&thinsp;{totalLessons}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
