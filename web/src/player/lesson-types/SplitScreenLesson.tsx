'use client';

import React from 'react';
import Image from 'next/image';
import { PortableText } from '@portabletext/react';
import { sanityImageLoader } from '@/lib/sanity-image-loader';
import type { SanityLesson } from '@/lib/contracts/sanity';

interface SplitScreenLessonProps {
  lesson: SanityLesson;
}

export function SplitScreenLesson({ lesson }: SplitScreenLessonProps) {
  const isReversed = lesson.splitReverseLayout;
  const imageUrl = lesson.media?.asset?.url;

  return (
    <div className="flex h-full w-full items-center justify-center bg-background px-6 py-8 md:p-12 overflow-y-auto">
      <div
        className={`flex w-full max-w-6xl flex-col ${imageUrl ? 'md:grid md:grid-cols-2' : ''} gap-6 md:gap-8 items-center`}
      >
        {/* Media Side */}
        {imageUrl && (
          <div
            className={`w-full aspect-[4/3] relative rounded-lg overflow-hidden shadow-xl ${
              isReversed ? 'md:order-1' : 'md:order-2'
            }`}
          >
            <Image
              src={imageUrl}
              alt={lesson.headline || ''}
              fill
              priority
              sizes="(max-width: 768px) 100vw, 50vw"
              loader={sanityImageLoader}
              className="object-cover"
            />
          </div>
        )}

        {/* Text Side */}
        <div
          className={`flex flex-col justify-center space-y-6 ${
            isReversed ? 'md:order-2' : 'md:order-1'
          }`}
        >
          {lesson.headline && (
            <h2 className="text-3xl md:text-4xl font-semibold text-foreground leading-tight">
              {lesson.headline}
            </h2>
          )}
          
          {lesson.body && (
            <div className="prose dark:prose-invert max-w-[65ch] text-base leading-relaxed text-muted-foreground font-light">
              {typeof lesson.body === 'string' ? (
                <p>{lesson.body}</p>
              ) : (
                <PortableText value={lesson.body} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
