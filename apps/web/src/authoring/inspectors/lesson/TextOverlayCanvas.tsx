'use client';

import { useRef, type PointerEvent } from 'react';
import type { LessonImageDraft } from '@/authoring/inspectors/lesson/lesson-draft';
import { lessonInputClass } from './FieldError';

interface TextOverlayCanvasProps {
  image?: LessonImageDraft;
  value: { x: string; y: string; width: string };
  disabled: boolean;
  onChange: (value: { x: string; y: string; width: string }) => void;
}
const widths = ['small', 'medium', 'large', 'full'] as const;
const clamp = (value: number) => Math.min(100, Math.max(0, value));


export function TextOverlayCanvas({ image, value, disabled, onChange }: TextOverlayCanvasProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  function move(event: PointerEvent<HTMLElement>) {
    const bounds = canvasRef.current?.getBoundingClientRect();
    if (!bounds) return;
    onChange({ ...value, x: String(Math.round(clamp(((event.clientX - bounds.left) / bounds.width) * 100) * 100) / 100), y: String(Math.round(clamp(((event.clientY - bounds.top) / bounds.height) * 100) * 100) / 100) });
  }
  return <fieldset className="studio-glass-control space-y-3 rounded-xl border border-border p-3"><legend className="px-1 text-sm font-semibold">Text overlay</legend>
    {image ? <div className="relative aspect-video overflow-hidden rounded-lg border border-border bg-muted bg-cover bg-center" ref={canvasRef} style={{ backgroundImage: `url(${image.url})` }}><button aria-label="Drag text overlay position" className="absolute min-h-11 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-white/70 bg-white/90 px-3 py-2 text-left text-xs font-semibold text-foreground shadow" disabled={disabled} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); move(event); }} onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) move(event); }} onPointerUp={(event) => event.currentTarget.releasePointerCapture(event.pointerId)} style={{ left: `${value.x}%`, top: `${value.y}%`, width: value.width === 'small' ? '25%' : value.width === 'medium' ? '40%' : value.width === 'large' ? '60%' : '82%' }} type="button">Text overlay</button></div> : <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">Upload primary media to position the overlay visually.</p>}
    <div className="grid grid-cols-2 gap-2"><label className="block text-xs font-medium">X<input className={lessonInputClass} disabled={disabled} onChange={(event) => onChange({ ...value, x: event.target.value })} type="number" value={value.x} /></label><label className="block text-xs font-medium">Y<input className={lessonInputClass} disabled={disabled} onChange={(event) => onChange({ ...value, y: event.target.value })} type="number" value={value.y} /></label></div>
    <label className="block text-xs font-medium">Width<select className={lessonInputClass} disabled={disabled} onChange={(event) => onChange({ ...value, width: event.target.value })} value={value.width || 'medium'}>{widths.map((width) => <option key={width} value={width}>{width[0].toUpperCase() + width.slice(1)}</option>)}</select></label>
  </fieldset>;
}
