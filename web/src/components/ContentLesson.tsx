"use client";

import React, { useState } from "react";
import Image from "next/image";
import { PlayCircle, MousePointer2, Layers, Plus } from "lucide-react";
import { PortableText, type PortableTextMarkComponent } from "@portabletext/react";
import { Hotspot } from "./Hotspot";
import { DiscoveryPanel } from "./DiscoveryPanel";
import { optimizeSanityImage } from "@/lib/image-optimization";
import { sanityImageLoader } from "@/lib/sanity-image-loader";
import { getSemanticWidthClass } from "@/lib/utils";
import type {
  LessonSection,
  RichText,
  SanityHotspot,
  SanityPhoto,
} from "@/lib/contracts/sanity";

// ── Regular content lesson screen ─────────────────────────────────────────────
// Background media, positioned text overlay, floating graphics, hotspots, and
// the tooltip-mode DiscoveryPanel. Layer-mode hotspots are delegated upward via
// onOpenLayer (the LessonLayer panel is owned by MotoViewer).

interface ContentLessonProps {
  lesson: LessonSection;
  hotspots: SanityHotspot[];
  visitedLabels: Set<string>;
  onVisit: (label: string) => void;
  onOpenLayer: (hotspotKey: string) => void;
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
}

export function ContentLesson({
  lesson,
  hotspots,
  visitedLabels,
  onVisit,
  onOpenLayer,
  courseTitle,
  courseDescription,
}: ContentLessonProps) {
  const [activePanel, setActivePanel] = useState<ActivePanel | null>(null);

  const imageUrl = lesson.media?.asset?.url;
  const overlayX = lesson.textOverlay?.x ?? 6;
  const overlayY = lesson.textOverlay?.y ?? 15;
  const overlayWidth = getSemanticWidthClass(lesson.textOverlay?.width);

  // Inline "layerLink" annotations open the matching layer-mode hotspot.
  const LayerLinkMark: PortableTextMarkComponent<{
    _type: "layerLink";
    linkedLayer?: string;
  }> = ({ children, value }) => (
    <button
      onClick={() => {
        const hotspot = hotspots.find(
          (h) => h.label === value?.linkedLayer && h.contentMode === "layer"
        );
        if (hotspot) onOpenLayer(hotspot._key);
      }}
      className="text-accent font-medium underline underline-offset-4 decoration-accent/40 hover:decoration-accent transition-colors mx-1"
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
        <div className="absolute inset-0 bg-background" />
      )}

      {/* Text content */}
      {(!imageUrl || lesson.body) && (
        <div
          className={`absolute pointer-events-none z-10 flex flex-col ${
            imageUrl
              ? "left-[6%] right-[6%] bottom-[12%] md:left-(--desktop-x) md:right-auto md:top-(--desktop-y) md:bottom-auto"
              : ""
          }`}
          style={
            imageUrl
              ? ({
                  "--desktop-x": `max(6%, ${overlayX}%)`,
                  "--desktop-y": `${overlayY}%`,
                } as React.CSSProperties)
              : { inset: 0, padding: "6%", justifyContent: "center" }
          }
        >
          <div
            className={`pointer-events-auto w-full ${imageUrl ? overlayWidth : "max-w-xl flex flex-col gap-4"} ${
              imageUrl
                ? "bg-card/60 backdrop-blur-2xl p-6 md:p-8 rounded-[2rem] border border-white/10 shadow-2xl"
                : ""
            }`}
          >
            <h2 className="text-foreground text-2xl font-semibold leading-tight">
              {lesson.headline}
            </h2>
            {lesson.body && (
              <div className="prose dark:prose-invert max-w-none text-muted-foreground mt-4 text-base font-light leading-relaxed whitespace-pre-wrap">
                {typeof lesson.body === "string" ? (
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
              className={`absolute pointer-events-none z-10 ${getSemanticWidthClass(fg.width)}`}
              style={{ left: `${fg.x ?? 0}%`, top: `${fg.y ?? 0}%` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={optimizeSanityImage(fg.image.asset.url, 800)}
                alt="Floating Graphic"
                className="w-full h-auto drop-shadow-2xl"
              />
            </div>
          )
      )}

      {/* Hotspots */}
      {hotspots.map((h, i) => {
        let Icon = null;
        if (h.contentMode === "layer" && h.layerContent) {
          if (h.layerContent.layerType === "video") Icon = PlayCircle;
          else if (h.layerContent.layerType === "interaction") Icon = MousePointer2;
          else Icon = Layers;
        }

        return (
          <Hotspot
            key={i}
            x={h.x}
            y={h.y}
            label={h.label}
            visited={visitedLabels.has(h.label)}
            variant="moto-indigo-black"
            icon={
              Icon ? (
                <Icon className="w-5 h-5 text-white" />
              ) : h.contentMode === "layer" ? (
                <Plus className="w-5 h-5 text-white" />
              ) : undefined
            }
            onVisit={() => onVisit(h.label)}
            onOpen={() => {
              if (h.contentMode === "layer" && h.layerContent) {
                onOpenLayer(h._key);
                return;
              }
              setActivePanel({
                topic: h.topic,
                title: h.label,
                body: h.body,
                x: h.x,
                y: h.y,
                photos: h.photos,
              });
            }}
          />
        );
      })}

      <DiscoveryPanel
        open={activePanel !== null}
        onClose={() => setActivePanel(null)}
        label={activePanel?.title ?? ""}
        topic={activePanel?.topic}
        body={activePanel?.body}
        x={activePanel?.x}
        y={activePanel?.y}
        photos={activePanel?.photos}
        mode="popover"
        courseTitle={courseTitle}
        courseDescription={courseDescription}
      />
    </>
  );
}
