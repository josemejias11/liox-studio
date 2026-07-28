'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { Crosshair, RotateCcw, ScanSearch, ZoomIn, ZoomOut } from 'lucide-react';
import { DiscoveryPanel } from '@/components/DiscoveryPanel';
import { Hotspot } from '@/components/Hotspot';
import { clampCanvasZoom, MAX_CANVAS_ZOOM, MIN_CANVAS_ZOOM } from '@/lib/canvas';
import type { LessonSection, RichText, CourseHotspot, CoursePhoto } from '@/lib/contracts/course';

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
  photos?: CoursePhoto[];
  videoFile?: { asset?: { url?: string } };
  videoAspectRatio?: string;
  x: number;
  y: number;
}

const ZOOM_STEP = 0.25;

function toActiveTarget(target: CourseHotspot): ActiveTarget {
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
  const [focusedTargetIndex, setFocusedTargetIndex] = useState(0);
  const dragStart = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const targetRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const imageUrl = lesson.media?.asset?.url;
  const targets = lesson.hotspots ?? [];
  const discoveredCount = targets.filter((target) => visitedLabels.has(target.label)).length;
  const isInspecting = activeTarget !== null;

  function resetView() {
    setZoom(MIN_CANVAS_ZOOM);
    setOffset({ x: 0, y: 0 });
  }

  function updateZoom(nextZoom: number) {
    const clamped = clampCanvasZoom(nextZoom);
    setZoom(clamped);
    if (clamped === MIN_CANVAS_ZOOM) setOffset({ x: 0, y: 0 });
  }

  function openInspectionTarget(target: CourseHotspot) {
    const focusedZoom = clampCanvasZoom(Math.max(zoom, 1.25));
    const maxOffset = (focusedZoom - 1) * 35;
    const nextX = Math.max(-maxOffset, Math.min(maxOffset, (50 - target.x) * 0.18));
    const nextY = Math.max(-maxOffset, Math.min(maxOffset, (50 - target.y) * 0.18));

    setZoom(focusedZoom);
    setOffset({ x: nextX, y: nextY });
    setActiveTarget(toActiveTarget(target));
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (zoom === MIN_CANVAS_ZOOM) return;
    if (event.target instanceof Element && event.target.closest('button')) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = {
      x: event.clientX,
      y: event.clientY,
      offsetX: offset.x,
      offsetY: offset.y,
    };
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragStart.current) return;
    const maxOffset = (zoom - 1) * 35;
    setOffset({
      x: Math.max(
        -maxOffset,
        Math.min(maxOffset, dragStart.current.offsetX + (event.clientX - dragStart.current.x) / 5),
      ),
      y: Math.max(
        -maxOffset,
        Math.min(maxOffset, dragStart.current.offsetY + (event.clientY - dragStart.current.y) / 5),
      ),
    });
  }

  function stopDragging() {
    dragStart.current = null;
  }

  function handleTargetRegionKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if ((event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') || targets.length === 0) return;

    event.preventDefault();
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (focusedTargetIndex + direction + targets.length) % targets.length;
    setFocusedTargetIndex(nextIndex);
    targetRefs.current[nextIndex]?.focus();
  }

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#0c111d]">
      <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(rgba(151,164,189,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(151,164,189,0.07)_1px,transparent_1px)] [background-size:36px_36px]" />
      <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_50%_48%,transparent_25%,rgba(6,9,16,0.54)_78%)]" />

      <div
        className={`absolute top-0 bottom-0 left-0 transition-[right] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          isInspecting ? 'right-[min(27rem,33vw)]' : 'right-0'
        }`}
      >
        <div className="absolute top-6 right-6 left-6 z-20 flex items-start justify-between gap-4">
          <div className="max-w-md rounded-[1.25rem] border border-[#91a3c4]/18 bg-[#101725]/88 p-4 text-white shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
            <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-[#9eb0ff] uppercase">
              <ScanSearch className="h-4 w-4" /> Inspection canvas
            </p>
            <h2 className="mt-1 text-xl font-semibold">{lesson.headline}</h2>
            {lesson.body && typeof lesson.body === 'string' && (
              <p className="mt-1 text-sm text-white/62">{lesson.body}</p>
            )}
            {targets.length > 0 && (
              <div className="mt-3 flex items-center gap-2 text-xs font-medium text-[#b8c3d8]">
                <Crosshair className="h-3.5 w-3.5 text-[#9eb0ff]" />
                {discoveredCount} of {targets.length} inspection targets reviewed
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 rounded-xl border border-[#91a3c4]/18 bg-[#101725]/88 p-1.5 text-white shadow-xl backdrop-blur-xl">
            <button
              aria-label="Zoom out"
              className="flex min-h-11 min-w-11 items-center justify-center rounded-lg p-2 hover:bg-white/10 disabled:opacity-35"
              onClick={() => updateZoom(zoom - ZOOM_STEP)}
              disabled={zoom <= MIN_CANVAS_ZOOM}
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="min-w-12 text-center text-xs text-[#b8c3d8] tabular-nums">
              {Math.round(zoom * 100)}%
            </span>
            <button
              aria-label="Zoom in"
              className="flex min-h-11 min-w-11 items-center justify-center rounded-lg p-2 hover:bg-white/10 disabled:opacity-35"
              onClick={() => updateZoom(zoom + ZOOM_STEP)}
              disabled={zoom >= MAX_CANVAS_ZOOM}
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              aria-label="Reset image view"
              className="flex min-h-11 min-w-11 items-center justify-center rounded-lg p-2 hover:bg-white/10"
              onClick={resetView}
            >
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
          onKeyDown={handleTargetRegionKeyDown}
        >
          <div
            data-testid="canvas-image"
            className="absolute inset-0 origin-center transition-transform duration-200"
            style={{ transform: `translate(${offset.x}%, ${offset.y}%) scale(${zoom})` }}
          >
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={lesson.headline}
                fill
                priority
                sizes="100vw"
                className="object-cover opacity-88 saturate-[0.82]"
                draggable={false}
              />
            ) : (
              <div className="bg-muted absolute inset-0 flex items-center justify-center">
                <p className="text-muted-foreground">
                  Add a primary product image in Course Studio to build this Canvas lesson.
                </p>
              </div>
            )}

            {targets.map((target, index) => (
              <Hotspot
                key={target._key}
                ref={(element) => {
                  targetRefs.current[index] = element;
                }}
                x={target.x}
                y={target.y}
                label={target.label}
                visited={visitedLabels.has(target.label)}
                variant="moto-indigo-black"
                presentation="reticle"
                onVisit={() => onVisit(target.label)}
                onOpen={() => openInspectionTarget(target)}
                tabIndex={index === focusedTargetIndex ? 0 : -1}
                onFocus={() => setFocusedTargetIndex(index)}
              />
            ))}
          </div>
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
        mode="sidebar"
        sidebarPlacement="workbench"
        dimBackdrop={false}
        courseId={courseId}
      />
    </div>
  );
}
