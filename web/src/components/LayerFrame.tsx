'use client';

import React, { useEffect, useRef } from 'react';
import { X, ChevronLeft, Layers } from 'lucide-react';
import { useFocusTrap } from '@/lib/useFocusTrap';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';

interface LayerFrameProps {
  open: boolean;
  onClose: () => void;
  parentLessonTitle: string;
  layerTitle: string;
  children: React.ReactNode;
}

export function LayerFrame({
  open,
  onClose,
  parentLessonTitle,
  layerTitle,
  children,
}: LayerFrameProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useFocusTrap(panelRef, open);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCloseRef.current();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <div className="pointer-events-none absolute inset-0 z-50 flex flex-col justify-end overflow-hidden">
          {/* Scrim */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="bg-background/40 pointer-events-auto absolute inset-0 backdrop-blur-[1px]"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.div
            ref={panelRef}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, info: PanInfo) => {
              if (info.offset.y > 100 || info.velocity.y > 500) onCloseRef.current();
            }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="layer-frame-title"
            className="bg-card/80 pointer-events-auto relative flex h-full w-full flex-col rounded-t-3xl border border-white/10 shadow-2xl backdrop-blur-3xl sm:h-auto sm:max-h-[90dvh]"
          >
            {/* Drag Handle */}
            <div className="flex w-full shrink-0 cursor-grab justify-center py-3 active:cursor-grabbing">
              <div className="h-1.5 w-12 rounded-full bg-white/20" />
            </div>

            {/* Header */}
            <header className="shrink-0 border-b border-white/8 px-5 pb-3.5 pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <button
                    onClick={onClose}
                    className="text-muted-foreground hover:text-foreground hover:bg-foreground/8 -ml-1 shrink-0 rounded-xl p-2 transition-colors"
                    aria-label={`Back to ${parentLessonTitle}`}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <div className="bg-accent/20 ring-accent/30 shrink-0 rounded-full p-2 ring-1">
                    <Layers className="text-accent h-3.5 w-3.5" />
                  </div>
                  <span className="bg-accent/15 text-foreground border-accent/25 inline-flex items-center truncate rounded-full border px-2.5 py-0.5 text-[14px] font-semibold tracking-wide">
                    {layerTitle}
                  </span>
                </div>
                <button
                  onClick={onClose}
                  className="text-muted-foreground hover:text-foreground hover:bg-foreground/8 -mr-1 flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl p-2 transition-colors"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-accent mt-1.5 pl-[72px] text-[10px] font-bold tracking-widest uppercase">
                {parentLessonTitle}
              </p>
            </header>

            {/* Content */}
            <div
              className="scrollbar-none relative flex-1 overflow-y-auto px-5 py-4"
              style={{ scrollbarWidth: 'none' }}
            >
              {children}
              {/* Bottom fade hint */}
              <div className="from-card/80 pointer-events-none sticky right-0 bottom-0 left-0 -mb-4 h-10 bg-linear-to-t to-transparent" />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
