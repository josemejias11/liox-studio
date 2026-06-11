'use client';

import React, { useEffect, useRef } from 'react';
import { X, ChevronLeft } from 'lucide-react';
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
            className="bg-background/60 pointer-events-auto absolute inset-0 backdrop-blur-sm"
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
            className="bg-background/95 border-border pointer-events-auto relative flex h-full w-full flex-col rounded-t-[2rem] border shadow-2xl sm:h-auto sm:max-h-[90dvh]"
          >
            {/* Drag Handle */}
            <div className="flex w-full shrink-0 cursor-grab justify-center py-3 active:cursor-grabbing">
              <div className="h-1.5 w-12 rounded-full bg-white/20" />
            </div>

            {/* Header */}
            <header className="sticky top-0 z-20 flex shrink-0 items-center justify-between px-6 pb-4">
              <div className="flex items-center gap-3 overflow-hidden">
                <button
                  onClick={onClose}
                  className="hover:bg-muted -ml-2 shrink-0 rounded-full p-2 transition-colors"
                  aria-label={`Back to ${parentLessonTitle}`}
                >
                  <ChevronLeft className="text-foreground h-5 w-5" />
                </button>
                <div className="flex flex-col truncate">
                  <span className="text-accent truncate text-[10px] font-bold tracking-widest uppercase">
                    {parentLessonTitle}
                  </span>
                  <h2
                    id="layer-frame-title"
                    className="text-foreground truncate text-lg font-semibold"
                  >
                    {layerTitle}
                  </h2>
                </div>
              </div>
              <button
                onClick={onClose}
                className="hover:bg-muted -mr-2 shrink-0 rounded-full p-2 transition-colors"
                aria-label="Close"
              >
                <X className="text-foreground h-5 w-5" />
              </button>
            </header>

            {/* Content */}
            <div className="relative flex-1 overflow-y-auto p-6">
              {children}
              {/* Bottom fade hint */}
              <div className="from-background/95 pointer-events-none sticky right-0 bottom-0 left-0 -mb-6 h-12 bg-linear-to-t to-transparent" />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
