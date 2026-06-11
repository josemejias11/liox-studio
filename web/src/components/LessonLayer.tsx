'use client';

import { PortableText } from '@portabletext/react';
import Image from 'next/image';
import { LayerFrame } from './LayerFrame';
import { FullWidthCarousel } from './FullWidthCarousel';
import { optimizeSanityImage } from '@/lib/image-optimization';
import { cssAspectRatio, getSemanticWidthClass } from '@/lib/utils';
import type { RichText, SanityLayerContent } from '@/lib/contracts/sanity';

// ── Rich layer panel (hotspot "layer" content mode) ───────────────────────────

interface LessonLayerProps {
  open: boolean;
  onClose: () => void;
  parentLessonTitle: string;
  layerContent: SanityLayerContent | undefined;
}

function RichTextBody({ value }: { value: RichText }) {
  return typeof value === 'string' ? <>{value}</> : <PortableText value={value} />;
}

export function LessonLayer({ open, onClose, parentLessonTitle, layerContent }: LessonLayerProps) {
  const mediaUrl = layerContent?.media?.asset?.url;
  const hasPhotos = (layerContent?.photos?.length ?? 0) > 0;

  return (
    <LayerFrame
      open={open}
      onClose={onClose}
      parentLessonTitle={parentLessonTitle}
      layerTitle={layerContent?.headline ?? ''}
    >
      {layerContent && (
        <>
          {mediaUrl || hasPhotos ? (
            <div className="relative mb-6">
              {mediaUrl ? (
                <Image
                  src={optimizeSanityImage(mediaUrl, 1200)}
                  alt={layerContent.headline || 'Layer Media'}
                  width={1200}
                  height={800}
                  className="max-h-[60vh] w-full rounded-2xl object-cover shadow-2xl ring-1 ring-white/10"
                />
              ) : layerContent.photos ? (
                <FullWidthCarousel photos={layerContent.photos} className="mb-0!" />
              ) : null}

              {layerContent.textOverlay && layerContent.body && (
                <div
                  className="absolute z-10"
                  style={{
                    left: `${layerContent.textOverlay.x ?? 6}%`,
                    top: `${layerContent.textOverlay.y ?? 15}%`,
                  }}
                >
                  <div
                    className={`bg-card/60 pointer-events-auto rounded-2xl border border-white/10 p-5 shadow-xl backdrop-blur-2xl md:p-6 ${getSemanticWidthClass(layerContent.textOverlay.width)}`}
                  >
                    <div className="text-foreground prose prose-sm prose-invert max-w-none text-sm leading-relaxed md:text-base">
                      <RichTextBody value={layerContent.body} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {(!layerContent.textOverlay || (!mediaUrl && !hasPhotos)) && layerContent.body && (
            <div className="text-foreground prose prose-invert max-w-none text-base leading-relaxed">
              <RichTextBody value={layerContent.body} />
            </div>
          )}

          {layerContent.layerType === 'video' && layerContent.videoFile?.asset?.url && (
            <div
              className="relative mt-6 flex items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl"
              style={{ aspectRatio: cssAspectRatio(layerContent.videoAspectRatio) }}
            >
              <video
                src={layerContent.videoFile.asset.url}
                controls
                className="absolute inset-0 h-full w-full object-contain"
              />
            </div>
          )}

          {layerContent.layerType === 'interaction' &&
            layerContent.hotspots &&
            layerContent.hotspots.length > 0 && (
              <div className="mt-8">
                <h3 className="text-accent/80 mb-4 text-sm font-bold tracking-widest uppercase">
                  Interactive Features
                </h3>
                <div className="space-y-4">
                  {layerContent.hotspots.map((h, idx) => (
                    <div
                      key={h._key ?? idx}
                      className="rounded-2xl border border-white/10 bg-white/5 p-5"
                    >
                      <h4 className="text-foreground mb-2 text-lg font-semibold">{h.label}</h4>
                      <div className="text-foreground/70 prose prose-invert text-sm leading-relaxed">
                        {h.body && <RichTextBody value={h.body} />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
        </>
      )}
    </LayerFrame>
  );
}
