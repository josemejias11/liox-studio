'use client';

import { AlertCircle, ChevronRight, Clapperboard, Play } from 'lucide-react';
import { cssAspectRatio } from '@/lib/utils';

interface VideoLessonProps {
  headline: string;
  videoFileUrl?: string;
  videoAspectRatio?: string;
  onComplete?: () => void;
}

export function VideoLesson({
  headline,
  videoFileUrl,
  videoAspectRatio = '16:9',
  onComplete,
}: VideoLessonProps) {
  const src = videoFileUrl;
  const aspectRatio = cssAspectRatio(videoAspectRatio);

  // ── No source configured ─────────────────────────────────────────────────
  if (!src) {
    return (
      <div className="bg-background absolute inset-0 flex flex-col items-center justify-center gap-3">
        <AlertCircle className="text-muted-foreground h-8 w-8" />
        <p className="text-muted-foreground text-[13px]">
          No video source configured for this lesson.
        </p>
        <button
          onClick={() => onComplete?.()}
          className="text-foreground/50 hover:text-foreground border-border/10 hover:border-border/25 mt-2 flex items-center gap-1.5 rounded-full border px-4 py-2 text-[12px] font-semibold transition-all duration-200 active:scale-95"
        >
          Mark Complete <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden bg-[#07080d] text-white select-none">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_46%,rgba(104,91,199,0.22),transparent_68%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.025)_0%,transparent_30%,rgba(255,255,255,0.018)_60%,transparent_100%)]" />

      <header className="relative z-10 flex shrink-0 items-start justify-between gap-4 px-6 pt-6 md:px-10 md:pt-8">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.22em] text-[#bcb4ff] uppercase">
            <Clapperboard className="h-4 w-4" /> Watch and learn
          </p>
          <h2 className="mt-2 max-w-2xl text-2xl font-semibold tracking-tight md:text-3xl">
            {headline}
          </h2>
        </div>
        <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/58 backdrop-blur md:flex">
          <Play className="h-3.5 w-3.5 text-[#bcb4ff]" />
          Complete the video to continue
        </div>
      </header>

      {/* ── Video area ── */}
      <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-5 pt-5 pb-24 md:px-10 md:pt-7">
        <div className="relative flex h-full w-full max-w-6xl items-center justify-center overflow-hidden rounded-[1.75rem] border border-white/10 bg-black shadow-[0_30px_90px_rgba(0,0,0,0.72)]">
          <div className="pointer-events-none absolute top-0 right-0 left-0 z-10 h-px bg-linear-to-r from-transparent via-white/25 to-transparent" />
          <video
            src={src}
            controls
            autoPlay
            playsInline
            className="h-full w-full object-contain"
            style={{ aspectRatio }}
            onEnded={() => onComplete?.()}
          />
        </div>
      </div>
    </div>
  );
}
