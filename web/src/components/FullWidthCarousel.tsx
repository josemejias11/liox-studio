"use client";

import { useRef, useState, useEffect } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { optimizeSanityImage } from "@/lib/image-optimization";
import { titleFromFilename } from "@/lib/utils";
import type { SanityPhoto } from "@/lib/contracts/sanity";

export function FullWidthCarousel({ photos, className = "" }: { photos: SanityPhoto[], className?: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const validPhotos = (photos || []).filter((p) => p.asset?.url);

  function scroll(dir: "left" | "right") {
    if (!scrollRef.current) return;
    const width = scrollRef.current.offsetWidth;
    scrollRef.current.scrollBy({ left: dir === "right" ? width : -width, behavior: "smooth" });
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
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  if (!validPhotos.length) return null;

  return (
    <div className={`rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10 relative group/carousel bg-black/20 ${className}`}>
      <div 
        ref={scrollRef}
        className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth hide-scrollbar"
        style={{ scrollbarWidth: 'none' }}
      >
        {validPhotos.map((p, i) => {
          const title = titleFromFilename(p.asset?.originalFilename);
          return (
            <div key={i} className="relative w-full shrink-0 snap-center">
              <Image 
                src={optimizeSanityImage(p.asset!.url!, 1200)} 
                alt={title || `Gallery image ${i + 1}`} 
                width={1200}
                height={800}
                className="w-full h-auto object-cover" 
                style={{ maxHeight: '50vh' }} 
                draggable={false}
              />
              {title && (
                <div className="absolute bottom-0 inset-x-0 p-4 bg-linear-to-t from-black/80 via-black/40 to-transparent">
                  <p className="text-white text-sm md:text-base font-medium drop-shadow-md text-center">{title}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {validPhotos.length > 1 && (
        <>
          <button
            onClick={() => scroll("left")}
            className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full
              bg-background/60 backdrop-blur-sm text-foreground flex items-center justify-center
              opacity-0 md:group-hover/carousel:opacity-100 transition-opacity duration-150
              hover:bg-background/80 active:scale-90 z-10 shadow-lg"
            aria-label="Previous photo"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => scroll("right")}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full
              bg-background/60 backdrop-blur-sm text-foreground flex items-center justify-center
              opacity-0 md:group-hover/carousel:opacity-100 transition-opacity duration-150
              hover:bg-background/80 active:scale-90 z-10 shadow-lg"
            aria-label="Next photo"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 pointer-events-none z-10">
            {validPhotos.map((_, i) => (
              <div 
                key={i} 
                className={`w-1.5 h-1.5 rounded-full backdrop-blur-sm transition-all duration-300 ${
                  i === currentIndex ? "bg-white scale-110" : "bg-white/40"
                }`} 
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
