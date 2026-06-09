"use client";

import React, { useEffect, useRef } from "react";
import { X, ChevronLeft } from "lucide-react";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { motion, AnimatePresence, PanInfo } from "framer-motion";

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
      if (e.key === "Escape") onCloseRef.current();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <div className="absolute inset-0 z-50 overflow-hidden pointer-events-none flex flex-col justify-end">
          {/* Scrim */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-background/60 backdrop-blur-sm pointer-events-auto"
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
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="layer-frame-title"
            className="relative w-full h-full sm:h-auto sm:max-h-[90dvh] bg-background/95 rounded-t-[2rem] shadow-2xl flex flex-col pointer-events-auto border border-border"
          >
            {/* Drag Handle */}
            <div className="w-full flex justify-center py-3 shrink-0 cursor-grab active:cursor-grabbing">
              <div className="w-12 h-1.5 rounded-full bg-white/20" />
            </div>

            {/* Header */}
            <header className="sticky top-0 z-20 flex items-center justify-between px-6 pb-4 shrink-0">
              <div className="flex items-center gap-3 overflow-hidden">
                <button 
                  onClick={onClose}
                  className="p-2 -ml-2 rounded-full hover:bg-muted transition-colors shrink-0"
                  aria-label={`Back to ${parentLessonTitle}`}
                >
                  <ChevronLeft className="w-5 h-5 text-foreground" />
                </button>
                <div className="flex flex-col truncate">
                  <span className="text-[10px] uppercase tracking-widest text-accent font-bold truncate">
                    {parentLessonTitle}
                  </span>
                  <h2 id="layer-frame-title" className="text-lg font-semibold text-foreground truncate">
                    {layerTitle}
                  </h2>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 -mr-2 rounded-full hover:bg-muted transition-colors shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-foreground" />
              </button>
            </header>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 relative">
              {children}
              {/* Bottom fade hint */}
              <div className="sticky bottom-0 left-0 right-0 h-12 bg-linear-to-t from-background/95 to-transparent pointer-events-none -mb-6" />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
