"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Photo {
  asset?: { url?: string };
}

interface PhotoCardStackProps {
  photos: Photo[];
}

export function PhotoCardStack({ photos }: PhotoCardStackProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const validPhotos = photos.filter((p) => p.asset?.url);
  if (!validPhotos.length) return null;

  function scroll(dir: "left" | "right") {
    if (!scrollRef.current) return;
    const card = scrollRef.current.querySelector("[data-card]") as HTMLElement | null;
    const step = card ? card.offsetWidth + 12 : 220;
    scrollRef.current.scrollBy({ left: dir === "right" ? step : -step, behavior: "smooth" });
  }

  return (
    <div className="relative group/stack">
      {/* Card row */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth
          pb-2 scrollbar-none"
        style={{ scrollbarWidth: "none" }}
      >
        {validPhotos.map((p, i) => (
          <div
            key={i}
            data-card
            className="shrink-0 snap-start w-[78%] aspect-[4/3] rounded-xl overflow-hidden
              shadow-lg shadow-black/50 ring-1 ring-white/10
              transition-transform duration-200 hover:scale-[1.02]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.asset!.url!}
              alt=""
              className="w-full h-full object-cover"
              draggable={false}
            />
          </div>
        ))}
      </div>

      {/* Scroll arrows — appear on hover when multiple photos */}
      {validPhotos.length > 1 && (
        <>
          <button
            onClick={() => scroll("left")}
            className="absolute left-1 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full
              bg-moto-black/60 backdrop-blur-sm text-moto-frost flex items-center justify-center
              opacity-0 group-hover/stack:opacity-100 transition-opacity duration-150
              hover:bg-moto-black/80 active:scale-90"
            aria-label="Previous photo"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => scroll("right")}
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full
              bg-moto-black/60 backdrop-blur-sm text-moto-frost flex items-center justify-center
              opacity-0 group-hover/stack:opacity-100 transition-opacity duration-150
              hover:bg-moto-black/80 active:scale-90"
            aria-label="Next photo"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </>
      )}

      {/* Dot indicators */}
      {validPhotos.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-1">
          {validPhotos.map((_, i) => (
            <span
              key={i}
              className="h-1 w-1 rounded-full bg-moto-frost/30"
            />
          ))}
        </div>
      )}
    </div>
  );
}
