"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { optimizeSanityImage } from "@/lib/image-optimization";

interface Photo {
  asset?: { url?: string; originalFilename?: string };
}

interface PhotoCardStackProps {
  photos: Photo[];
}

export function PhotoCardStack({ photos = [] }: PhotoCardStackProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // validPhotos derived before hooks so its length is stable across renders
  const validPhotos = (photos || []).filter((p) => p.asset?.url);

  // Track which slide is centred using IntersectionObserver — always invoked
  // (guard inside the effect body) so hook order is unconditional and rule-compliant.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container || validPhotos.length <= 1) return;

    const cards = Array.from(
      container.querySelectorAll<HTMLElement>("[data-card]")
    );
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
  }, [validPhotos.length]);

  // Early return AFTER all hooks — rules-of-hooks compliant
  if (!validPhotos.length) return null;

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

  const isSingle = validPhotos.length === 1;

  return (
    <div className="relative group/stack select-none">
      {/* Photo row — GPU-composited horizontal scroll, no card background */}
      <div
        ref={scrollRef}
        className={`flex gap-6 overflow-x-auto snap-x snap-mandatory pb-1 ${
          isSingle ? "justify-center" : ""
        }`}
        style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
      >
        {validPhotos.map((p, i) => {
          const title = parseTitle(p.asset?.originalFilename);
          return (
            <div
              key={i}
              data-card
              className={`shrink-0 snap-center flex flex-col items-center gap-2 ${
                isSingle ? "w-auto" : "w-[70%]"
              }`}
            >
              {/*
               * Frameless photo — no container background so the phone render
               * floats directly against the dark panel surface. The glow element
               * is a blurred accent circle positioned behind the device.
               * drop-shadow on <img> follows the PNG alpha silhouette rather
               * than boxing the rectangle — critical for transparent product renders.
               */}
              <div
                className={`relative flex items-center justify-center ${
                  isSingle ? "max-w-[400px]" : "w-full"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={optimizeSanityImage(p.asset!.url!, 600)}
                  alt={title || `Product photo ${i + 1}`}
                  className="w-full h-auto block object-contain"
                  draggable={false}
                  loading="lazy"
                />
              </div>

              {/* Caption — below the image, never overlaid on the product */}
              {title && (
                <p className="text-[11px] text-muted-foreground/80 text-center leading-tight tracking-wide px-2">
                  {title}
                </p>
              )}
            </div>
          );
        })}
      </div>

{/* Prev / next arrows — hover-revealed, positioned at image mid-height */}
      {validPhotos.length > 1 && (
        <>
          <button
            onClick={() => scrollTo(Math.max(0, activeIndex - 1))}
            disabled={activeIndex === 0}
            className="absolute left-0 top-[42%] -translate-y-1/2 h-7 w-7 rounded-full
              bg-white/8 backdrop-blur-sm text-foreground/60 flex items-center justify-center
              opacity-0 group-hover/stack:opacity-100 disabled:opacity-0
              transition-opacity duration-150 hover:bg-white/16 hover:text-foreground
              active:scale-90"
            aria-label="Previous photo"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => scrollTo(Math.min(validPhotos.length - 1, activeIndex + 1))}
            disabled={activeIndex === validPhotos.length - 1}
            className="absolute right-0 top-[42%] -translate-y-1/2 h-7 w-7 rounded-full
              bg-white/8 backdrop-blur-sm text-foreground/60 flex items-center justify-center
              opacity-0 group-hover/stack:opacity-100 disabled:opacity-0
              transition-opacity duration-150 hover:bg-white/16 hover:text-foreground
              active:scale-90"
            aria-label="Next photo"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </>
      )}

      {/* Dot indicators */}
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
