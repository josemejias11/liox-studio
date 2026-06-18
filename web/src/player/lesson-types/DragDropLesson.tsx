import React, { useState, useEffect, useRef } from 'react';
import { motion, PanInfo } from 'framer-motion';
import { PortableText } from '@portabletext/react';
import { supMark } from '@/lib/portable-text-components';
import { SanityLesson } from '@/lib/contracts/sanity';
import Image from 'next/image';
import { CheckCircle2 } from 'lucide-react';

interface DragDropLessonProps {
  lesson: SanityLesson;
  isCompleted: boolean;
  onComplete: () => void;
}

export default function DragDropLesson({ lesson, isCompleted, onComplete }: DragDropLessonProps) {
  const { headline, body, dropZones = [], chips = [], media } = lesson;
  
  // Track correctly snapped chips: map of dropZone id -> chip id
  const [snapped, setSnapped] = useState<Record<string, string>>({});
  
  // Track incorrect drops to trigger shake
  const [shakeZone, setShakeZone] = useState<string | null>(null);
  const [shakeChip, setShakeChip] = useState<string | null>(null);

  // Keyboard navigation
  // const [focusedChip, setFocusedChip] = useState<string | null>(null);
  const [focusedZone, setFocusedZone] = useState<string | null>(null);
  const [pickedUpChip, setPickedUpChip] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');

  // Refs for drop zones to calculate intersection
  const containerRef = useRef<HTMLDivElement>(null);
  const zonesRef = useRef<Record<string, HTMLDivElement | null>>({});

  const isAllComplete = dropZones.length > 0 && dropZones.every(z => snapped[z.id] === z.correctChipId);

  useEffect(() => {
    if (isAllComplete && !isCompleted) {
      onComplete();
    }
  }, [isAllComplete, isCompleted, onComplete]);

  // ARIA polite live announcer helper
  const announce = (msg: string) => setAnnouncement(msg);

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo, chipId: string) => {
    // Basic collision detection based on pointer coordinates relative to viewport
    const x = info.point.x;
    const y = info.point.y;

    let droppedZoneId: string | null = null;

    for (const zone of dropZones) {
      if (snapped[zone.id]) continue; // Already filled
      
      const el = zonesRef.current[zone.id];
      if (!el) continue;
      
      const rect = el.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        droppedZoneId = zone.id;
        break;
      }
    }

    if (droppedZoneId) {
      const zone = dropZones.find(z => z.id === droppedZoneId)!;
      if (zone.correctChipId === chipId) {
        setSnapped(prev => ({ ...prev, [zone.id]: chipId }));
        announce(`Dropped correct chip on ${zone.label}.`);
      } else {
        // Trigger shake
        setShakeChip(chipId);
        setTimeout(() => setShakeChip(null), 500);
        announce(`Dropped incorrect chip on ${zone.label}. Chip returned.`);
      }
    } else {
      announce('Chip returned to tray.');
    }
  };

  const handleKeyDownChip = (e: React.KeyboardEvent, chipId: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setPickedUpChip(chipId);
      
      // Auto-focus first empty zone
      const firstEmpty = dropZones.find(z => !snapped[z.id]);
      if (firstEmpty) {
        setFocusedZone(firstEmpty.id);
        const emptyCount = dropZones.filter(z => !snapped[z.id]).length;
        const chipText = chips.find(c => c.id === chipId)?.text || 'Chip';
        announce(`${chipText} selected. ${emptyCount} drop zones available. Use Tab or Arrows to select a zone, and Space to drop.`);
      } else {
        announce('All drop zones are filled.');
      }
    }
  };

  const handleKeyDownZone = (e: React.KeyboardEvent, zoneId: string) => {
    if (!pickedUpChip) return;
    
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const zone = dropZones.find(z => z.id === zoneId)!;
      
      if (zone.correctChipId === pickedUpChip) {
        setSnapped(prev => ({ ...prev, [zone.id]: pickedUpChip }));
        setPickedUpChip(null);
        setFocusedZone(null);
        announce(`Dropped correct chip on ${zone.label}.`);
        
        // Focus the next chip or something
      } else {
        setShakeZone(zoneId);
        setTimeout(() => setShakeZone(null), 500);
        setPickedUpChip(null);
        setFocusedZone(null);
        announce(`Dropped incorrect chip on ${zone.label}. Chip returned.`);
      }
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const emptyZones = dropZones.filter(z => !snapped[z.id]);
      const idx = emptyZones.findIndex(z => z.id === zoneId);
      if (idx !== -1 && idx < emptyZones.length - 1) {
        const nextId = emptyZones[idx + 1].id;
        setFocusedZone(nextId);
        zonesRef.current[nextId]?.focus();
      }
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const emptyZones = dropZones.filter(z => !snapped[z.id]);
      const idx = emptyZones.findIndex(z => z.id === zoneId);
      if (idx > 0) {
        const prevId = emptyZones[idx - 1].id;
        setFocusedZone(prevId);
        zonesRef.current[prevId]?.focus();
      }
    }
  };

  // Focus management effect
  useEffect(() => {
    if (focusedZone && zonesRef.current[focusedZone]) {
      zonesRef.current[focusedZone]?.focus();
    }
  }, [focusedZone]);

  // const remainingChips = chips.filter(c => !Object.values(snapped).includes(c.id));

  return (
    <div className="flex h-full w-full flex-col md:flex-row bg-background text-foreground" ref={containerRef}>
      {/* Invisible aria-live region */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      {/* Mobile: Image on top, Chips bottom tray / Desktop: Left Pane text+chips, Right Pane image */}
      
      {/* Left Pane (Desktop) / Top Content (Mobile) */}
      <div className="flex w-full flex-col md:w-[40%] p-6 md:p-12 overflow-y-auto z-10 relative">
        <h2 className="text-3xl font-bold mb-4">{headline}</h2>
        {body && (
          <div className="prose prose-invert max-w-none text-muted-foreground mb-8">
            {typeof body === 'string' ? <p>{body}</p> : <PortableText value={body as import('sanity').PortableTextBlock[]} components={{ marks: supMark }} />}
          </div>
        )}

        {/* Chips Tray */}
        <div className="mt-auto md:mt-0 pt-4 w-full border-t border-border/20 md:border-t-0 md:pt-0 pb-4 flex flex-row md:flex-col gap-3 overflow-x-auto snap-x snap-mandatory hide-scrollbar">
          {chips.map(chip => {
            const isSnapped = Object.values(snapped).includes(chip.id);
            const isPickedUp = pickedUpChip === chip.id;
            const isShake = shakeChip === chip.id;
            
            // If snapped, don't show in the tray (or show disabled)
            if (isSnapped) return null;

            return (
              <motion.button
                key={chip.id}
                drag={!isPickedUp}
                dragSnapToOrigin
                onDragEnd={(e, info) => handleDragEnd(e, info, chip.id)}
                whileHover={{ scale: 1.02 }}
                whileDrag={{ scale: 1.05, rotate: ((chip.text.length % 10 / 10) - 0.5) * 4, opacity: 0.95 }}
                className={`
                  snap-start shrink-0 relative flex min-h-[44px] min-w-[44px] items-center justify-center 
                  rounded-lg border px-4 py-2 font-medium shadow-sm transition-colors cursor-grab
                  active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
                  ${isPickedUp ? 'ring-2 ring-primary bg-primary/10' : 'bg-card border-border/50 hover:bg-muted/50 hover:shadow-md'}
                  ${isShake ? 'bg-red-50 border-red-200 text-red-900' : ''}
                `}
                animate={isShake ? { x: [-10, 10, -10, 10, 0] } : {}}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                tabIndex={0}
                onKeyDown={(e) => handleKeyDownChip(e, chip.id)}
                aria-label={`Select ${chip.text}`}
              >
                {chip.text}
              </motion.button>
            )
          })}
        </div>
      </div>

      {/* Right Pane (Desktop) / Background/Middle (Mobile) */}
      <div className="relative w-full md:w-[60%] flex-1 bg-muted/20 flex items-center justify-center overflow-hidden min-h-[50vh]">
        {media?.asset?.url ? (
          <div className="relative w-full h-[80vh]">
            <Image 
              src={media.asset.url} 
              alt="Product Image"
              fill
              className="object-contain pointer-events-none select-none"
            />
            {/* Drop Zones */}
            {dropZones.map(zone => {
              const filledWith = snapped[zone.id];
              const chip = filledWith ? chips.find(c => c.id === filledWith) : null;
              const isActive = pickedUpChip !== null && !filledWith;
              const isShake = shakeZone === zone.id;

              return (
                <div
                  key={zone.id}
                  ref={(el) => { zonesRef.current[zone.id] = el; }}
                  style={{ left: `${zone.xPositionPct}%`, top: `${zone.yPositionPct}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px]"
                >
                  {filledWith ? (
                    <motion.div 
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="flex items-center justify-center rounded-lg bg-green-500/10 border-2 border-green-500 text-green-900 dark:text-green-300 font-medium px-4 py-2 shadow-sm pointer-events-none"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      {chip?.text}
                    </motion.div>
                  ) : (
                    <motion.button
                      tabIndex={pickedUpChip ? 0 : -1}
                      onKeyDown={(e) => handleKeyDownZone(e, zone.id)}
                      animate={isShake ? { x: [-10, 10, -10, 10, 0] } : {}}
                      className={`
                        w-12 h-12 rounded-full border-2 border-dashed backdrop-blur-sm transition-all
                        flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
                        ${isActive ? 'border-primary/50 hover:border-primary hover:scale-115 hover:shadow-inner bg-primary/5' : 'border-foreground/30 bg-background/5'}
                        ${isShake ? 'bg-red-500/20 border-red-500' : ''}
                      `}
                      aria-label={`Drop zone for ${zone.label}`}
                    >
                      {isActive && <div className="w-3 h-3 rounded-full bg-primary/40 animate-pulse" />}
                    </motion.button>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-muted-foreground">No product image configured.</div>
        )}
      </div>
    </div>
  );
}
