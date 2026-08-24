import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { PortableText } from '@portabletext/react';
import { supMark } from '@/shared/portable-text-components';
import { CourseLesson } from '@/shared/contracts/player-course';
import Image from 'next/image';
import { CheckCircle2 } from 'lucide-react';

interface DragDropLessonProps {
  lesson: CourseLesson;
  isCompleted: boolean;
  onComplete: () => void;
}

interface DesktopDragState {
  chipId: string;
  text: string;
  x: number;
  y: number;
  status: 'dragging' | 'dropping';
  dropX?: number;
  dropY?: number;
}

const DROP_ANIMATION_DURATION_MS = 260;

export default function DragDropLesson({ lesson, isCompleted, onComplete }: DragDropLessonProps) {
  const { headline, body, dropZones = [], chips = [], media } = lesson;
  const [snapped, setSnapped] = useState<Record<string, string>>({});
  const [shakeZone, setShakeZone] = useState<string | null>(null);
  const [shakeChip, setShakeChip] = useState<string | null>(null);
  const [focusedZone, setFocusedZone] = useState<string | null>(null);
  const [pickedUpChip, setPickedUpChip] = useState<string | null>(null);
  const [usesTouchInteraction, setUsesTouchInteraction] = useState(false);
  const [desktopDrag, setDesktopDrag] = useState<DesktopDragState | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const zonesRef = useRef<Record<string, HTMLButtonElement | null>>({});
  const finishDesktopDragRef = useRef<(chipId: string, x: number, y: number) => void>(() => {});

  const isAllComplete =
    dropZones.length > 0 && dropZones.every((z) => snapped[z.id] === z.correctChipId);

  useEffect(() => {
    if (isAllComplete && !isCompleted) {
      onComplete();
    }
  }, [isAllComplete, isCompleted, onComplete]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
    const updateInteraction = () => setUsesTouchInteraction(!mediaQuery.matches);

    updateInteraction();
    mediaQuery.addEventListener('change', updateInteraction);
    return () => mediaQuery.removeEventListener('change', updateInteraction);
  }, []);
  const announce = (msg: string) => setAnnouncement(msg);

  const placeChip = useCallback(
    (chipId: string, zoneId: string) => {
      const zone = dropZones.find((item) => item.id === zoneId);
      if (!zone || snapped[zone.id]) return;

      if (zone.correctChipId === chipId) {
        setSnapped((prev) => ({ ...prev, [zone.id]: chipId }));
        setPickedUpChip(null);
        setFocusedZone(null);
        announce(`Dropped correct chip on ${zone.label}.`);
        return;
      }

      setShakeZone(zone.id);
      setShakeChip(chipId);
      setPickedUpChip(null);
      setFocusedZone(null);
      setTimeout(() => setShakeZone(null), 500);
      setTimeout(() => setShakeChip(null), 500);
      announce(`Dropped incorrect chip on ${zone.label}. Chip returned.`);
    },
    [dropZones, snapped],
  );

  const finishDesktopDrag = useCallback(
    (chipId: string, x: number, y: number) => {
      const droppedZone = dropZones.find((zone) => {
        if (snapped[zone.id]) return false;
        const rect = zonesRef.current[zone.id]?.getBoundingClientRect();
        return !!rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
      });

      if (!droppedZone) {
        announce('Chip returned to tray.');
        setDesktopDrag(null);
        return;
      }

      const rect = zonesRef.current[droppedZone.id]?.getBoundingClientRect();
      if (!rect) {
        announce('Chip returned to tray.');
        setDesktopDrag(null);
        return;
      }

      setDesktopDrag((drag) =>
        drag && drag.chipId === chipId
          ? {
              ...drag,
              status: 'dropping',
              dropX: rect.left + rect.width / 2,
              dropY: rect.top + rect.height / 2,
            }
          : drag,
      );
      window.setTimeout(() => {
        placeChip(chipId, droppedZone.id);
        setDesktopDrag(null);
      }, DROP_ANIMATION_DURATION_MS);
    },
    [dropZones, snapped, placeChip],
  );

  useEffect(() => {
    finishDesktopDragRef.current = finishDesktopDrag;
  }, [finishDesktopDrag]);

  const startDesktopDrag = (
    event: React.PointerEvent<HTMLButtonElement>,
    chipId: string,
    text: string,
  ) => {
    if (usesTouchInteraction || event.button !== 0) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDesktopDrag({
      chipId,
      text,
      x: event.clientX,
      y: event.clientY,
      status: 'dragging',
    });
  };

  const activeDesktopChipId = desktopDrag?.chipId;

  useEffect(() => {
    if (!activeDesktopChipId) return;

    const handlePointerMove = (event: PointerEvent) => {
      setDesktopDrag((drag) => drag && { ...drag, x: event.clientX, y: event.clientY });
    };
    const handlePointerUp = (event: PointerEvent) => {
      window.removeEventListener('pointermove', handlePointerMove);
      finishDesktopDragRef.current(activeDesktopChipId, event.clientX, event.clientY);
    };
    const handlePointerCancel = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      setAnnouncement('Chip returned to tray.');
      setDesktopDrag(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
    window.addEventListener('pointercancel', handlePointerCancel, { once: true });
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
    };
  }, [activeDesktopChipId]);

  const selectChip = (chipId: string) => {
    if (pickedUpChip === chipId) {
      setPickedUpChip(null);
      setFocusedZone(null);
      announce('Selection cleared.');
      return;
    }
    setPickedUpChip(chipId);
    const emptyCount = dropZones.filter((zone) => !snapped[zone.id]).length;
    const chipText = chips.find((chip) => chip.id === chipId)?.text || 'Chip';
    announce(`${chipText} selected. ${emptyCount} drop zones available. Tap a target to place it.`);
  };

  const handleKeyDownChip = (e: React.KeyboardEvent, chipId: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectChip(chipId);
      const firstEmpty = dropZones.find((z) => !snapped[z.id]);
      if (firstEmpty) {
        setFocusedZone(firstEmpty.id);
        const emptyCount = dropZones.filter((z) => !snapped[z.id]).length;
        const chipText = chips.find((c) => c.id === chipId)?.text || 'Chip';
        announce(
          `${chipText} selected. ${emptyCount} drop zones available. Use Tab or Arrows to select a zone, and Space to drop.`,
        );
      } else {
        announce('All drop zones are filled.');
      }
    }
  };

  const handleKeyDownZone = (e: React.KeyboardEvent, zoneId: string) => {
    if (!pickedUpChip) return;

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      placeChip(pickedUpChip, zoneId);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const emptyZones = dropZones.filter((z) => !snapped[z.id]);
      const idx = emptyZones.findIndex((z) => z.id === zoneId);
      if (idx !== -1 && idx < emptyZones.length - 1) {
        const nextId = emptyZones[idx + 1].id;
        setFocusedZone(nextId);
        zonesRef.current[nextId]?.focus();
      }
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const emptyZones = dropZones.filter((z) => !snapped[z.id]);
      const idx = emptyZones.findIndex((z) => z.id === zoneId);
      if (idx > 0) {
        const prevId = emptyZones[idx - 1].id;
        setFocusedZone(prevId);
        zonesRef.current[prevId]?.focus();
      }
    }
  };
  useEffect(() => {
    if (focusedZone && zonesRef.current[focusedZone]) {
      zonesRef.current[focusedZone]?.focus();
    }
  }, [focusedZone]);

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden bg-[radial-gradient(ellipse_95%_90%_at_72%_38%,#24215d_0%,#11122c_47%,#080914_100%)] text-white md:flex-row"
      ref={containerRef}
    >
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
      <div className="relative z-10 flex w-full flex-col overflow-y-auto border-white/10 bg-[#090a18]/65 p-6 backdrop-blur-sm md:w-[40%] md:border-r md:p-12">
        <p className="mb-3 text-[11px] font-semibold tracking-[0.24em] text-[#a9a0ff] uppercase">
          Practice challenge
        </p>
        <h2 className="mb-4 text-3xl font-bold">{headline}</h2>
        {body && (
          <div className="prose prose-invert mb-8 max-w-none text-white/65">
            {typeof body === 'string' ? (
              <p>{body}</p>
            ) : (
              <PortableText
                value={body as import('@portabletext/types').PortableTextBlock[]}
                components={{ marks: supMark }}
              />
            )}
          </div>
        )}
        <div className="hide-scrollbar mt-auto flex w-full snap-x snap-mandatory flex-row gap-3 overflow-x-auto border-t border-white/10 pt-4 pb-4 md:mt-0 md:flex-col md:border-t-0 md:pt-0">
          {chips.map((chip) => {
            const isSnapped = Object.values(snapped).includes(chip.id);
            const isPickedUp = pickedUpChip === chip.id;
            const isShake = shakeChip === chip.id;
            if (isSnapped) return null;

            return (
              <motion.button
                key={chip.id}
                onPointerDown={(event) => startDesktopDrag(event, chip.id, chip.text)}
                onClick={usesTouchInteraction ? () => selectChip(chip.id) : undefined}
                whileHover={{ scale: 1.02 }}
                className={`focus-visible:ring-primary relative flex min-h-[44px] min-w-[44px] shrink-0 cursor-grab snap-start items-center justify-center rounded-lg border px-4 py-2 font-medium shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:cursor-grabbing ${isPickedUp ? 'border-[#a9a0ff] bg-[#685bc7]/25 ring-2 ring-[#a9a0ff]' : 'border-white/15 bg-white/[0.08] text-white hover:bg-white/[0.14] hover:shadow-[0_0_24px_rgba(137,124,255,0.28)]'} ${isShake ? 'border-red-300/70 bg-red-500/20 text-red-100' : ''} ${desktopDrag?.chipId === chip.id ? 'opacity-30' : ''} `}
                animate={isShake ? { x: [-10, 10, -10, 10, 0] } : {}}
                transition={
                  isShake
                    ? { duration: 0.4, ease: 'easeInOut' }
                    : { type: 'spring', stiffness: 300, damping: 20 }
                }
                tabIndex={0}
                onKeyDown={(e) => handleKeyDownChip(e, chip.id)}
                aria-label={`Select ${chip.text}`}
              >
                {chip.text}
              </motion.button>
            );
          })}
        </div>
      </div>
      <div className="relative flex min-h-[50vh] w-full flex-1 items-center justify-center overflow-hidden bg-[#12142c]/55 md:w-[60%]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(129,111,255,0.2),transparent_52%)]" />
        {media?.asset?.url ? (
          <div className="relative h-[80vh] w-full">
            <Image
              src={media.asset.url}
              alt="Product Image"
              fill
              className="pointer-events-none object-contain drop-shadow-[0_28px_46px_rgba(0,0,0,0.45)] select-none"
            />
            {dropZones.map((zone) => {
              const filledWith = snapped[zone.id];
              const chip = filledWith ? chips.find((c) => c.id === filledWith) : null;
              const isActive = pickedUpChip !== null && !filledWith;
              const isShake = shakeZone === zone.id;

              return (
                <div
                  key={zone.id}
                  style={{ left: `${zone.xPositionPct}%`, top: `${zone.yPositionPct}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                >
                  {filledWith ? (
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="pointer-events-none flex items-center justify-center rounded-lg border-2 border-[#a9a0ff] bg-[#685bc7]/35 px-4 py-2 font-medium text-white shadow-[0_0_28px_rgba(137,124,255,0.45)]"
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      {chip?.text}
                    </motion.div>
                  ) : (
                    <motion.button
                      ref={(el) => {
                        zonesRef.current[zone.id] = el;
                      }}
                      tabIndex={pickedUpChip ? 0 : -1}
                      onClick={
                        usesTouchInteraction && pickedUpChip
                          ? () => placeChip(pickedUpChip, zone.id)
                          : undefined
                      }
                      onKeyDown={(e) => handleKeyDownZone(e, zone.id)}
                      animate={isShake ? { x: [-10, 10, -10, 10, 0] } : {}}
                      transition={isShake ? { duration: 0.4, ease: 'easeInOut' } : undefined}
                      className={`focus-visible:ring-primary flex h-20 w-20 items-center justify-center rounded-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${isActive ? 'hover:scale-110' : ''} `}
                      aria-label={`Drop zone for ${zone.label}`}
                    >
                      <span
                        className={`flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed backdrop-blur-sm ${
                          isActive
                            ? 'border-[#c4bdff] bg-[#685bc7]/35 shadow-[0_0_25px_rgba(137,124,255,0.32)] hover:border-white'
                            : 'border-[#a9a0ff]/55 bg-[#17193b]/55'
                        } ${isShake ? 'border-red-300 bg-red-500/20' : ''}`}
                      >
                        {isActive && (
                          <span className="bg-primary/40 h-3 w-3 animate-pulse rounded-full" />
                        )}
                      </span>
                    </motion.button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-muted-foreground">No product image configured.</div>
        )}
      </div>
      {desktopDrag &&
        createPortal(
          <motion.div
            aria-hidden="true"
            className="pointer-events-none fixed z-[100] flex min-h-[44px] w-max max-w-[min(85vw,22rem)] items-center justify-center rounded-lg border border-white/15 bg-[#1a1b35]/95 px-4 py-2 text-center font-medium text-white shadow-[0_16px_40px_rgba(0,0,0,0.45)] backdrop-blur-md"
            initial={{
              left: desktopDrag.x,
              top: desktopDrag.y,
              opacity: 0,
              scale: 0.9,
              x: '-50%',
              y: '-50%',
            }}
            animate={
              desktopDrag.status === 'dropping'
                ? {
                    left: desktopDrag.dropX,
                    top: desktopDrag.dropY,
                    opacity: 0,
                    scale: 0.05,
                    x: '-50%',
                    y: '-50%',
                  }
                : {
                    left: desktopDrag.x,
                    top: desktopDrag.y,
                    opacity: 1,
                    scale: 1.05,
                    x: '-50%',
                    y: '-50%',
                  }
            }
            transition={
              desktopDrag.status === 'dropping'
                ? { duration: DROP_ANIMATION_DURATION_MS / 1000, ease: 'easeIn' }
                : { duration: 0.08, ease: 'linear' }
            }
          >
            {desktopDrag.text}
          </motion.div>,
          document.body,
        )}
    </div>
  );
}
