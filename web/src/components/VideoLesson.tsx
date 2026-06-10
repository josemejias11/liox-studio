"use client";

import { useState } from "react";
import { ChevronRight, AlertCircle } from "lucide-react";
import { cssAspectRatio } from "@/lib/utils";

interface VideoLessonProps {
  headline: string;
  videoFileUrl?: string;
  videoAspectRatio?: string;
  onNext: () => void;
}

export function VideoLesson({ headline, videoFileUrl, videoAspectRatio = "16:9", onNext }: VideoLessonProps) {
  const [hasEnded, setHasEnded] = useState(false);

  const src = videoFileUrl;
  const aspectRatio = cssAspectRatio(videoAspectRatio);

  // ── No source configured ─────────────────────────────────────────────────
  if (!src) {
    return (
      <div className="absolute inset-0 bg-background flex flex-col items-center justify-center gap-3">
        <AlertCircle className="h-8 w-8 text-muted-foreground" />
        <p className="text-muted-foreground text-[13px]">No video source configured for this lesson.</p>
        <button
          onClick={onNext}
          className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-foreground/50
            hover:text-foreground px-4 py-2 rounded-full border border-border/10 hover:border-border/25
            transition-all duration-200 active:scale-95"
        >
          Continue <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  // Without external embeds, we strictly rely on HTML5 video events
  const canContinue = hasEnded;

  return (
    <div className="absolute inset-0 bg-background flex flex-col select-none">
      {/* Ambient gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_40%,rgba(104,91,199,0.05),transparent)] pointer-events-none" />

      {/* ── Video area ── */}
      <div className="flex-1 flex items-center justify-center px-5 pt-5 pb-2 min-h-0">
        <div className="relative w-full h-full rounded-xl overflow-hidden shadow-2xl shadow-black/70 bg-black flex items-center justify-center">
          <video
            src={src}
            controls
            playsInline
            className="w-full h-full object-contain"
            style={{ aspectRatio }}
            onEnded={() => setHasEnded(true)}
          />
        </div>
      </div>

      {/* ── Footer: headline + continue ── */}
      <div className="shrink-0 flex items-center justify-between gap-4 px-5 py-3">
        <p className="text-foreground/35 text-[11px] font-medium truncate flex-1">{headline}</p>

        <button
          onClick={onNext}
          disabled={!canContinue}
          className={`shrink-0 flex items-center gap-1.5 text-[12px] font-semibold
            px-4 py-2 rounded-full transition-all duration-300 active:scale-95
            ${canContinue
              ? "bg-background text-foreground shadow-lg hover:bg-background/90 cursor-pointer"
              : "bg-background/8 text-foreground/25 cursor-default"
            }`}
          title={canContinue ? undefined : "Watch the video to continue"}
        >
          {canContinue ? "Continue" : "Watch to continue"}
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
