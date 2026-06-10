"use client";

import { PortableText } from "@portabletext/react";
import { LayerFrame } from "./LayerFrame";
import { FullWidthCarousel } from "./FullWidthCarousel";
import { optimizeSanityImage } from "@/lib/image-optimization";
import { cssAspectRatio, getSemanticWidthClass } from "@/lib/utils";
import type { RichText, SanityLayerContent } from "@/lib/contracts/sanity";

// ── Rich layer panel (hotspot "layer" content mode) ───────────────────────────

interface LessonLayerProps {
  open: boolean;
  onClose: () => void;
  parentLessonTitle: string;
  layerContent: SanityLayerContent | undefined;
}

function RichTextBody({ value }: { value: RichText }) {
  return typeof value === "string" ? <>{value}</> : <PortableText value={value} />;
}

export function LessonLayer({
  open,
  onClose,
  parentLessonTitle,
  layerContent,
}: LessonLayerProps) {
  const mediaUrl = layerContent?.media?.asset?.url;
  const hasPhotos = (layerContent?.photos?.length ?? 0) > 0;

  return (
    <LayerFrame
      open={open}
      onClose={onClose}
      parentLessonTitle={parentLessonTitle}
      layerTitle={layerContent?.headline ?? ""}
    >
      {layerContent && (
        <>
          {(mediaUrl || hasPhotos) ? (
            <div className="relative mb-6">
              {mediaUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={optimizeSanityImage(mediaUrl, 1200)}
                  alt={layerContent.headline}
                  className="w-full rounded-2xl object-cover max-h-[60vh] shadow-2xl ring-1 ring-white/10"
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
                    className={`pointer-events-auto bg-card/60 backdrop-blur-2xl p-5 md:p-6 rounded-2xl border border-white/10 shadow-xl ${getSemanticWidthClass(layerContent.textOverlay.width)}`}
                  >
                    <div className="text-sm md:text-base leading-relaxed text-foreground prose prose-sm prose-invert max-w-none">
                      <RichTextBody value={layerContent.body} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {(!layerContent.textOverlay || (!mediaUrl && !hasPhotos)) &&
            layerContent.body && (
              <div className="text-base leading-relaxed text-foreground prose prose-invert max-w-none">
                <RichTextBody value={layerContent.body} />
              </div>
            )}

          {layerContent.layerType === "video" && layerContent.videoFile?.asset?.url && (
            <div
              className="mt-6 bg-black rounded-2xl overflow-hidden border border-white/10 relative shadow-2xl flex items-center justify-center"
              style={{ aspectRatio: cssAspectRatio(layerContent.videoAspectRatio) }}
            >
              <video
                src={layerContent.videoFile.asset.url}
                controls
                className="absolute inset-0 w-full h-full object-contain"
              />
            </div>
          )}

          {layerContent.layerType === "interaction" &&
            layerContent.hotspots &&
            layerContent.hotspots.length > 0 && (
              <div className="mt-8">
                <h3 className="text-sm uppercase tracking-widest text-accent/80 font-bold mb-4">
                  Interactive Features
                </h3>
                <div className="space-y-4">
                  {layerContent.hotspots.map((h, idx) => (
                    <div key={h._key ?? idx} className="bg-white/5 rounded-2xl p-5 border border-white/10">
                      <h4 className="font-semibold text-foreground text-lg mb-2">{h.label}</h4>
                      <div className="text-foreground/70 text-sm leading-relaxed prose prose-invert">
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
