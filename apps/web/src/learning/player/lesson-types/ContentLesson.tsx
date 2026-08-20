'use client';

import React, { useRef, useState } from 'react';
import Image from 'next/image';
import { BookOpen, MousePointer2, PlayCircle } from 'lucide-react';
import { PortableText } from '@portabletext/react';
import { supMark } from '@/shared/portable-text-components';
import { Hotspot } from './Hotspot';
import { DiscoveryPanel } from '@/learning/player/discovery/DiscoveryPanel';
import { getSemanticWidthClass } from '@/shared/utils';
import type {
  LessonSection,
  RichText,
  CourseHotspot,
  CoursePhoto,
} from '@/shared/contracts/player-course';
import {
  InlineDiscoveryCueMark,
  InlineDiscoveryCueProvider,
  type InlineDiscoveryCueResolver,
} from './InlineDiscoveryCue';
import { FeatureLearningLoop } from './FeatureLearningLoop';

interface ContentLessonProps {
  lesson: LessonSection;
  hotspots: CourseHotspot[];
  visitedLabels: Set<string>;
  onVisit: (label: string) => void;

  courseId?: string;
  preview?: boolean;
  imageSizes?: string;
}

interface ActivePanel {
  topic: string;
  title: string;
  body?: RichText;
  x?: number;
  y?: number;
  photos?: CoursePhoto[];
  videoFile?: { asset?: { url?: string } };
  videoAspectRatio?: string;
}

function toActivePanel(hotspot: CourseHotspot): ActivePanel {
  return {
    topic: hotspot.topic,
    title: hotspot.label,
    body: hotspot.body,
    x: hotspot.x,
    y: hotspot.y,
    photos: hotspot.photos,
    videoFile: hotspot.videoFile,
    videoAspectRatio: hotspot.videoAspectRatio,
  };
}

export function getLayerLinkLabels(body: RichText | undefined): Set<string> {
  if (!Array.isArray(body)) return new Set<string>();

  return new Set(
    body.flatMap((block) => {
      const markDefs = (block as { markDefs?: unknown }).markDefs;
      if (!Array.isArray(markDefs)) return [];

      return markDefs.flatMap((markDef) => {
        if (
          typeof markDef === 'object' &&
          markDef !== null &&
          (markDef as { _type?: unknown })._type === 'layerLink' &&
          typeof (markDef as { linkedLayer?: unknown }).linkedLayer === 'string'
        ) {
          return [(markDef as { linkedLayer: string }).linkedLayer];
        }
        return [];
      });
    }),
  );
}

const CONTENT_PORTABLE_TEXT_COMPONENTS = {
  marks: { layerLink: InlineDiscoveryCueMark, ...supMark },
};

