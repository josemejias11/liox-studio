'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { sanityImageLoader } from '@/lib/sanity-image-loader';
import type { SanityLesson } from '@/lib/contracts/sanity';

interface ColorSwitcherLessonProps {
  lesson: SanityLesson;
}

export function ColorSwitcherLesson({ lesson }: ColorSwitcherLessonProps) {
  const variants = lesson.colorVariants || [];
  const [sliderValue, setSliderValue] = useState(0);

  if (variants.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <p className="text-muted-foreground">No color variants available.</p>
      </div>
    );
  }

  const maxVal = variants.length - 1;
  const currentIndex = Math.round(sliderValue);
  const currentLabel = variants[currentIndex]?.label || '';

  return (
    <div className="relative flex h-full w-full flex-col bg-background">
      {/* Images Container */}
      <div className="relative flex-1 w-full overflow-hidden flex items-center justify-center">
        {variants.map((variant, i) => {
          const imageUrl = variant.image?.asset?.url;
          if (!imageUrl) return null;
          
          // Calculate opacity based on distance from current slider value
          const distance = Math.abs(sliderValue - i);
          const opacity = Math.max(0, 1 - distance);

          return (
            <div
              key={i}
              className="absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-50 ease-linear motion-reduce:transition-none"
              style={{ opacity }}
            >
              <Image
                src={imageUrl}
                alt={variant.label || 'Color variant'}
                fill
                priority={i === 0}
                sizes="100vw"
                loader={sanityImageLoader}
                className="object-cover"
              />
            </div>
          );
        })}
      </div>

      {/* Control Area */}
      <div className="absolute bottom-12 left-0 right-0 z-10 flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-md bg-card/60 dark:bg-card/95 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-2xl flex flex-col gap-4">
          <div className="flex justify-between items-center px-1">
            <h2 className="text-xl font-semibold text-foreground">{lesson.headline}</h2>
            <div className="flex items-center gap-2">
              {variants[currentIndex]?.colorHex && (
                <span
                  className="h-3 w-3 rounded-full border border-black/10 dark:border-white/10"
                  style={{ backgroundColor: variants[currentIndex]?.colorHex }}
                />
              )}
              <span className="text-sm font-medium text-muted-foreground">{currentLabel}</span>
            </div>
          </div>
          
          <input
            type="range"
            min={0}
            max={maxVal}
            step={0.01}
            value={sliderValue}
            onChange={(e) => setSliderValue(parseFloat(e.target.value))}
            aria-label="Select product color"
            aria-valuetext={currentLabel}
            className="w-full h-2 bg-black/20 dark:bg-white/20 rounded-full appearance-none cursor-grab active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-11 [&::-webkit-slider-thumb]:w-11 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-grab active:[&::-webkit-slider-thumb]:cursor-grabbing [&::-moz-range-thumb]:h-11 [&::-moz-range-thumb]:w-11 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:cursor-grab active:[&::-moz-range-thumb]:cursor-grabbing"
            style={{
              WebkitAppearance: 'none',
            }}
          />
        </div>
      </div>
    </div>
  );
}
