'use client';

import React from 'react';
import Image from 'next/image';
import { PortableText } from '@portabletext/react';
import { ArrowLeftRight, Focus } from 'lucide-react';
import { supMark } from '@/lib/portable-text-components';
import type { CourseLesson } from '@/lib/contracts/player-course';
import {
  InlineDiscoveryCueMark,
  InlineDiscoveryCueProvider,
  type InlineDiscoveryCueResolver,
} from './InlineDiscoveryCue';

interface SplitScreenLessonProps {
  lesson: CourseLesson;
  visitedLabels: Set<string>;
  onVisit: (label: string) => void;
}

const SPLIT_SCREEN_PORTABLE_TEXT_COMPONENTS = {
  marks: { layerLink: InlineDiscoveryCueMark, ...supMark },
};

export function SplitScreenLesson({ lesson, visitedLabels, onVisit }: SplitScreenLessonProps) {
  const isReversed = lesson.splitReverseLayout;
  const imageUrl = lesson.media?.asset?.url;
  const resolveLinkedLayer: InlineDiscoveryCueResolver = (linkedLayer) => {
    const feature = lesson.coveredFeatures?.find((item) => item.label === linkedLayer);
    if (!feature) return undefined;

    return {
      label: feature.label,
      summary: feature.summary,
      visited: visitedLabels.has(feature.label),
      onActivate: () => onVisit(feature.label),
    };
  };

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-y-auto bg-[#f5f1e9] px-6 pt-20 pb-36 md:p-12">
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 bg-[#e7e8f0] md:block" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(255,255,255,0.9),transparent_36%)]" />
      <div
        className={`relative z-10 flex w-full max-w-6xl flex-col ${imageUrl ? 'md:grid md:grid-cols-2' : ''} items-center gap-8 md:gap-14`}
      >
        {/* Media Side */}
        {imageUrl && (
          <div
            className={`relative aspect-[4/3] w-full overflow-hidden rounded-[2rem] border border-white/80 bg-white/50 p-2 shadow-[0_28px_70px_rgba(35,36,48,0.2)] ${
              isReversed ? 'md:order-1' : 'md:order-2'
            }`}
          >
            <div className="relative h-full w-full overflow-hidden rounded-[1.5rem]">
              <Image
                src={imageUrl}
                alt={lesson.headline || ''}
                fill
                priority
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
            <div className="absolute top-5 left-5 flex h-10 w-10 items-center justify-center rounded-full border border-white/60 bg-white/80 text-sm font-bold text-[#685bc7] shadow-sm backdrop-blur">
              02
            </div>
          </div>
        )}

        {/* Text Side */}
        <div className={`flex flex-col justify-center ${isReversed ? 'md:order-2' : 'md:order-1'}`}>
          <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.22em] text-[#685bc7] uppercase">
            <ArrowLeftRight className="h-4 w-4" /> Concept connection
          </p>
          {lesson.headline && (
            <h2 className="mt-4 text-3xl leading-[1.05] font-semibold tracking-tight text-[#18191d] md:text-5xl">
              {lesson.headline}
            </h2>
          )}

          {lesson.body && (
            <div className="prose mt-6 max-w-[58ch] text-base leading-relaxed font-light text-[#5d5a55]">
              {typeof lesson.body === 'string' ? (
                <p>{lesson.body}</p>
              ) : (
                <InlineDiscoveryCueProvider resolveLinkedLayer={resolveLinkedLayer}>
                  <PortableText
                    value={lesson.body}
                    components={SPLIT_SCREEN_PORTABLE_TEXT_COMPONENTS}
                  />
                </InlineDiscoveryCueProvider>
              )}
            </div>
          )}
          <div className="mt-8 flex items-center gap-3 border-t border-[#18191d]/10 pt-5 text-sm text-[#68686e]">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#685bc7] text-white">
              <Focus className="h-4 w-4" />
            </span>
            Connect the visual example to the core idea.
          </div>
        </div>
      </div>
    </div>
  );
}
