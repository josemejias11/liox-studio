'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Sparkles } from 'lucide-react';
import { useFocusTrap } from '@/shared/useFocusTrap';
import type { RichText, CoursePhoto } from '@/shared/contracts/player-course';
import { DiscoveryLearnContent } from './discovery/DiscoveryLearnContent';
import type { InlineDiscoveryCueResolver } from '@/learning/player/lesson-types/InlineDiscoveryCue';

interface DiscoveryPanelProps {
  open: boolean;
  onClose: () => void;
  label: string;
  topic?: string;
  body?: RichText;
  photos?: CoursePhoto[];
  videoFile?: { asset?: { url?: string } };
  videoAspectRatio?: string;
  x?: number;
  y?: number;
  mode?: 'sidebar' | 'popover';
  sidebarPlacement?: 'edge' | 'workbench';
  dimBackdrop?: boolean;
  courseId?: string;

  preview?: boolean;
  resolveLinkedLayer?: InlineDiscoveryCueResolver;
}

export function DiscoveryPanel({
  open,
  onClose,
  label,
  topic: _topic,
  body,
  photos = [],
  videoFile,
  videoAspectRatio,
  x,
  y,
  mode,
  sidebarPlacement = 'edge',
  dimBackdrop = true,
  courseId: _courseId,
  preview: _preview = false,
  resolveLinkedLayer,
}: DiscoveryPanelProps) {
  const hasVideo = !!videoFile?.asset?.url;
  const hasLearnContent = !!(body || (photos?.length ?? 0) > 0 || hasVideo);
  const isWorkbenchSidebar = sidebarPlacement === 'workbench';
  const [liveAnnouncement, setLiveAnnouncement] = useState('');
  const [lastPosition, setLastPosition] = useState<{ x: number; y: number } | null>(null);
  const [isMobileView, setIsMobileView] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const swipeTouchStartX = useRef(0);
  const swipeTouchStartY = useRef(0);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLastPosition(x !== undefined && y !== undefined ? { x, y } : null);
      setLiveAnnouncement(`Opened ${label}. ${hasLearnContent ? 'Learn content available.' : ''}`);
    } else {
      setLiveAnnouncement(`Closed ${label}.`);
    }
  }, [open, label, hasLearnContent, x, y]);

  useFocusTrap(panelRef, open);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMobileView(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobileView(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return (
    <div
      className={`absolute inset-0 z-30 transition-all duration-300 ease-out ${
        isWorkbenchSidebar
          ? 'pointer-events-none'
          : open
            ? 'pointer-events-auto'
            : 'pointer-events-none'
      }`}
    >
      {!isWorkbenchSidebar && (
        <div
          onClick={onClose}
          className={`${dimBackdrop ? 'bg-background/40 backdrop-blur-[1px]' : 'bg-transparent'} absolute inset-0 transition-opacity duration-300 ${
            open ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {liveAnnouncement}
      </div>
      {(() => {
        const posX = x !== undefined ? x : lastPosition?.x;
        const posY = y !== undefined ? y : lastPosition?.y;
        const isFloating =
          mode === 'popover' || (mode === undefined && posX !== undefined && posY !== undefined);

        let floatingStyle: React.CSSProperties = {};
        let originClass = 'origin-center';

        if (isFloating && posX !== undefined && posY !== undefined) {
          const isLeft = posX < 50;
          if (isLeft) floatingStyle.left = `clamp(4%, ${posX + 2}%, 56%)`;
          else floatingStyle.right = `clamp(4%, ${100 - posX + 2}%, 56%)`;

          floatingStyle.top = '4%';
          floatingStyle.bottom = '4%';

          originClass = isLeft ? 'origin-top-left' : 'origin-top-right';
        } else if (isFloating) {
          floatingStyle = {
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            maxHeight: 'min(700px, 88%)',
          };
        }

        let panelWidthClass = 'w-[min(500px,58%)]';
        if (hasVideo) {
          if (videoAspectRatio === '9:16') {
            panelWidthClass = 'w-[min(320px,45%)]';
          } else if (videoAspectRatio === '4:5') {
            panelWidthClass = 'w-[min(380px,50%)]';
          } else if (videoAspectRatio === '1:1') {
            panelWidthClass = 'w-[min(480px,55%)]';
          } else {
            panelWidthClass = 'w-[min(640px,70%)]';
          }
        }
        const floatingClasses = `absolute ${panelWidthClass} rounded-3xl flex flex-col
          bg-card/80 dark:bg-card/95 backdrop-blur-3xl border border-white/10
          shadow-2xl transition-[opacity,transform] ${originClass}
          ${
            open
              ? 'opacity-100 scale-100 duration-[260ms] ease-[cubic-bezier(0.16,1,0.3,1)]'
              : 'opacity-0 scale-[0.88] pointer-events-none duration-[200ms] ease-[cubic-bezier(0.32,0.72,0,1)]'
          }`;
        const mobileClasses = `absolute right-0 bottom-0 left-0 h-[92%] rounded-t-3xl flex flex-col
          bg-card/80 dark:bg-card/95 backdrop-blur-3xl border-t border-white/10
          shadow-2xl transition-[transform] ease-[cubic-bezier(0.16,1,0.3,1)]
          ${
            open
              ? 'translate-y-0 duration-[320ms]'
              : 'translate-y-full pointer-events-none duration-[200ms]'
          }`;
        const sidebarClasses = `absolute top-0 right-0 bottom-0 w-[48%] flex flex-col
          bg-card/80 dark:bg-card/95 backdrop-blur-2xl border-l border-white/10
          shadow-2xl transition-[transform] ease-[cubic-bezier(0.32,0.72,0,1)]
          ${open ? 'translate-x-0 duration-[280ms]' : 'translate-x-full duration-[200ms]'}`;
        const workbenchSidebarClasses = `pointer-events-auto absolute top-6 right-6 bottom-6 w-[min(27rem,33vw)] flex flex-col rounded-[1.25rem]
          bg-card/92 dark:bg-card/95 backdrop-blur-2xl border border-white/10
          shadow-[0_24px_80px_rgba(0,0,0,0.38)] transition-[transform,opacity] ease-[cubic-bezier(0.32,0.72,0,1)]
          ${
            open
              ? 'translate-x-0 opacity-100 duration-[280ms]'
              : 'translate-x-[calc(100%+1.5rem)] opacity-0 pointer-events-none duration-[200ms]'
          }`;

        return (
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => {
              swipeTouchStartX.current = e.touches[0].clientX;
              swipeTouchStartY.current = e.touches[0].clientY;
            }}
            onTouchEnd={(e) => {
              if (!isFloating && e.changedTouches[0].clientX - swipeTouchStartX.current > 56)
                onClose();
              if (isMobileView && e.changedTouches[0].clientY - swipeTouchStartY.current > 80)
                onClose();
            }}
            style={!isMobileView && isFloating ? floatingStyle : undefined}
            className={
              isMobileView
                ? mobileClasses
                : isFloating
                  ? floatingClasses
                  : isWorkbenchSidebar
                    ? workbenchSidebarClasses
                    : sidebarClasses
            }
          >
            <div className="shrink-0 border-b border-white/8 px-5 pt-4 pb-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="bg-accent/20 ring-accent/30 rounded-full p-2 ring-1">
                    <Sparkles className="text-accent h-3.5 w-3.5" />
                  </div>
                  <span className="bg-accent/15 text-foreground border-accent/25 inline-flex items-center rounded-full border px-2.5 py-0.5 text-[14px] font-semibold tracking-wide">
                    {label}
                  </span>
                </div>
                <button
                  onClick={onClose}
                  className="text-muted-foreground hover:text-foreground hover:bg-foreground/8 flex min-h-11 min-w-11 items-center justify-center rounded-xl p-2 transition-colors"
                  aria-label="Close panel"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {
              <div
                className="flex-1 scrollbar-none overflow-y-auto"
                style={{ scrollbarWidth: 'none' }}
              >
                {hasLearnContent ? (
                  <DiscoveryLearnContent
                    body={body}
                    photos={photos}
                    videoFile={videoFile}
                    videoAspectRatio={videoAspectRatio}
                    resolveLinkedLayer={resolveLinkedLayer}
                  />
                ) : (
                  <p className="text-muted-foreground px-5 py-8 text-sm">
                    No additional authored material is available for this feature.
                  </p>
                )}
              </div>
            }
          </div>
        );
      })()}
    </div>
  );
}
