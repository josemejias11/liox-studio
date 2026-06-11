'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { PlayCircle } from 'lucide-react';
import { PortableText, type PortableTextMarkComponent } from '@portabletext/react';
import { Hotspot } from './Hotspot';
import { DiscoveryPanel } from './DiscoveryPanel';
import { sanityImageLoader } from '@/lib/sanity-image-loader';
import { getSemanticWidthClass } from '@/lib/utils';
import type { LessonSection, RichText, SanityHotspot, SanityPhoto } from '@/lib/contracts/sanity';

interface ContentLessonProps {
  lesson: LessonSection;
  hotspots: SanityHotspot[];
  visitedLabels: Set<string>;
  onVisit: (label: string) => void;
  courseTitle: string;
  courseDescription?: string;
}

interface ActivePanel {
  topic: string;
  title: string;
  body?: RichText;
  x?: number;
  y?: number;
  photos?: SanityPhoto[];
  videoFile?: { asset?: { url?: string } };
  videoAspectRatio?: string;
}

export function ContentLesson({
  lesson,
  hotspots,
  visitedLabels,
  onVisit,
  courseTitle,
  courseDescription,
}: ContentLessonProps) {
  const [activePanel, setActivePanel] = useState<ActivePanel | null>(null);

  const imageUrl = lesson.media?.asset?.url;
  const overlayX = lesson.textOverlay?.x ?? 6;
  const overlayY = lesson.textOverlay?.y ?? 15;
  const overlayWidth = getSemanticWidthClass(lesson.textOverlay?.width);

  // Inline "layerLink" annotations open the matching hotspot's discovery panel.
  const LayerLinkMark: PortableTextMarkComponent<{
    _type: 'layerLink';
    linkedLayer?: string;
  }> = ({ children, value }) => (
    <button
      onClick={() => {
        const hotspot = hotspots.find((h) => h.label === value?.linkedLayer);
        if (hotspot) {
          setActivePanel({
            topic: hotspot.topic,
            title: hotspot.label,
            body: hotspot.body,
            x: hotspot.x,
            y: hotspot.y,
            photos: hotspot.photos,
            videoFile: hotspot.videoFile,
            videoAspectRatio: hotspot.videoAspectRatio,
          });
        }
      }}
      className="text-accent decoration-accent/40 hover:decoration-accent mx-1 font-medium underline underline-offset-4 transition-colors"
    >
      {children}
    </button>
  );

  return (
    <>
      {/* Background image or solid color — the lesson's LCP element */}
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={lesson.headline}
          fill
          priority
          sizes="100vw"
          loader={sanityImageLoader}
          className="object-cover"
        />
      ) : (
        <div className="bg-background absolute inset-0" />
      )}

      {/* Text content */}
      {(!imageUrl || lesson.body) && (
        <div
          className={`pointer-events-none absolute z-10 flex flex-col ${
            imageUrl
              ? 'right-[6%] bottom-[12%] left-[6%] md:top-(--desktop-y) md:right-auto md:bottom-auto md:left-(--desktop-x)'
              : ''
          }`}
          style={
            imageUrl
              ? ({
                  '--desktop-x': `max(6%, ${overlayX}%)`,
                  '--desktop-y': `${overlayY}%`,
                } as React.CSSProperties)
              : { inset: 0, padding: '6%', justifyContent: 'center' }
          }
        >
          <div
            className={`pointer-events-auto w-full ${imageUrl ? overlayWidth : 'flex max-w-xl flex-col gap-4'} ${
              imageUrl
                ? 'bg-card/60 rounded-[2rem] border border-white/10 p-6 shadow-2xl backdrop-blur-2xl md:p-8'
                : ''
            }`}
          >
            <h2 className="text-foreground text-2xl leading-tight font-semibold">
              {lesson.headline}
            </h2>
            {lesson.body && (
              <div className="prose dark:prose-invert text-muted-foreground mt-4 max-w-none text-base leading-relaxed font-light whitespace-pre-wrap">
                {typeof lesson.body === 'string' ? (
                  lesson.body
                ) : (
                  <PortableText
                    value={lesson.body}
                    components={{ marks: { layerLink: LayerLinkMark } }}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating graphics */}
      {lesson.floatingGraphics?.map(
        (fg, i) =>
          fg.image?.asset?.url && (
            <div
              key={i}
              className={`pointer-events-none absolute z-10 ${getSemanticWidthClass(fg.width)}`}
              style={{ left: `${fg.x ?? 0}%`, top: `${fg.y ?? 0}%` }}
            >
              <Image
                src={fg.image.asset.url}
                alt="Floating Graphic"
                width={800}
                height={800}
                className="h-auto w-full object-contain drop-shadow-2xl"
              />
            </div>
          ),
      )}

      {/* Hotspots */}
      {hotspots.map((h, i) => (
        <Hotspot
          key={i}
          x={h.x}
          y={h.y}
          label={h.label}
          visited={visitedLabels.has(h.label)}
          variant="moto-indigo-black"
          icon={
            h.videoFile?.asset?.url ? (
              <PlayCircle className="h-5 w-5 text-white" />
            ) : undefined
          }
          onVisit={() => onVisit(h.label)}
          onOpen={() =>
            setActivePanel({
              topic: h.topic,
              title: h.label,
              body: h.body,
              x: h.x,
              y: h.y,
              photos: h.photos,
              videoFile: h.videoFile,
              videoAspectRatio: h.videoAspectRatio,
            })
          }
        />
      ))}

      <DiscoveryPanel
        open={activePanel !== null}
        onClose={() => setActivePanel(null)}
        label={activePanel?.title ?? ''}
        topic={activePanel?.topic}
        body={activePanel?.body}
        photos={activePanel?.photos}
        videoFile={activePanel?.videoFile}
        videoAspectRatio={activePanel?.videoAspectRatio}
        x={activePanel?.x}
        y={activePanel?.y}
        mode="popover"
        courseTitle={courseTitle}
        courseDescription={courseDescription}
      />
    </>
  );
}
