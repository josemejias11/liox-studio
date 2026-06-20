'use client';

import { useRef, useState, useEffect } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { titleFromFilename } from '@/lib/utils';
import type { SanityPhoto } from '@/lib/contracts/sanity';

export function FullWidthCarousel({
  photos,
  className = '',
}: {
  photos: SanityPhoto[];
  className?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const validPhotos = (photos || []).filter((p) => p.asset?.url);

  function scroll(dir: 'left' | 'right') {
    if (!scrollRef.current) return;
    const width = scrollRef.current.offsetWidth;
    scrollRef.current.scrollBy({ left: dir === 'right' ? width : -width, behavior: 'smooth' });
  }

  // Update dots on scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let frame: number;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const idx = Math.round(el.scrollLeft / el.offsetWidth);
        setCurrentIndex(idx);
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  if (!validPhotos.length) return null;

  return (
    <div
      className={`group/carousel relative overflow-hidden rounded-2xl bg-black/20 shadow-2xl ring-1 ring-white/10 ${className}`}
    >
      <div
        ref={scrollRef}
        className="hide-scrollbar flex snap-x snap-mandatory overflow-x-auto scroll-smooth"
        style={{ scrollbarWidth: 'none' }}
      >
        {validPhotos.map((p, i) => {
          const title = titleFromFilename(p.asset?.originalFilename);
          return (
            <div key={i} className="relative w-full shrink-0 snap-center">
              <Image
                src={p.asset!.url!}
                alt={title || `Gallery image ${i + 1}`}
                width={1200}
                height={800}
                className="h-auto w-full object-cover"
                style={{ maxHeight: '50vh' }}
                draggable={false}
              />
              {title && (
                <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 via-black/40 to-transparent p-4">
                  <p className="text-center text-sm font-medium text-white drop-shadow-md md:text-base">
                    {title}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {validPhotos.length > 1 && (
        <>
          <button
            onClick={() => scroll('left')}
            className="bg-background/60 text-foreground hover:bg-background/80 absolute top-1/2 left-2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full opacity-0 shadow-lg backdrop-blur-sm transition-opacity duration-150 active:scale-90 md:group-hover/carousel:opacity-100"
            aria-label="Previous photo"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => scroll('right')}
            className="bg-background/60 text-foreground hover:bg-background/80 absolute top-1/2 right-2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full opacity-0 shadow-lg backdrop-blur-sm transition-opacity duration-150 active:scale-90 md:group-hover/carousel:opacity-100"
            aria-label="Next photo"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <div className="pointer-events-none absolute right-0 bottom-3 left-0 z-10 flex justify-center gap-1.5">
            {validPhotos.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 w-1.5 rounded-full backdrop-blur-sm transition-all duration-300 ${
                  i === currentIndex ? 'scale-110 bg-white' : 'bg-white/40'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
