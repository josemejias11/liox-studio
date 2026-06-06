"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { SlideFrame } from "./SlideFrame";
import { Hotspot } from "./Hotspot";
import { SlideLayer } from "./SlideLayer";

interface SanityHotspot {
  _key: string;
  label: string;
  topic: string;
  x: number;
  y: number;
}

interface SanitySlide {
  _key: string;
  headline: string;
  body?: string;
  slideType: "content" | "interaction" | "video" | "quiz";
  media?: { asset?: { url?: string } };
  hotspots?: SanityHotspot[];
  speakerNotes?: string;
  lessonTitle?: string;
}

interface SanityModule {
  _id: string;
  title: string;
}

export default function DeckViewer({
  module,
  slides,
}: {
  module: SanityModule;
  slides: SanitySlide[];
}) {
  const [hasStarted, setHasStarted] = useState(false);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [activeLayer, setActiveLayer] = useState<{ topic: string; title: string } | null>(null);
  const [visited, setVisited] = useState<Record<string, Set<string>>>({});

  const currentSlide = slides[currentSlideIndex];
  const slideKey = currentSlide?._key ?? "";
  const hotspots = currentSlide?.hotspots ?? [];
  const visitedOnSlide = visited[slideKey]?.size ?? 0;
  const nextLocked = hotspots.length > 0 && visitedOnSlide < hotspots.length;
  const imageUrl = currentSlide?.media?.asset?.url;

  function markVisited(label: string) {
    setVisited((prev) => ({
      ...prev,
      [slideKey]: new Set([...(prev[slideKey] ?? []), label]),
    }));
  }

  // ── Cover ──────────────────────────────────────────────────────────────────
  if (!hasStarted) {
    const coverImage = slides[0]?.media?.asset?.url;
    return (
      <SlideFrame>
        {coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverImage} alt="Course cover" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-zinc-900 flex items-center justify-center">
            <p className="text-white text-2xl font-light">{module.title}</p>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
        <button
          onClick={() => setHasStarted(true)}
          className="absolute bottom-8 right-8 flex items-center gap-2 bg-white text-zinc-900 font-semibold text-sm px-5 py-2.5 rounded-sm shadow-xl hover:bg-zinc-100 active:scale-95 transition-all"
        >
          start course <ChevronRight className="h-4 w-4" />
        </button>
      </SlideFrame>
    );
  }

  // ── Course viewer ──────────────────────────────────────────────────────────
  return (
    <SlideFrame
      currentSlide={currentSlideIndex + 1}
      totalSlides={slides.length}
      onPrev={() => { setCurrentSlideIndex((i) => Math.max(0, i - 1)); setActiveLayer(null); }}
      onNext={() => { setCurrentSlideIndex((i) => Math.min(slides.length - 1, i + 1)); setActiveLayer(null); }}
      nextDisabled={nextLocked}
      completionHint={
        nextLocked
          ? `Tap all ${hotspots.length} features to continue (${visitedOnSlide} / ${hotspots.length})`
          : undefined
      }
    >
      {/* Slide content — image from Sanity CDN or text fallback */}
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt={currentSlide.headline} className="absolute inset-0 w-full h-full object-contain" />
      ) : (
        <div className="absolute inset-0 bg-white flex flex-col items-start justify-center p-[6%] overflow-auto gap-4">
          <h2 className="text-zinc-900 text-2xl font-semibold leading-tight">{currentSlide?.headline}</h2>
          {currentSlide?.body && (
            <p className="text-zinc-600 text-base font-light leading-relaxed whitespace-pre-wrap">{currentSlide.body}</p>
          )}
        </div>
      )}

      {/* Hotspots — driven directly from Sanity content */}
      {hotspots.map((h) => (
        <Hotspot
          key={h._key}
          x={h.x}
          y={h.y}
          label={h.label}
          visited={visited[slideKey]?.has(h.label) ?? false}
          onVisit={() => markVisited(h.label)}
          onOpen={() => setActiveLayer({ topic: h.topic, title: h.label })}
        />
      ))}

      {/* AI Layer */}
      <SlideLayer
        open={activeLayer !== null}
        onClose={() => setActiveLayer(null)}
        title={activeLayer?.title ?? ""}
        topic={activeLayer?.topic}
      />
    </SlideFrame>
  );
}
