'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { optimizeSanityImage } from '@/lib/image-optimization';
import { titleFromFilename } from '@/lib/utils';
import type { SanityPhoto } from '@/lib/contracts/sanity';

interface PhotoCardStackProps {
  photos: SanityPhoto[];
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

    const cards = Array.from(container.querySelectorAll<HTMLElement>('[data-card]'));
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
      { root: container, threshold: 0.6 },
    );

    cards.forEach((c) => observer.observe(c));
    return () => observer.disconnect();
  }, [validPhotos.length]);

  // Early return AFTER all hooks — rules-of-hooks compliant
  if (!validPhotos.length) return null;

  function scrollTo(idx: number) {
    const container = scrollRef.current;
    if (!container) return;
    const card = container.querySelectorAll<HTMLElement>('[data-card]')[idx];
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }

  const isSingle = validPhotos.length === 1;

  return (
    <div className="group/stack relative select-none">
      {/* Photo row — GPU-composited horizontal scroll, no card background */}
      <div
        ref={scrollRef}
        className={`flex snap-x snap-mandatory gap-6 overflow-x-auto pb-1 ${
          isSingle ? 'justify-center' : ''
        }`}
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        {validPhotos.map((p, i) => {
          const title = titleFromFilename(p.asset?.originalFilename);
          return (
            <div
              key={i}
              data-card
              className={`flex shrink-0 snap-center flex-col items-center gap-2 ${
                isSingle ? 'w-auto' : 'w-[70%]'
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
                  isSingle ? 'max-w-[400px]' : 'w-full'
                }`}
              >
                <Image
                  src={optimizeSanityImage(p.asset!.url!, 600)}
                  alt={title || `Product photo ${i + 1}`}
                  width={600}
                  height={600}
                  className="block h-auto w-full object-contain"
                  draggable={false}
                  loading="lazy"
                />
              </div>

              {/* Caption — below the image, never overlaid on the product */}
              {title && (
                <p className="text-muted-foreground/80 px-2 text-center text-[11px] leading-tight tracking-wide">
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
            className="text-foreground/60 hover:text-foreground absolute top-[42%] left-0 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/8 opacity-0 backdrop-blur-sm transition-opacity duration-150 group-hover/stack:opacity-100 hover:bg-white/16 active:scale-90 disabled:opacity-0"
            aria-label="Previous photo"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => scrollTo(Math.min(validPhotos.length - 1, activeIndex + 1))}
            disabled={activeIndex === validPhotos.length - 1}
            className="text-foreground/60 hover:text-foreground absolute top-[42%] right-0 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/8 opacity-0 backdrop-blur-sm transition-opacity duration-150 group-hover/stack:opacity-100 hover:bg-white/16 active:scale-90 disabled:opacity-0"
            aria-label="Next photo"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </>
      )}

      {/* Dot indicators */}
      {validPhotos.length > 1 && (
        <div className="mt-2 flex justify-center gap-1.5">
          {validPhotos.map((_, i) => (
            <button
              key={i}
              onClick={() => scrollTo(i)}
              aria-label={`Go to photo ${i + 1}`}
              className={`rounded-full transition-all duration-200 ${
                i === activeIndex
                  ? 'bg-accent h-1.5 w-3'
                  : 'bg-foreground/20 hover:bg-foreground/40 h-1.5 w-1.5'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
