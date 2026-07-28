'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { CircleGauge, Palette, SwatchBook } from 'lucide-react';
import type { CourseLesson } from '@/lib/contracts/course';

interface ColorSwitcherLessonProps {
  lesson: CourseLesson;
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
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#e9eaf2]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_65%_55%_at_50%_42%,rgba(255,255,255,0.98),transparent_72%)]" />
      <header className="absolute top-0 right-0 left-0 z-10 flex items-start justify-between px-6 pt-6 md:px-10 md:pt-8">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.24em] text-[#685bc7] uppercase">Configuration studio</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#18191d] md:text-3xl">{lesson.headline}</h2>
          <p className="mt-1 max-w-md text-sm text-[#636880]">Compare treatments and observe how each finish changes the product expression.</p>
        </div>
        <div className="hidden items-center gap-2 rounded-full border border-[#18191d]/10 bg-white/70 px-3 py-2 text-xs font-medium text-[#595b66] shadow-sm backdrop-blur md:flex">
          <CircleGauge className="h-4 w-4 text-[#685bc7]" /> Learning comparison
        </div>
      </header>

      {/* Images Container */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-6 pt-28 pb-40 md:px-10 md:pt-32 md:pb-44">
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
                className="object-contain drop-shadow-[0_30px_45px_rgba(24,25,29,0.2)]"
              />
            </div>
          );
        })}
      </div>

      {/* Control Area */}
      <div className="absolute right-0 bottom-8 left-0 z-10 flex flex-col items-center justify-center px-6 md:bottom-10">
        <div className="flex w-full max-w-3xl flex-col gap-4 rounded-[1.75rem] border border-white/80 bg-white/78 p-5 shadow-[0_18px_45px_rgba(24,25,29,0.14)] backdrop-blur-xl md:p-6">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-[#595b66] uppercase">
              <SwatchBook className="h-4 w-4 text-[#685bc7]" /> Finish comparison
            </div>
            <div className="flex items-center gap-2">
              {variants[currentIndex]?.colorHex && (
                <span
                  className="h-3 w-3 rounded-full border border-black/10 dark:border-white/10"
                  style={{ backgroundColor: variants[currentIndex]?.colorHex }}
                />
              )}
              <span className="text-sm font-semibold text-[#18191d]">{currentLabel}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {variants.map((variant, index) => (
              <button
                key={`${variant.label}-${index}`}
                type="button"
                onClick={() => setSliderValue(index)}
                className={`flex min-w-24 items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs transition-colors ${
                  index === currentIndex
                    ? 'border-[#685bc7] bg-[#685bc7]/10 text-[#312c73]'
                    : 'border-[#18191d]/10 bg-white/65 text-[#595b66] hover:border-[#685bc7]/50'
                }`}
                aria-pressed={index === currentIndex}
              >
                <Palette className="h-3.5 w-3.5" style={{ color: variant.colorHex || '#685bc7' }} />
                {variant.label || `Option ${index + 1}`}
              </button>
            ))}
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
            className="h-2 w-full cursor-grab appearance-none rounded-full bg-[#18191d]/15 active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-[#685bc7] focus-visible:ring-offset-2 [&::-webkit-slider-thumb]:h-11 [&::-webkit-slider-thumb]:w-11 [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#685bc7] [&::-webkit-slider-thumb]:shadow-md active:[&::-webkit-slider-thumb]:cursor-grabbing [&::-moz-range-thumb]:h-11 [&::-moz-range-thumb]:w-11 [&::-moz-range-thumb]:cursor-grab [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:bg-[#685bc7] [&::-moz-range-thumb]:shadow-md"
            style={{
              WebkitAppearance: 'none',
            }}
          />
        </div>
      </div>
    </div>
  );
}
