'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Sparkles } from 'lucide-react';
import { useFocusTrap } from '@/lib/useFocusTrap';
import type { RichText, CoursePhoto } from '@/lib/contracts/player-course';
import { useChatConversation } from './course-ai/useChatConversation';
import { DiscoveryConversation } from './discovery/DiscoveryConversation';
import { DiscoveryLearnContent } from './discovery/DiscoveryLearnContent';
import type { InlineDiscoveryCueResolver } from '@/player/lesson-types/InlineDiscoveryCue';

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
  /** Render only authored material; do not start or expose Course AI. */
  preview?: boolean;
  resolveLinkedLayer?: InlineDiscoveryCueResolver;
}

export function DiscoveryPanel({
  open,
  onClose,
  label,
  topic,
  body,
  photos = [],
  videoFile,
  videoAspectRatio,
  x,
  y,
  mode,
  sidebarPlacement = 'edge',
  dimBackdrop = true,
  courseId,
  preview = false,
  resolveLinkedLayer,
}: DiscoveryPanelProps) {
  const hasVideo = !!videoFile?.asset?.url;
  const hasLearnContent = !!(body || (photos?.length ?? 0) > 0 || hasVideo);
  const isWorkbenchSidebar = sidebarPlacement === 'workbench';
  const [liveAnnouncement, setLiveAnnouncement] = useState('');
  const [lastPosition, setLastPosition] = useState<{ x: number; y: number } | null>(null);
  // Tracks whether the viewport is below the md breakpoint (768 px).
  // Initialized false (SSR-safe); corrected on mount and kept in sync with resize.
  const [isMobileView, setIsMobileView] = useState(false);
  const { messages, isLoading, send, abort, reset } = useChatConversation({
    courseId,
    onAssistantMessage: setLiveAnnouncement,
  });

  const panelRef = useRef<HTMLDivElement>(null);
  const greetingKeyRef = useRef<string | null>(null);
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

  // Sync isMobileView with the viewport width (md breakpoint = 768 px).
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMobileView(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobileView(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Reset conversation state when a new hotspot opens.
  useEffect(() => {
    if (open) {
      reset();
      greetingKeyRef.current = null;
    }
  }, [open, label, reset]);

  // Auto-fire AI greeting when the panel opens with a topic.
  useEffect(() => {
    if (preview || !open || !topic) return;
    const greetingKey = `${label}:${topic}`;
    if (greetingKeyRef.current === greetingKey) return;
    greetingKeyRef.current = greetingKey;

    const prompt = `Briefly explain the "${topic}" feature to a sales rep in 2-3 sentences. Be concise and sales-focused.`;
    void send(prompt, {
      displayUserMessage: false,
      displayPendingAssistant: true,
      queryOverride: `Regarding the "${topic}" feature: ${prompt}`,
      fallbackMessage: "Couldn't load content right now.",
    });
  }, [open, label, preview, topic, send]);

  useEffect(() => {
    if (!open) abort();
  }, [open, abort]);

  function handleSend(query: string) {
    if (preview) return;
    void send(query, {
      displayPendingAssistant: true,
      queryOverride: topic ? `Regarding the "${topic}" feature: ${query}` : query,
      fallbackMessage: "Couldn't load content right now.",
    });
  }

  return (
    <div
      className={`absolute inset-0 z-30 transition-all duration-300 ease-out ${
        isWorkbenchSidebar ? 'pointer-events-none' : open ? 'pointer-events-auto' : 'pointer-events-none'
      }`}
    >
      {/* Dimmer */}
      {!isWorkbenchSidebar && (
        <div
          onClick={onClose}
          className={`${dimBackdrop ? 'bg-background/40 backdrop-blur-[1px]' : 'bg-transparent'} absolute inset-0 transition-opacity duration-300 ${
            open ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}

      {/* Screen-reader live region for completed AI responses */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {liveAnnouncement}
      </div>

      {/* Panel — popover (floating) or sidebar */}
      {(() => {
        const posX = x !== undefined ? x : lastPosition?.x;
        const posY = y !== undefined ? y : lastPosition?.y;

        // If mode is explicitly popover, always treat as floating (even if x/y are not fully resolved yet)
        // If mode isn't set, guess based on whether we have coordinates.
        const isFloating =
          mode === 'popover' || (mode === undefined && posX !== undefined && posY !== undefined);

        let floatingStyle: React.CSSProperties = {};
        let originClass = 'origin-center';

        if (isFloating && posX !== undefined && posY !== undefined) {
          const isLeft = posX < 50;
          const isTop = posY < 50;

          // Clamp so the panel never bleeds outside the player container.
          // Horizontal: keep at least 4% margin from each edge.
          // Vertical: keep at least 2% margin from each edge.
          if (isLeft) floatingStyle.left = `clamp(4%, ${posX + 2}%, 56%)`;
          else floatingStyle.right = `clamp(4%, ${100 - posX + 2}%, 56%)`;

          if (isTop) {
            floatingStyle.top = `clamp(2%, ${posY}%, 55%)`;
            // Cap height to the space remaining below the hotspot so the panel never bleeds
            // past the player's overflow-hidden boundary.
            floatingStyle.maxHeight = `min(700px, ${Math.max(20, 98 - posY)}%)`;
          } else {
            floatingStyle.bottom = `clamp(2%, ${100 - posY}%, 55%)`;
            floatingStyle.maxHeight = `min(700px, ${Math.max(20, posY - 2)}%)`;
          }

          if (isLeft && isTop) originClass = 'origin-top-left';
          else if (isLeft && !isTop) originClass = 'origin-bottom-left';
          else if (!isLeft && isTop) originClass = 'origin-top-right';
          else originClass = 'origin-bottom-right';
        } else if (isFloating) {
          // Fallback if we are in popover mode but x/y aren't known yet (prevents jumping from sidebar)
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

        // Desktop/tablet floating panel — maxHeight is set via floatingStyle (dynamic, based on hotspot position).
        // Widen or narrow to accommodate the specific video aspect ratio.
        const floatingClasses = `absolute ${panelWidthClass} rounded-3xl flex flex-col
          bg-card/80 dark:bg-card/95 backdrop-blur-3xl border border-white/10
          shadow-2xl transition-[opacity,transform] ${originClass}
          ${open
            ? 'opacity-100 scale-100 duration-[260ms] ease-[cubic-bezier(0.16,1,0.3,1)]'
            : 'opacity-0 scale-[0.88] pointer-events-none duration-[200ms] ease-[cubic-bezier(0.32,0.72,0,1)]'
          }`;

        // Mobile bottom-sheet — slides up from the bottom, full width, ~72 % of viewport height.
        const mobileClasses = `absolute bottom-0 left-0 right-0 w-full h-[72vh] rounded-t-3xl flex flex-col
          bg-card/80 dark:bg-card/95 backdrop-blur-3xl border-t border-white/10
          shadow-2xl transition-[transform] ease-[cubic-bezier(0.16,1,0.3,1)]
          ${open
            ? 'translate-y-0 duration-[320ms]'
            : 'translate-y-full pointer-events-none duration-[200ms]'
          }`;

        // Sidebar (non-lesson / explicit sidebar mode) — slightly wider than before.
        const sidebarClasses = `absolute top-0 right-0 bottom-0 w-[48%] flex flex-col
          bg-card/80 dark:bg-card/95 backdrop-blur-2xl border-l border-white/10
          shadow-2xl transition-[transform] ease-[cubic-bezier(0.32,0.72,0,1)]
          ${open ? 'translate-x-0 duration-[280ms]' : 'translate-x-full duration-[200ms]'}`;
        const workbenchSidebarClasses = `pointer-events-auto absolute top-6 right-6 bottom-24 w-[min(27rem,33vw)] flex flex-col rounded-[1.25rem]
          bg-card/92 dark:bg-card/95 backdrop-blur-2xl border border-white/10
          shadow-[0_24px_80px_rgba(0,0,0,0.38)] transition-[transform,opacity] ease-[cubic-bezier(0.32,0.72,0,1)]
          ${open
            ? 'translate-x-0 opacity-100 duration-[280ms]'
            : 'translate-x-[calc(100%+1.5rem)] opacity-0 pointer-events-none duration-[200ms]'}`;

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
              // Sidebar: swipe right to close
              if (!isFloating && e.changedTouches[0].clientX - swipeTouchStartX.current > 56)
                onClose();
              // Mobile bottom-sheet: swipe down to close
              if (isMobileView && e.changedTouches[0].clientY - swipeTouchStartY.current > 80)
                onClose();
            }}
            // On mobile: bottom-sheet positioning (no inline style — Tailwind classes handle it).
            // On desktop floating: apply the clamp-based x/y inline style.
            // On sidebar: no inline style.
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
            {/* ── Header ── */}
            <div className="shrink-0 border-b border-white/8 px-5 pt-4 pb-3.5">
              <div className="flex items-center justify-between">
                {/* Left: AI indicator + label pill */}
                <div className="flex items-center gap-2.5">
                  <div className="bg-accent/20 ring-accent/30 rounded-full p-2 ring-1">
                    <Sparkles className="text-accent h-3.5 w-3.5" />
                  </div>
                  <span className="bg-accent/15 text-foreground border-accent/25 inline-flex items-center rounded-full border px-2.5 py-0.5 text-[14px] font-semibold tracking-wide">
                    {label}
                  </span>
                </div>
                {/* Right: close */}
                <button
                  onClick={onClose}
                  className="text-muted-foreground hover:text-foreground hover:bg-foreground/8 flex min-h-11 min-w-11 items-center justify-center rounded-xl p-2 transition-colors"
                  aria-label="Close panel"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {preview ? (
              <div className="scrollbar-none flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                {hasLearnContent ? (
                  <DiscoveryLearnContent
                    body={body}
                    photos={photos}
                    videoFile={videoFile}
                    videoAspectRatio={videoAspectRatio}
                    resolveLinkedLayer={resolveLinkedLayer}
                  />
                ) : (
                  <p className="px-5 py-8 text-sm text-muted-foreground">
                    No additional authored material is available for this feature.
                  </p>
                )}
              </div>
            ) : (
              <DiscoveryConversation
                key={`${label}:${open ? 'open' : 'closed'}`}
                label={label}
                topic={topic}
                messages={messages}
                isLoading={isLoading}
                hasLearnContent={hasLearnContent}
                onSend={handleSend}
                learnContent={
                  hasLearnContent ? (
                    <DiscoveryLearnContent
                      body={body}
                      photos={photos}
                      videoFile={videoFile}
                      videoAspectRatio={videoAspectRatio}
                      resolveLinkedLayer={resolveLinkedLayer}
                    />
                  ) : undefined
                }
              />
            )}
          </div>
        );
      })()}
    </div>
  );
}