export function ContentLesson({
  lesson,
  hotspots,
  visitedLabels,
  onVisit,
  courseId,
  preview = false,
  imageSizes = '100vw',
}: ContentLessonProps) {
  const [activeLearningTarget, setActiveLearningTarget] = useState<CourseHotspot | null>(null);
  const [activeTutorTarget, setActiveTutorTarget] = useState<ActivePanel | null>(null);
  const hotspotRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeLearningHotspotRef = useRef<HTMLButtonElement | null>(null);

  const imageUrl = lesson.media?.asset?.url;
  const overlayX = lesson.textOverlay?.x ?? 6;
  const overlayY = lesson.textOverlay?.y ?? 15;
  const overlayWidth = getSemanticWidthClass(lesson.textOverlay?.width);
  const isInteraction = lesson.lessonType === 'interaction';
  const discoveredCount = hotspots.filter((hotspot) => visitedLabels.has(hotspot.label)).length;

  const resolveLinkedLayer: InlineDiscoveryCueResolver = (linkedLayer) => {
    const hotspot = hotspots.find((item) => item.label === linkedLayer);
    const coveredFeature = lesson.coveredFeatures?.find((item) => item.label === linkedLayer);
    const label = hotspot?.label ?? coveredFeature?.label;

    if (!label) return undefined;

    return {
      label,
      summary: coveredFeature?.summary,
      visited: visitedLabels.has(label),
      onActivate: () => {
        onVisit(label);
        if (hotspot) {
          setActiveLearningTarget(null);
          setActiveTutorTarget(toActivePanel(hotspot));
        }
      },
    };
  };
  const linkedHotspotLabels = isInteraction ? new Set<string>() : getLayerLinkLabels(lesson.body);
  const visibleHotspots = hotspots.filter(
    (hotspot) => isInteraction || !linkedHotspotLabels.has(hotspot.label),
  );

  return (
    <div
      className={`absolute inset-0 overflow-hidden ${
        isInteraction ? 'bg-[#090a18]' : 'bg-[#f4f0e8]'
      }`}
    >
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={lesson.headline}
          fill
          priority
          sizes={imageSizes}
          className={`object-cover ${
            isInteraction ? 'opacity-78 saturate-[0.82]' : 'opacity-90 saturate-[0.86]'
          }`}
        />
      ) : (
        <div
          className={`absolute inset-0 ${
            isInteraction
              ? 'bg-[radial-gradient(circle_at_62%_42%,rgba(104,91,199,0.35),transparent_42%),linear-gradient(145deg,#090a18,#17172a)]'
              : 'bg-[radial-gradient(circle_at_70%_25%,rgba(255,255,255,0.95),transparent_45%),linear-gradient(145deg,#f7f3eb,#e9e3d8)]'
          }`}
        />
      )}

      <div
        className={`pointer-events-none absolute inset-0 ${
          isInteraction
            ? 'bg-[linear-gradient(90deg,rgba(7,8,18,0.94)_0%,rgba(7,8,18,0.68)_38%,rgba(7,8,18,0.08)_72%)]'
            : 'bg-[linear-gradient(90deg,rgba(244,240,232,0.98)_0%,rgba(244,240,232,0.76)_38%,rgba(244,240,232,0.08)_70%)]'
        }`}
      />

      <div className="pointer-events-none absolute top-6 right-6 left-6 z-20 flex items-center justify-between md:top-8 md:right-10 md:left-10">
        <div
          className={`flex items-center gap-2 text-[11px] font-semibold tracking-[0.22em] uppercase ${
            isInteraction ? 'text-[#bcb4ff]' : 'text-[#685bc7]'
          }`}
        >
          {isInteraction ? <MousePointer2 className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
          {isInteraction ? 'Guided interaction' : 'Learning brief'}
        </div>
        {hotspots.length > 0 && (
          <div
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold tabular-nums backdrop-blur-md ${
              isInteraction
                ? 'border-white/15 bg-[#111225]/72 text-white/72'
                : 'border-[#18191d]/10 bg-white/72 text-[#595b66]'
            }`}
          >
            {discoveredCount} / {hotspots.length} explored
          </div>
        )}
      </div>
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
                  '--desktop-y': `max(13%, ${overlayY}%)`,
                } as React.CSSProperties)
              : { inset: 0, padding: '8%', justifyContent: 'center' }
          }
        >
          <div
            className={`pointer-events-auto w-full ${imageUrl ? overlayWidth : 'flex max-w-xl flex-col gap-4'} ${
              imageUrl
                ? isInteraction
                  ? 'rounded-[1.5rem] border border-white/12 bg-[#111225]/88 p-6 text-white shadow-[0_24px_70px_rgba(0,0,0,0.4)] backdrop-blur-2xl md:p-8'
                  : 'rounded-[0.35rem_2rem_2rem_0.35rem] border-l-4 border-l-[#685bc7] bg-[#fffdf8]/92 p-6 shadow-[0_22px_60px_rgba(56,48,36,0.18)] backdrop-blur-xl md:p-8'
                : ''
            }`}
          >
            {isInteraction && (
              <p className="mb-3 text-xs font-semibold tracking-[0.2em] text-[#bcb4ff] uppercase">
                Explore to reveal
              </p>
            )}
            {!isInteraction && (
              <p className="mb-3 text-xs font-semibold tracking-[0.2em] text-[#685bc7] uppercase">
                Learning brief
              </p>
            )}
            <h2
              className={`text-2xl leading-tight font-semibold md:text-3xl ${
                isInteraction ? 'text-white' : 'text-[#18191d]'
              }`}
            >
              {lesson.headline}
            </h2>
            {lesson.body && (
              <div
                className={`prose mt-4 max-w-none text-base leading-relaxed font-light whitespace-pre-wrap ${
                  isInteraction ? 'prose-invert text-white/72' : 'text-[#5d5a55]'
                }`}
              >
                {typeof lesson.body === 'string' ? (
                  lesson.body
                ) : (
                  <InlineDiscoveryCueProvider resolveLinkedLayer={resolveLinkedLayer}>
                    <PortableText
                      value={lesson.body}
                      components={CONTENT_PORTABLE_TEXT_COMPONENTS}
                    />
                  </InlineDiscoveryCueProvider>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      {visibleHotspots.map((h, i) => (
        <Hotspot
          key={i}
          ref={(element) => {
            hotspotRefs.current[i] = element;
          }}
          x={h.x}
          y={h.y}
          label={h.label}
          visited={visitedLabels.has(h.label)}
          variant={isInteraction ? 'pulse' : 'moto-indigo-black'}
          icon={h.videoFile?.asset?.url ? <PlayCircle className="h-5 w-5 text-white" /> : undefined}
          onVisit={() => onVisit(h.label)}
          onOpen={() => {
            activeLearningHotspotRef.current = hotspotRefs.current[i];
            setActiveLearningTarget(h);
          }}
        />
      ))}

      {activeLearningTarget && (
        <FeatureLearningLoop
          label={activeLearningTarget.label}
          body={activeLearningTarget.body}
          photos={activeLearningTarget.photos}
          videoFile={activeLearningTarget.videoFile}
          videoAspectRatio={activeLearningTarget.videoAspectRatio}
          onClose={() => setActiveLearningTarget(null)}
          onAskTutor={() => {
            const tutorTarget = toActivePanel(activeLearningTarget);
            setActiveLearningTarget(null);
            setActiveTutorTarget(tutorTarget);
          }}
          returnFocusRef={activeLearningHotspotRef}
          resolveLinkedLayer={resolveLinkedLayer}
        />
      )}

      <DiscoveryPanel
        open={activeTutorTarget !== null}
        onClose={() => setActiveTutorTarget(null)}
        label={activeTutorTarget?.title ?? ''}
        topic={activeTutorTarget?.topic}
        body={activeTutorTarget?.body}
        photos={activeTutorTarget?.photos}
        videoFile={activeTutorTarget?.videoFile}
        videoAspectRatio={activeTutorTarget?.videoAspectRatio}
        x={activeTutorTarget?.x}
        y={activeTutorTarget?.y}
        mode="popover"
        courseId={courseId}
        preview={preview}
        resolveLinkedLayer={resolveLinkedLayer}
      />
    </div>
  );
}
