'use client';

import { PortableText } from '@portabletext/react';
import { Sparkles } from 'lucide-react';
import type { RichText, SanityPhoto } from '@/lib/contracts/sanity';
import { supMark } from '@/lib/portable-text-components';
import { cssAspectRatio } from '@/lib/utils';
import { PhotoCardStack } from '../PhotoCardStack';

interface DiscoveryLearnContentProps {
  body?: RichText;
  photos: SanityPhoto[];
  videoFile?: { asset?: { url?: string } };
  videoAspectRatio?: string;
}

export function DiscoveryLearnContent({
  body,
  photos,
  videoFile,
  videoAspectRatio,
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
        <div className="text-foreground prose prose-sm prose-invert max-w-none text-[16px] leading-relaxed">
          {typeof body === 'string' ? (
            body
          ) : (
            <PortableText value={body} components={{ marks: supMark }} />
          )}
        </div>
      )}

      <div className="mt-1 mb-1 flex items-center gap-3">
        <div className="h-px flex-1 bg-white/8" />
        <span className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-semibold tracking-widest uppercase">
          <Sparkles className="h-3 w-3" />
          Course AI Assistant
        </span>
        <div className="h-px flex-1 bg-white/8" />
      </div>
    </div>
  );
}
