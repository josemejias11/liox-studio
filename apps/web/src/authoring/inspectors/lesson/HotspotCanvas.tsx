'use client';

import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { HotspotDraft, LessonImageDraft } from '@/authoring/inspectors/lesson/lesson-draft';

interface HotspotCanvasProps {
  image?: LessonImageDraft;
  hotspots: HotspotDraft[];
  disabled: boolean;
  onChange: (hotspots: HotspotDraft[]) => void;
  onAdd: (x: string, y: string) => void;
  onRemove: (index: number) => void;
}

const clamp = (value: number) => Math.min(100, Math.max(0, value));
const coordinate = (value: number) => String(Math.round(clamp(value) * 100) / 100);

/** Spatial hotspot placement that retains the numeric draft fields as the persistence boundary. */
export function HotspotCanvas({ image, hotspots, disabled, onChange, onAdd, onRemove }: HotspotCanvasProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const activeIndex = useRef<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  function point(event: PointerEvent<HTMLElement>) {
    const bounds = canvasRef.current?.getBoundingClientRect();
    if (!bounds) return null;
    return { x: coordinate(((event.clientX - bounds.left) / bounds.width) * 100), y: coordinate(((event.clientY - bounds.top) / bounds.height) * 100) };
  }
  function update(index: number, x: string, y: string) {
    onChange(hotspots.map((hotspot, itemIndex) => itemIndex === index ? { ...hotspot, x, y } : hotspot));
  }
  function keydown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const current = hotspots[index];
    const x = Number(current.x) || 0;
    const y = Number(current.y) || 0;
    const step = event.shiftKey ? 5 : 1;
    if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); onRemove(index); return; }
    const next = event.key === 'ArrowLeft' ? [x - step, y] : event.key === 'ArrowRight' ? [x + step, y] : event.key === 'ArrowUp' ? [x, y - step] : event.key === 'ArrowDown' ? [x, y + step] : null;
    if (!next) return;
    event.preventDefault();
    update(index, coordinate(next[0]), coordinate(next[1]));
  }

  if (!image) return <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">Upload primary media to place targets visually. Numeric coordinates remain available below.</p>;
  return <section className="studio-glass-control rounded-xl border border-border p-3" aria-label="Visual hotspot placement">
    <p className="mb-2 text-xs text-muted-foreground">Click to add a target. Select a target and use arrow keys to adjust; Shift + arrow moves 5%.</p>
    <div className="relative aspect-video overflow-hidden rounded-lg border border-border bg-muted bg-cover bg-center" onPointerDown={(event) => {
      if (disabled || event.target !== event.currentTarget) return;
      const position = point(event);
      if (position) onAdd(position.x, position.y);
    }} ref={canvasRef} style={{ backgroundImage: `url(${image.url})` }}>
      {hotspots.map((hotspot, index) => <button aria-label={`Position ${hotspot.label || `target ${index + 1}`}: ${hotspot.x}% horizontal, ${hotspot.y}% vertical`} className={`absolute flex min-h-11 min-w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-xs font-bold shadow ${selected === index ? 'border-primary bg-primary text-primary-foreground' : 'border-white bg-black/70 text-white'}`} disabled={disabled} key={hotspot.clientKey} onFocus={() => setSelected(index)} onKeyDown={(event) => keydown(event, index)} onPointerDown={(event) => { event.stopPropagation(); activeIndex.current = index; setSelected(index); event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { if (activeIndex.current !== index || disabled) return; const position = point(event); if (position) update(index, position.x, position.y); }} onPointerUp={(event) => { activeIndex.current = null; event.currentTarget.releasePointerCapture(event.pointerId); }} style={{ left: `${hotspot.x}%`, top: `${hotspot.y}%` }} type="button">{index + 1}</button>)}
    </div>
  </section>;
}
