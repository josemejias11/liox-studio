"use client";

import { useRef, useState } from "react";
import { ChevronRight, PlayCircle, AlertCircle } from "lucide-react";

interface VideoSlideProps {
  headline: string;
  videoUrl?: string;
  videoFileUrl?: string;
  onNext: () => void;
}

// ── URL → embed URL conversion ─────────────────────────────────────────────

function parseYouTubeId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return m ? m[1] : null;
}

function parseVimeoId(url: string): string | null {
  const m = url.match(/(?:vimeo\.com\/|player\.vimeo\.com\/video\/)(\d+)/);
  return m ? m[1] : null;
}

function getEmbedUrl(url: string): string | null {
  const ytId = parseYouTubeId(url);
  if (ytId) return `https://www.youtube-nocookie.com/embed/${ytId}?rel=0&modestbranding=1&color=white`;

  const vimeoId = parseVimeoId(url);
  if (vimeoId) return `https://player.vimeo.com/video/${vimeoId}?color=38bdf8&title=0&byline=0&portrait=0`;

  return null; // treat as direct MP4
}

// ── Component ──────────────────────────────────────────────────────────────

export function VideoSlide({ headline, videoUrl, videoFileUrl, onNext }: VideoSlideProps) {
  const [hasEnded, setHasEnded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const src = videoUrl || videoFileUrl;

  // ── No source configured ─────────────────────────────────────────────────
  if (!src) {
    return (
      <div className="absolute inset-0 bg-zinc-950 flex flex-col items-center justify-center gap-3">
        <AlertCircle className="h-8 w-8 text-zinc-700" />
        <p className="text-zinc-500 text-[13px]">No video source configured for this slide.</p>
        <button
          onClick={onNext}
          className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-white/50
            hover:text-white px-4 py-2 rounded-full border border-white/10 hover:border-white/25
            transition-all duration-200 active:scale-95"
        >
          Continue <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  const embedUrl = videoUrl ? getEmbedUrl(videoUrl) : null;
  const isEmbed  = !!embedUrl;
  // Embeds (YouTube/Vimeo) can't reliably signal end without platform APIs —
  // always allow navigation so learners aren't blocked.
  const canContinue = isEmbed || hasEnded;

  return (
    <div className="absolute inset-0 bg-zinc-950 flex flex-col select-none">
      {/* Ambient gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_40%,rgba(14,165,233,0.05),transparent)] pointer-events-none" />

      {/* ── Video area ── */}
      <div className="flex-1 flex items-center justify-center px-5 pt-5 pb-2 min-h-0">
        <div
          className="relative w-full rounded-xl overflow-hidden shadow-2xl shadow-black/70"
          style={{ aspectRatio: "16 / 9" }}
        >
          {isEmbed ? (
            <iframe
              src={embedUrl!}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              title={headline}
            />
          ) : (
            <>
              <video
                ref={videoRef}
                src={src}
                controls
                playsInline
                className="absolute inset-0 w-full h-full bg-black"
                onEnded={() => setHasEnded(true)}
              />
              {/* Pre-play overlay — vanishes once video starts */}
              {!hasEnded && (
                <div
                  className="absolute inset-0 flex items-center justify-center pointer-events-none
                    bg-black/20 transition-opacity duration-300"
                  style={{ opacity: videoRef.current?.paused === false ? 0 : 0 }}
                >
                  <PlayCircle className="h-14 w-14 text-white/20" />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Footer: headline + continue ── */}
      <div className="shrink-0 flex items-center justify-between gap-4 px-5 py-3">
        <p className="text-white/35 text-[11px] font-medium truncate flex-1">{headline}</p>

        <button
          onClick={canContinue ? onNext : undefined}
          className={`shrink-0 flex items-center gap-1.5 text-[12px] font-semibold
            px-4 py-2 rounded-full transition-all duration-300 active:scale-95
            ${canContinue
              ? "bg-white text-zinc-900 shadow-lg hover:bg-zinc-100 cursor-pointer"
              : "bg-white/8 text-white/25 cursor-default"
            }`}
          aria-disabled={!canContinue}
          title={canContinue ? undefined : "Watch the video to continue"}
        >
          {canContinue ? "Continue" : "Watch to continue"}
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
