'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { DiscoveryPanel } from '@/components/DiscoveryPanel';
import { Hotspot } from '@/components/Hotspot';
import { clampCanvasZoom, MAX_CANVAS_ZOOM, MIN_CANVAS_ZOOM } from '@/lib/canvas';
import { sanityImageLoader } from '@/lib/sanity-image-loader';
import type { LessonSection, RichText, SanityHotspot, SanityPhoto } from '@/lib/contracts/sanity';

interface CanvasInspectionLessonProps {
  lesson: LessonSection;
  visitedLabels: Set<string>;
  onVisit: (label: string) => void;
  courseId?: string;
}

interface ActiveTarget {
  label: string;
  topic: string;
  body?: RichText;
  photos?: SanityPhoto[];
  videoFile?: { asset?: { url?: string } };
  videoAspectRatio?: string;
  x: number;
  y: number;
}

const ZOOM_STEP = 0.25;

function toActiveTarget(target: SanityHotspot): ActiveTarget {
  return {
    label: target.label,
    topic: target.topic,
    body: target.body,
    photos: target.photos,
    videoFile: target.videoFile,
    videoAspectRatio: target.videoAspectRatio,
    x: target.x,
    y: target.y,
  };
}

export function CanvasInspectionLesson({
  lesson,
  visitedLabels,
  onVisit,
  courseId,
}: CanvasInspectionLessonProps) {
  const [zoom, setZoom] = useState(MIN_CANVAS_ZOOM);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [activeTarget, setActiveTarget] = useState<ActiveTarget | null>(null);
  const dragStart = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const imageUrl = lesson.media?.asset?.url;
  const targets = lesson.hotspots ?? [];

  function resetView() {
    setZoom(MIN_CANVAS_ZOOM);
    setOffset({ x: 0, y: 0 });
  }

  function updateZoom(nextZoom: number) {
    const clamped = clampCanvasZoom(nextZoom);
    setZoom(clamped);
    if (clamped === MIN_CANVAS_ZOOM) setOffset({ x: 0, y: 0 });
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (zoom === MIN_CANVAS_ZOOM) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = { x: event.clientX, y: event.clientY, offsetX: offset.x, offsetY: offset.y };
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragStart.current) return;
    const maxOffset = (zoom - 1) * 35;
    setOffset({
      x: Math.max(-maxOffset, Math.min(maxOffset, dragStart.current.offsetX + (event.clientX - dragStart.current.x) / 5)),
      y: Math.max(-maxOffset, Math.min(maxOffset, dragStart.current.offsetY + (event.clientY - dragStart.current.y) / 5)),
    });
  }

  function stopDragging() {
    dragStart.current = null;
  }

  return (
    <div className="bg-background absolute inset-0 overflow-hidden">
      <div className="absolute top-6 right-6 left-6 z-20 flex items-start justify-between gap-4">
        <div className="bg-card/85 max-w-md rounded-2xl border border-white/10 p-4 shadow-xl backdrop-blur-xl">
          <p className="text-primary text-xs font-semibold tracking-[0.18em] uppercase">Canvas lesson</p>
          <h2 className="text-foreground mt-1 text-xl font-semibold">{lesson.headline}</h2>
          {lesson.body && typeof lesson.body === 'string' && (
            <p className="text-muted-foreground mt-1 text-sm">{lesson.body}</p>
          )}
        </div>
        <div className="bg-card/85 flex items-center gap-1 rounded-xl border border-white/10 p-1.5 shadow-xl backdrop-blur-xl">
          <button aria-label="Zoom out" className="hover:bg-accent rounded-lg p-2" onClick={() => updateZoom(zoom - ZOOM_STEP)} disabled={zoom <= MIN_CANVAS_ZOOM}>
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="text-muted-foreground min-w-12 text-center text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
          <button aria-label="Zoom in" className="hover:bg-accent rounded-lg p-2" onClick={() => updateZoom(zoom + ZOOM_STEP)} disabled={zoom >= MAX_CANVAS_ZOOM}>
            <ZoomIn className="h-4 w-4" />
          </button>
          <button aria-label="Reset image view" className="hover:bg-accent rounded-lg p-2" onClick={resetView}>
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        className={`absolute inset-0 touch-none ${zoom > MIN_CANVAS_ZOOM ? 'cursor-grab active:cursor-grabbing' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
      >
        <div
          data-testid="canvas-image"
          className="absolute inset-0 origin-center transition-transform duration-200"
          style={{ transform: `translate(${offset.x}%, ${offset.y}%) scale(${zoom})` }}
        >
          {imageUrl ? (
            <Image src={imageUrl} alt={lesson.headline} fill priority sizes="100vw" loader={sanityImageLoader} className="object-cover" draggable={false} />
          ) : (
            <div className="bg-muted absolute inset-0 flex items-center justify-center">
              <p className="text-muted-foreground">Add a primary product image in Sanity to build this Canvas lesson.</p>
            </div>
          )}

          {targets.map((target) => (
            <Hotspot
              key={target._key}
              x={target.x}
              y={target.y}
              label={target.label}
              visited={visitedLabels.has(target.label)}
              variant="moto-indigo-black"
              onVisit={() => onVisit(target.label)}
              onOpen={() => setActiveTarget(toActiveTarget(target))}
            />
          ))}
        </div>
      </div>

      <DiscoveryPanel
        open={activeTarget !== null}
        onClose={() => setActiveTarget(null)}
        label={activeTarget?.label ?? ''}
        topic={activeTarget?.topic}
        body={activeTarget?.body}
        photos={activeTarget?.photos}
        videoFile={activeTarget?.videoFile}
        videoAspectRatio={activeTarget?.videoAspectRatio}
        x={activeTarget?.x}
        y={activeTarget?.y}
        mode="popover"
        courseId={courseId}
      />
    </div>
  );
}
