"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Photo {
  asset?: { url?: string; originalFilename?: string };
}

interface PhotoCardStackProps {
  photos: Photo[];
}

export function PhotoCardStack({ photos = [] }: PhotoCardStackProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const validPhotos = (photos || []).filter((p) => p.asset?.url);
  if (!validPhotos.length) return null;

  // Track which slide is centred using IntersectionObserver for accuracy
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    const container = scrollRef.current;
    if (!container || validPhotos.length <= 1) return;

    const cards = Array.from(container.querySelectorAll<HTMLElement>("[data-card]"));
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) {
          const idx = cards.indexOf(visible.target as HTMLElement);
          if (idx !== -1) setActiveIndex(idx);
        }
      },
      { root: container, threshold: 0.6 }
    );

    cards.forEach((c) => observer.observe(c));
    return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validPhotos.length]);

  function scrollTo(idx: number) {
    const container = scrollRef.current;
    if (!container) return;
    const card = container.querySelectorAll<HTMLElement>("[data-card]")[idx];
    if (card) {
      card.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }

  function parseTitle(filename?: string) {
    if (!filename) return "";
    let name = filename.replace(/\.[^/.]+$/, "");
    name = name.replace(/[-_]/g, " ");
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  return (
    <div className="relative group/stack select-none">
      {/* Card row — GPU-composited scroll, no hover scale to avoid jank */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 scrollbar-none"
        style={{
          scrollbarWidth: "none",
          WebkitOverflowScrolling: "touch",
          willChange: "scroll-position",
        }}
      >
        {validPhotos.map((p, i) => {
          const title = parseTitle(p.asset?.originalFilename);
          return (
            <div
              key={i}
              data-card
              className={`shrink-0 snap-center aspect-[4/3] rounded-xl overflow-hidden relative
                shadow-lg shadow-black/50 ring-1 ring-white/10
                ${validPhotos.length === 1 ? "w-full" : "w-[82%]"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.asset!.url!}
                alt={title}
                className="w-full h-full object-cover"
                draggable={false}
                loading="lazy"
              />
              {title && (
                <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                  <p className="text-white text-xs font-medium drop-shadow-md">{title}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Prev / next arrows — visible on hover, hidden on touch devices */}
      {validPhotos.length > 1 && (
        <>
          <button
            onClick={() => scrollTo(Math.max(0, activeIndex - 1))}
            disabled={activeIndex === 0}
            className="absolute left-1 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full
              bg-background/70 backdrop-blur-sm text-foreground flex items-center justify-center
              opacity-0 group-hover/stack:opacity-100 disabled:opacity-0
              transition-opacity duration-150 hover:bg-background/90 active:scale-90"
            aria-label="Previous photo"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => scrollTo(Math.min(validPhotos.length - 1, activeIndex + 1))}
            disabled={activeIndex === validPhotos.length - 1}
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full
              bg-background/70 backdrop-blur-sm text-foreground flex items-center justify-center
              opacity-0 group-hover/stack:opacity-100 disabled:opacity-0
              transition-opacity duration-150 hover:bg-background/90 active:scale-90"
            aria-label="Next photo"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </>
      )}

      {/* Reactive dot indicators */}
      {validPhotos.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-2">
          {validPhotos.map((_, i) => (
            <button
              key={i}
              onClick={() => scrollTo(i)}
              aria-label={`Go to photo ${i + 1}`}
              className={`rounded-full transition-all duration-200 ${
                i === activeIndex
                  ? "w-3 h-1.5 bg-accent"
                  : "w-1.5 h-1.5 bg-foreground/20 hover:bg-foreground/40"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
