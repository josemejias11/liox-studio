'use client';

import { PortableText } from '@portabletext/react';
import { Sparkles } from 'lucide-react';
import type { RichText, CoursePhoto } from '@/shared/contracts/player-course';
import { supMark } from '@/shared/portable-text-components';
import { cssAspectRatio } from '@/shared/utils';
import { PhotoCardStack } from './PhotoCardStack';
import {
  InlineDiscoveryCueMark,
  InlineDiscoveryCueProvider,
  type InlineDiscoveryCueResolver,
} from '@/learning/player/lesson-types/InlineDiscoveryCue';

interface DiscoveryLearnContentProps {
  body?: RichText;
  photos: CoursePhoto[];
  videoFile?: { asset?: { url?: string } };
  videoAspectRatio?: string;
  resolveLinkedLayer?: InlineDiscoveryCueResolver;
}

export function DiscoveryLearnContent({
  body,
  photos,
  videoFile,
  videoAspectRatio,
  resolveLinkedLayer,
}: DiscoveryLearnContentProps) {
  const videoUrl = videoFile?.asset?.url;

  return (
    <div className="flex flex-col gap-4 px-4 pt-4 pb-2">
      {videoUrl ? (
        <video
          src={videoUrl}
          controls
          autoPlay
          playsInline
          className="max-h-[55vh] w-full rounded-2xl bg-black object-contain"
          style={{ aspectRatio: cssAspectRatio(videoAspectRatio) }}
        />
      ) : photos.length > 0 ? (
        <PhotoCardStack photos={photos} />
      ) : null}

      {body && (
        <div className="prose prose-sm prose-invert max-w-none text-[16px] leading-relaxed text-slate-200">
          {typeof body === 'string' ? (
            body
          ) : (
            <InlineDiscoveryCueProvider
              resolveLinkedLayer={resolveLinkedLayer ?? (() => undefined)}
            >
              <PortableText
                value={body}
                components={{ marks: { layerLink: InlineDiscoveryCueMark, ...supMark } }}
              />
            </InlineDiscoveryCueProvider>
          )}
        </div>
      )}

      <div className="mt-1 mb-1 flex items-center gap-3">
        <div className="h-px flex-1 bg-white/8" />
        <span className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-semibold tracking-widest uppercase">
          <Sparkles className="h-3 w-3" />
          Course material
        </span>
        <div className="h-px flex-1 bg-white/8" />
      </div>
    </div>
  );
}
