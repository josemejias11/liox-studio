'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { CoursePhoto } from '@/shared/contracts/player-course';

interface PhotoCardStackProps {
  photos: CoursePhoto[];
  autoScrollInterval?: number;
}

export function PhotoCardStack({ photos = [], autoScrollInterval = 3500 }: PhotoCardStackProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const validPhotos = (photos || []).filter((p) => p.asset?.url);
  const isSingle = validPhotos.length <= 1;
  useEffect(() => {
    if (isSingle || isHovered) return;
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % validPhotos.length);
    }, autoScrollInterval);
    return () => clearInterval(timer);
  }, [validPhotos.length, isHovered, isSingle, autoScrollInterval]);

  if (!validPhotos.length) return null;

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
    setIsHovered(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    setIsHovered(false);
    if (touchStart === null || touchEnd === null) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe && activeIndex < validPhotos.length - 1) {
      setActiveIndex((prev) => prev + 1);
    } else if (isRightSwipe && activeIndex > 0) {
      setActiveIndex((prev) => prev - 1);
    }
    setTouchStart(null);
    setTouchEnd(null);
  };

  return (
    <div
      className="group/stack relative w-full select-none"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative w-full overflow-hidden rounded-2xl">
        <div
          className="flex transition-transform duration-500 ease-[cubic-bezier(0.25,1,0.5,1)]"
          style={{ transform: `translateX(-${activeIndex * 100}%)` }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {validPhotos.map((p, i) => (
            <div key={i} className="flex w-full shrink-0 flex-col items-center gap-3 pb-1">
              <div className="relative flex w-full max-w-[480px] items-center justify-center">
                <Image
                  src={p.asset!.url!}
                  alt={`Product photo ${i + 1}`}
                  width={800}
                  height={800}
                  className="pointer-events-none block h-auto max-h-[50vh] w-full object-contain drop-shadow-xl"
                  draggable={false}
                  loading={i === 0 ? 'eager' : 'lazy'}
                  priority={i === 0}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      {!isSingle && (
        <>
          <button
            onClick={() => setActiveIndex(Math.max(0, activeIndex - 1))}
            disabled={activeIndex === 0}
            className="text-foreground hover:text-foreground bg-background/50 hover:bg-background/80 absolute top-[40%] left-2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full shadow-lg backdrop-blur-md transition-all active:scale-90 disabled:opacity-0 md:opacity-0 md:group-hover/stack:opacity-100"
            aria-label="Previous photo"
          >
            <ChevronLeft className="ml-[-2px] h-5 w-5" />
          </button>
          <button
            onClick={() => setActiveIndex(Math.min(validPhotos.length - 1, activeIndex + 1))}
            disabled={activeIndex === validPhotos.length - 1}
            className="text-foreground hover:text-foreground bg-background/50 hover:bg-background/80 absolute top-[40%] right-2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full shadow-lg backdrop-blur-md transition-all active:scale-90 disabled:opacity-0 md:opacity-0 md:group-hover/stack:opacity-100"
            aria-label="Next photo"
          >
            <ChevronRight className="mr-[-2px] h-5 w-5" />
          </button>
        </>
      )}
      {!isSingle && (
        <div className="z-10 mt-3 flex justify-center gap-2">
          {validPhotos.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveIndex(i)}
              aria-label={`Go to photo ${i + 1}`}
              className={`rounded-full transition-all duration-300 ${
                i === activeIndex
                  ? 'bg-accent h-2 w-5'
                  : 'bg-foreground/20 hover:bg-foreground/40 h-2 w-2'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
