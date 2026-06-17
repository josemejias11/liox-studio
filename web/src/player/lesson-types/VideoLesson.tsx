'use client';

import { useState } from 'react';
import { ChevronRight, AlertCircle } from 'lucide-react';
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
    <div className="bg-background absolute inset-0 flex flex-col select-none">
      {/* Ambient gradient */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_40%,rgba(104,91,199,0.05),transparent)]" />

      {/* ── Video area ── */}
      <div className="flex min-h-0 flex-1 items-center justify-center px-5 pt-5 pb-24">
        <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-xl bg-black shadow-2xl shadow-black/70">
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
