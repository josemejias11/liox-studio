'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { ChevronLeft, ChevronRight, Check, CheckCircle2 } from 'lucide-react';
import { Hotspot } from './Hotspot';
import { DiscoveryPanel } from './DiscoveryPanel';
import { CompletionBurst } from './CompletionBurst';
import { sanityImageLoader } from '@/lib/sanity-image-loader';
import type { RichText, SanityHotspot, SanityPhoto } from '@/lib/contracts/sanity';

interface ProductStageProps {
  headline: string;
  productImage?: string;
  stageBackground?: string;
  enableCompletionAnimation?: boolean;
  completionTransition?: 'spin' | 'rise' | 'fade';
  hotspots: SanityHotspot[];
  visited: Set<string>;
  onVisit: (label: string) => void;
  onNext: () => void;
  onPrev?: () => void;
  courseId: string;
}

export function ProductStage({
  headline,
  productImage,
  stageBackground,
  enableCompletionAnimation = false,
  completionTransition = 'spin',
  hotspots,
  visited,
  onVisit,
  onNext,
  onPrev,
  courseId,
}: ProductStageProps) {
  const [activePanel, setActivePanel] = useState<{
    label: string;
    topic: string;
    body?: RichText;
    photos?: SanityPhoto[];
    videoFile?: { asset?: { url?: string } };
    videoAspectRatio?: string;
    x?: number;
    y?: number;
  } | null>(null);

  // Phase 4 — completion burst
  const [showBurst, setShowBurst] = useState(false);
  const prevAllDiscovered = useRef(false);

  // Phase 6 — entrance + shared parallax state (mouse OR gyroscope).
  // Motion values write straight to styles — pointer/orientation events cause
  // zero React re-renders. Per-layer springs replicate the easing the old CSS
  // transitions applied (bg 0.3s / glow 0.45s / product 0.15s, all ease-out).
  const [entered, setEntered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const parallaxX = useMotionValue(0);
  const parallaxY = useMotionValue(0);

  const bgX = useSpring(parallaxX, { stiffness: 170, damping: 26, mass: 1 });
  const bgY = useSpring(parallaxY, { stiffness: 170, damping: 26, mass: 1 });
  const glowX = useSpring(parallaxX, { stiffness: 90, damping: 20, mass: 1 });
  const glowY = useSpring(parallaxY, { stiffness: 90, damping: 20, mass: 1 });
  const prodX = useSpring(parallaxX, { stiffness: 380, damping: 36, mass: 1 });
  const prodY = useSpring(parallaxY, { stiffness: 380, damping: 36, mass: 1 });

  // Background counter-drifts against the cursor.
  const bgTranslateX = useTransform(bgX, (v) => v * -6);
  const bgTranslateY = useTransform(bgY, (v) => v * -4);

  // Cursor-reactive ambient glow position.
  const glowBackground = useTransform(
    [glowX, glowY],
    (latest: number[]) =>
      `radial-gradient(ellipse 62% 52% at ${50 + (latest[0] ?? 0) * 10}% ${50 + (latest[1] ?? 0) * 7}%, rgba(104,91,199,0.09), transparent)`,
  );

  // Product parallax is disabled once all hotspots are discovered (the
  // completion spin/rise/breathe layer then animates from a neutral origin).
  // A motion-value factor keeps that gating out of the render path.
  const prodFactor = useMotionValue(1);
  const prodTranslateX = useTransform(
    [prodX, prodFactor],
    (latest: number[]) => (latest[0] ?? 0) * 14 * (latest[1] ?? 0),
  );
  const prodTranslateY = useTransform(
    [prodY, prodFactor],
    (latest: number[]) => (latest[0] ?? 0) * 9 * (latest[1] ?? 0),
  );

  // Phase 7 — keyboard navigation (roving tabindex)
  // Arrow keys move REAL DOM focus between hotspot buttons: only the active
  // hotspot is tabbable, screen readers follow focus, and the visible ring is
  // the button's own focus-visible style. Enter/Space activate natively.
  const [focusedHotspotIndex, setFocusedHotspotIndex] = useState<number | null>(null);
  const hotspotRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Ref bundle for event handlers to avoid stale closures
  const stateRef = useRef({ activePanel, focusedHotspotIndex, hotspots });
  useEffect(() => {
    stateRef.current = { activePanel, focusedHotspotIndex, hotspots };
  });

  const discoveredCount = visited.size;
  const total = hotspots.length;
  const allDiscovered = total > 0 && discoveredCount >= total;
  const shouldAnimateCompletion = allDiscovered && enableCompletionAnimation;

  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset = circumference * (1 - (total > 0 ? discoveredCount / total : 0));

  useEffect(() => {
    prodFactor.set(allDiscovered ? 0 : 1);
  }, [allDiscovered, prodFactor]);

  // ── Mount ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 60);
    return () => clearTimeout(t);
  }, []);

  // ── Completion burst ───────────────────────────────────────────────────────

  useEffect(() => {
    if (shouldAnimateCompletion && !prevAllDiscovered.current) {
      setShowBurst(true);
      const t = setTimeout(() => setShowBurst(false), 1800);
      prevAllDiscovered.current = true;
      return () => clearTimeout(t);
    }
    if (!shouldAnimateCompletion) prevAllDiscovered.current = false;
  }, [shouldAnimateCompletion]);

  // ── Phase 7: Keyboard navigation ──────────────────────────────────────────

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Never intercept while focus is inside a text field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const { activePanel: ap, focusedHotspotIndex: fi, hotspots: hs } = stateRef.current;

      if (e.key === 'Escape') {
        setActivePanel(null);
        return;
      }

      // Hotspot cycling — only when panel is closed. Moves real DOM focus so
      // assistive tech follows; Enter/Space then activate the button natively.
      if (!ap && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        if (hs.length === 0) return;
        e.preventDefault();
        const dir = e.key === 'ArrowRight' ? 1 : -1;
        const base = fi ?? (dir === 1 ? -1 : hs.length);
        const next = (base + dir + hs.length) % hs.length;
        setFocusedHotspotIndex(next);
        hotspotRefs.current[next]?.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []); // runs once — stateRef provides live values

  // ── Phase 7: Device-orientation (gyroscope) parallax ──────────────────────

  useEffect(() => {
    if (typeof window === 'undefined' || !window.DeviceOrientationEvent) return;

    function onOrientation(e: DeviceOrientationEvent) {
      // gamma: left/right tilt (–90…90°) → –1…1
      // beta:  front/back tilt (–180…180°), normalized around 30° reading angle
      const rawX = Math.max(-1, Math.min(1, (e.gamma ?? 0) / 45));
      const rawY = Math.max(-1, Math.min(1, ((e.beta ?? 30) - 30) / 45));

      // Low-pass filter for smooth, floating motion — straight into the motion
      // values; the layer springs handle the rest.
      parallaxX.set(parallaxX.get() * 0.82 + rawX * 0.18);
      parallaxY.set(parallaxY.get() * 0.82 + rawY * 0.18);
    }

    window.addEventListener('deviceorientation', onOrientation, true);
    return () => window.removeEventListener('deviceorientation', onOrientation, true);
  }, [parallaxX, parallaxY]);

  // ── Mouse handlers (desktop) — motion-value writes, no re-renders ─────────

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    parallaxX.set(((e.clientX - rect.left) / rect.width - 0.5) * 2);
    parallaxY.set(((e.clientY - rect.top) / rect.height - 0.5) * 2);
  }

  function handleMouseLeave() {
    parallaxX.set(0);
    parallaxY.set(0);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* ── Back button ── */}
      {onPrev && (
        <button
          onClick={onPrev}
          className="bg-background/60 border-border/20 text-foreground/70 hover:text-foreground hover:bg-background/80 focus-visible:ring-accent absolute top-4 left-4 z-30 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium backdrop-blur-sm transition-all focus-visible:ring-2 focus-visible:outline-none"
          aria-label="Go to previous lesson"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back
        </button>
      )}

      {/* ── Background — fades in, counter-drifts ── */}
      {stageBackground ? (
        <motion.div
          className="stage-enter-bg absolute inset-0"
          style={{ x: bgTranslateX, y: bgTranslateY, scale: 1.05 }}
        >
          <Image
            src={stageBackground}
            alt=""
            fill
            priority
            sizes="100vw"
            loader={sanityImageLoader}
            className="object-cover"
          />
        </motion.div>
      ) : (
        <div className="bg-background stage-enter-bg absolute inset-0" />
      )}

      {/* ── Cursor-reactive ambient glow ── */}
      <motion.div
        className="pointer-events-none absolute inset-0"
        style={{ background: glowBackground }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_40%_40%_at_50%_82%,rgba(15,23,42,0.65),transparent)]" />

      {/* ── Product image — 3-layer: entrance / parallax / breathe+spin ── */}
      {productImage && (
        <div
          className={`stage-enter-product absolute top-0 bottom-0 left-0 flex items-center justify-center transition-[right,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${shouldAnimateCompletion && completionTransition === 'fade' ? 'opacity-80' : ''} `}
          style={{ right: '0%' }}
        >
          {/* Parallax layer */}
          <motion.div
            className="flex h-full items-center justify-center"
            style={{ x: prodTranslateX, y: prodTranslateY }}
          >
            {/* Breathe / spin layer */}
            <div
              className={
                shouldAnimateCompletion && completionTransition === 'spin'
                  ? 'stage-spin-anim'
                  : shouldAnimateCompletion && completionTransition === 'rise'
                    ? 'stage-rise-anim'
                    : 'stage-product-breathe'
              }
            >
              <Image
                src={productImage}
                alt={headline}
                width={1200}
                height={1200}
                className="h-[78vh] max-h-full w-auto object-contain drop-shadow-[0_24px_64px_rgba(0,0,0,0.75)]"
              />
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Hotspots — staggered entrance, keyboard-focus ring ── */}
      {hotspots.map((h, i) => (
        <div
          key={h._key}
          className="absolute"
          style={{
            left: `${h.x}%`,
            top: `${h.y}%`,
            opacity: entered ? 1 : 0,
            transform: entered ? 'scale(1)' : 'scale(0.2)',
            transition: `opacity 0.4s ease-out ${240 + i * 110}ms, transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) ${240 + i * 110}ms`,
          }}
        >
          <Hotspot
            ref={(el) => {
              hotspotRefs.current[i] = el;
            }}
            x={0}
            y={0}
            label={h.label}
            visited={visited.has(h.label)}
            variant="pulse"
            onVisit={() => onVisit(h.label)}
            onOpen={() =>
              setActivePanel({
                label: h.label,
                topic: h.topic ?? '',
                body: h.body,
                photos: h.photos,
                videoFile: h.videoFile,
                videoAspectRatio: h.videoAspectRatio,
                x: h.x,
                y: h.y,
              })
            }
            // Roving tabindex — exactly one hotspot is in the tab order.
            tabIndex={i === (focusedHotspotIndex ?? 0) ? 0 : -1}
            onFocus={() => setFocusedHotspotIndex(i)}
          />
        </div>
      ))}

      {/* ── Progress arc — top right ── */}
      <div className="stage-enter-top absolute top-3 right-3 z-20 flex items-center gap-1.5">
        <span
          className={`text-[10px] font-medium tabular-nums transition-colors duration-500 select-none ${allDiscovered ? 'text-accent/80' : 'text-foreground/40'}`}
        >
          {discoveredCount} / {total}
        </span>
        <div className="relative">
          <svg
            width="38"
            height="38"
            viewBox="0 0 44 44"
            className="-rotate-90"
            aria-label={`${discoveredCount} of ${total} discovered`}
          >
            <circle
              cx="22"
              cy="22"
              r={radius}
              fill="none"
              stroke="rgba(233,234,242,0.08)"
              strokeWidth="2.5"
            />
            <circle
              cx="22"
              cy="22"
              r={radius}
              fill="none"
              stroke="rgb(104,91,199)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeOffset}
              className="transition-all duration-500 ease-out"
              style={
                allDiscovered ? { filter: 'drop-shadow(0 0 4px rgb(104 91 199 / 0.6))' } : undefined
              }
            />
          </svg>
          {allDiscovered && (
            <div className="stage-check-pop absolute inset-0 flex items-center justify-center">
              <Check className="text-accent h-3.5 w-3.5 stroke-3" />
            </div>
          )}
        </div>
      </div>

      {/* ── Keyboard hint — bottom left of arc ── */}
      {!activePanel && hotspots.length > 1 && (
        <div
          className="stage-enter-top pointer-events-none absolute top-13 right-3 z-20"
          style={{ animationDelay: '200ms' }}
        >
          <p className="text-foreground/20 text-right text-[8px] tracking-wide select-none">
            ← → to explore
          </p>
        </div>
      )}

      {/* ── Lesson label — bottom left ── */}
      <div
        className="stage-enter-bottom pointer-events-none absolute bottom-16 left-5 z-20"
        style={{ animationDelay: '380ms' }}
      >
        <p className="text-foreground/25 mb-0.5 text-[8px] font-semibold tracking-[0.15em] uppercase">
          Discover
        </p>
        <h2 className="text-foreground/70 max-w-[40%] text-xs leading-tight font-medium">
          {headline}
        </h2>
      </div>

      {/* ── Continue ── */}
      {allDiscovered && (
        <div className="stage-rise absolute right-4 bottom-8 z-20 flex flex-col items-end gap-2">
          <div className="completion-badge bg-accent/15 border-accent/35 flex items-center gap-1.5 rounded-full border px-3 py-1.5">
            <CheckCircle2 className="text-accent h-3.5 w-3.5 shrink-0" />
            <span className="text-foreground text-xs font-semibold tracking-wide whitespace-nowrap">
              All {total} features discovered
            </span>
          </div>
          <button
            onClick={onNext}
            className="completion-button-glow bg-background text-foreground shadow-moto-black/40 hover:bg-background/90 flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold shadow-2xl transition-transform duration-150 active:scale-95"
          >
            Continue
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Discover hint ── */}
      {discoveredCount === 0 && total > 0 && (
        <div
          className="stage-enter-bottom pointer-events-none absolute bottom-10 left-1/2 z-20 -translate-x-1/2"
          style={{ animationDelay: '700ms' }}
        >
          <span className="text-foreground/30 text-[10px] font-medium tracking-wide">
            Tap a hotspot to explore
          </span>
        </div>
      )}

      {/* ── Completion burst ── */}
      <CompletionBurst active={showBurst} />

      <DiscoveryPanel
        open={activePanel !== null}
        onClose={() => setActivePanel(null)}
        label={activePanel?.label ?? ''}
        topic={activePanel?.topic}
        body={activePanel?.body}
        photos={activePanel?.photos ?? []}
        videoFile={activePanel?.videoFile}
        videoAspectRatio={activePanel?.videoAspectRatio}
        x={activePanel?.x}
        y={activePanel?.y}
        mode="popover"
        courseId={courseId}
      />
    </div>
  );
}
