'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { titleFromFilename } from '@/lib/utils';
import type { CoursePhoto } from '@/lib/contracts/player-course';

interface PhotoCardStackProps {
  photos: CoursePhoto[];
  autoScrollInterval?: number;
}

export function PhotoCardStack({ photos = [], autoScrollInterval = 3500 }: PhotoCardStackProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  
  // Touch swipe state
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const validPhotos = (photos || []).filter((p) => p.asset?.url);
  const isSingle = validPhotos.length <= 1;

  // Auto-scroll logic
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
    
    // Reset after swipe
    setTouchStart(null);
    setTouchEnd(null);
  };

  return (
    <div 
      className="group/stack relative w-full select-none"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Carousel Track */}
      <div className="overflow-hidden w-full relative rounded-2xl">
        <div
          className="flex transition-transform duration-500 ease-[cubic-bezier(0.25,1,0.5,1)]"
          style={{ transform: `translateX(-${activeIndex * 100}%)` }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {validPhotos.map((p, i) => {
            const title = titleFromFilename(p.asset?.originalFilename);
            return (
              <div
                key={i}
                className="flex w-full shrink-0 flex-col items-center gap-3 pb-1"
              >
                <div className="relative flex w-full max-w-[480px] items-center justify-center">
                  <Image
                    src={p.asset!.url!}
                    alt={title || `Product photo ${i + 1}`}
                    width={800}
                    height={800}
                    className="block h-auto w-full max-h-[50vh] object-contain pointer-events-none drop-shadow-xl"
                    draggable={false}
                    loading={i === 0 ? 'eager' : 'lazy'}
                    priority={i === 0}
                  />
                </div>
                {title && (
                  <p className="text-muted-foreground px-4 text-center text-[12px] font-medium leading-relaxed tracking-wide">
                    {title}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Navigation Arrows */}
      {!isSingle && (
        <>
          <button
            onClick={() => setActiveIndex(Math.max(0, activeIndex - 1))}
            disabled={activeIndex === 0}
            className="text-foreground hover:text-foreground absolute top-[40%] left-2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/50 backdrop-blur-md shadow-lg transition-all hover:bg-background/80 active:scale-90 disabled:opacity-0 z-10 md:opacity-0 md:group-hover/stack:opacity-100"
            aria-label="Previous photo"
          >
            <ChevronLeft className="h-5 w-5 ml-[-2px]" />
          </button>
          <button
            onClick={() => setActiveIndex(Math.min(validPhotos.length - 1, activeIndex + 1))}
            disabled={activeIndex === validPhotos.length - 1}
            className="text-foreground hover:text-foreground absolute top-[40%] right-2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/50 backdrop-blur-md shadow-lg transition-all hover:bg-background/80 active:scale-90 disabled:opacity-0 z-10 md:opacity-0 md:group-hover/stack:opacity-100"
            aria-label="Next photo"
          >
            <ChevronRight className="h-5 w-5 mr-[-2px]" />
          </button>
        </>
      )}

      {/* Pagination Dots */}
      {!isSingle && (
        <div className="mt-3 flex justify-center gap-2 z-10">
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
