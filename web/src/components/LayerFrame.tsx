"use client";

import { useEffect, useRef } from "react";
import { X, ChevronLeft } from "lucide-react";
import { useFocusTrap } from "@/lib/useFocusTrap";

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
  const swipeStartY = useRef(0);
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

  // Swipe-to-dismiss gesture
  useEffect(() => {
    if (!open) return;
    const el = panelRef.current;
    if (!el) return;

    function onTouchStart(e: TouchEvent) {
      if (el!.scrollTop === 0) swipeStartY.current = e.touches[0].clientY;
      else swipeStartY.current = 0;
    }
    function onTouchEnd(e: TouchEvent) {
      if (!swipeStartY.current) return;
      const dy = e.changedTouches[0].clientY - swipeStartY.current;
      if (dy > 80) onCloseRef.current();
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchend", onTouchEnd);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-50 overflow-hidden pointer-events-auto flex flex-col justify-end">
      {/* Scrim */}
      <div 
        className="absolute inset-0 bg-moto-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="layer-frame-title"
        className="relative w-full max-h-[90dvh] bg-moto-black/95 rounded-t-3xl shadow-2xl overflow-y-auto flex flex-col translate-y-0 opacity-100 transition-all duration-300 ease-out"
        style={{ animation: "slide-enter-up 0.3s ease-out" }}
      >
        {/* Header */}
        <header className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 bg-moto-black/80 backdrop-blur-md border-b border-white/5">
          <div className="flex items-center gap-3 overflow-hidden">
            <button 
              onClick={onClose}
              className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors"
              aria-label={`Back to ${parentLessonTitle}`}
            >
              <ChevronLeft className="w-5 h-5 text-moto-frost" />
            </button>
            <div className="flex flex-col truncate">
              <span className="text-[10px] uppercase tracking-widest text-moto-indigo/80 font-bold truncate">
                {parentLessonTitle}
              </span>
              <h2 id="layer-frame-title" className="text-lg font-semibold text-moto-frost truncate">
                {layerTitle}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-2 rounded-full hover:bg-white/10 transition-colors shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-moto-frost" />
          </button>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 relative">
          {children}
          {/* Bottom fade hint */}
          <div className="sticky bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-moto-black/95 to-transparent pointer-events-none -mb-6" />
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes slide-enter-up {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}} />
    </div>
  );
}
