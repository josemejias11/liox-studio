'use client';

import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import Image from 'next/image';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { Check, CheckCircle2 } from 'lucide-react';
import { Hotspot } from './Hotspot';
import { DiscoveryPanel } from '@/components/DiscoveryPanel';
import { CompletionBurst } from '../CompletionBurst';
import { PortableText } from '@portabletext/react';
import { supMark } from '@/shared/portable-text-components';
import type { RichText, CourseHotspot, CoursePhoto } from '@/shared/contracts/player-course';
import { InlineDiscoveryCueMark, InlineDiscoveryCueProvider, type InlineDiscoveryCueResolver } from './InlineDiscoveryCue';

interface ProductStageProps {
  headline: string;
  body?: RichText;
  productImage?: string;
  stageBackground?: string;
  enableCompletionAnimation?: boolean;
  completionTransition?: 'spin' | 'rise' | 'fade';
  hotspots: CourseHotspot[];
  visited: Set<string>;
  onVisit: (label: string) => void;
  onNext: () => void;
  onPrev?: () => void;
  courseId: string;
  preview?: boolean;
  imageSizes?: string;
}

const STAGE_PORTABLE_TEXT_COMPONENTS = { marks: { layerLink: InlineDiscoveryCueMark, ...supMark } };

export function ProductStage({
  headline,
  body,
  productImage,
  stageBackground,
  enableCompletionAnimation = false,
  completionTransition = 'spin',
  hotspots,
  visited,
  onVisit,
  courseId,
  preview = false,
  imageSizes = '100vw',
}: ProductStageProps) {
  const [activePanel, setActivePanel] = useState<{
    label: string;
    topic: string;
    body?: RichText;
    photos?: CoursePhoto[];
    videoFile?: { asset?: { url?: string } };
    videoAspectRatio?: string;
    x?: number;
    y?: number;
  } | null>(null);
  const resolveLinkedLayer: InlineDiscoveryCueResolver = (linkedLayer) => {
    const hotspot = hotspots.find((item) => item.label === linkedLayer);
    if (!hotspot) return undefined;
    return {
      label: hotspot.label,
      visited: visited.has(hotspot.label),
      onActivate: () => {
        onVisit(hotspot.label);
        setActivePanel({ label: hotspot.label, topic: hotspot.topic, body: hotspot.body, photos: hotspot.photos, videoFile: hotspot.videoFile, videoAspectRatio: hotspot.videoAspectRatio, x: hotspot.x, y: hotspot.y });
      },
    };
  };

  const [showBurst, setShowBurst] = useState(false);
  const prevAllDiscovered = useRef(false);
  const [entered, setEntered] = useState(false);
  const [imageRect, setImageRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageWrapperRef = useRef<HTMLDivElement>(null);

  const parallaxX = useMotionValue(0);
  const parallaxY = useMotionValue(0);

  const bgX = useSpring(parallaxX, { stiffness: 170, damping: 26, mass: 1 });
  const bgY = useSpring(parallaxY, { stiffness: 170, damping: 26, mass: 1 });
  const glowX = useSpring(parallaxX, { stiffness: 90, damping: 20, mass: 1 });
  const glowY = useSpring(parallaxY, { stiffness: 90, damping: 20, mass: 1 });
  const prodX = useSpring(parallaxX, { stiffness: 380, damping: 36, mass: 1 });
  const prodY = useSpring(parallaxY, { stiffness: 380, damping: 36, mass: 1 });

  const bgTranslateX = useTransform(bgX, (v) => v * -6);
  const bgTranslateY = useTransform(bgY, (v) => v * -4);

  const glowTranslateX = useTransform(glowX, (v) => `${v * 10}%`);
  const glowTranslateY = useTransform(glowY, (v) => `${v * 7}%`);

  const prodFactor = useMotionValue(1);
  const prodTranslateX = useTransform(
    [prodX, prodFactor],
    (latest: number[]) => (latest[0] ?? 0) * 14 * (latest[1] ?? 0),
  );
  const prodTranslateY = useTransform(
    [prodY, prodFactor],
    (latest: number[]) => (latest[0] ?? 0) * 9 * (latest[1] ?? 0),
  );
  const [focusedHotspotIndex, setFocusedHotspotIndex] = useState<number | null>(null);
  const hotspotRefs = useRef<(HTMLButtonElement | null)[]>([]);

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

  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 60);
    return () => clearTimeout(t);
  }, []);

  useLayoutEffect(() => {
    const wrapper = imageWrapperRef.current;
    const container = containerRef.current;
    if (!wrapper || !container) return;

    container.scrollTop = 0;

    function measure() {
      const wRect = wrapper!.getBoundingClientRect();
      const cRect = container!.getBoundingClientRect();
      setImageRect({
        left: wRect.left - cRect.left,
        top: wRect.top - cRect.top,
        width: wRect.width,
        height: wRect.height,
      });
      container!.scrollTop = 0;
    }

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrapper);
    return () => ro.disconnect();
  }, [productImage]);

  useEffect(() => {
    if (shouldAnimateCompletion && !prevAllDiscovered.current) {
      setShowBurst(true);
      const t = setTimeout(() => setShowBurst(false), 1800);
      prevAllDiscovered.current = true;
      return () => clearTimeout(t);
    }
    if (!shouldAnimateCompletion) prevAllDiscovered.current = false;
  }, [shouldAnimateCompletion]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const { activePanel: ap, focusedHotspotIndex: fi, hotspots: hs } = stateRef.current;

      if (e.key === 'Escape') {
        setActivePanel(null);
        return;
      }

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
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.DeviceOrientationEvent) return;

    function onOrientation(e: DeviceOrientationEvent) {
      const rawX = Math.max(-1, Math.min(1, (e.gamma ?? 0) / 45));
      const rawY = Math.max(-1, Math.min(1, ((e.beta ?? 30) - 30) / 45));

      parallaxX.set(parallaxX.get() * 0.82 + rawX * 0.18);
      parallaxY.set(parallaxY.get() * 0.82 + rawY * 0.18);
    }

    window.addEventListener('deviceorientation', onOrientation, true);
    return () => window.removeEventListener('deviceorientation', onOrientation, true);
  }, [parallaxX, parallaxY]);

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

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden bg-[#070812]"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onScroll={(e) => {
        if (e.currentTarget.scrollTop !== 0) e.currentTarget.scrollTop = 0;
      }}
    >

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
            sizes={imageSizes}
            className="object-cover"
          />
        </motion.div>
      ) : (
        <div className="stage-enter-bg absolute inset-0 bg-[radial-gradient(ellipse_70%_65%_at_50%_42%,#1b1d38_0%,#0b0c16_56%,#05060b_100%)]" />
      )}

      <motion.div
        className="pointer-events-none absolute inset-[-50%]"
        style={{
          background: 'radial-gradient(ellipse 62% 52% at center, rgba(104,91,199,0.09), transparent)',
          x: glowTranslateX,
          y: glowTranslateY,
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_40%_40%_at_50%_82%,rgba(15,23,42,0.65),transparent)]" />

      {productImage && (
        <div
          className={`stage-enter-product absolute top-0 bottom-0 left-0 flex items-center justify-center transition-[right,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${shouldAnimateCompletion && completionTransition === 'fade' ? 'opacity-80' : ''} `}
          style={{ right: '0%', willChange: 'transform, opacity, filter' }}
        >
          <motion.div
            className="flex h-full items-center justify-center"
            style={{ x: prodTranslateX, y: prodTranslateY }}
          >
            <div
              ref={imageWrapperRef}
              className={
                shouldAnimateCompletion && completionTransition === 'spin'
                  ? 'stage-spin-anim'
                  : shouldAnimateCompletion && completionTransition === 'rise'
                    ? 'stage-rise-anim'
                    : 'stage-product-breathe'
              }
            >
              {shouldAnimateCompletion && (
                <div
                  aria-hidden="true"
                  className={`pointer-events-none absolute inset-0 rounded-full ${
                    completionTransition === 'spin' ? 'stage-spin-glow' : 'stage-rise-glow'
                  }`}
                  style={{
                    background: 'radial-gradient(ellipse 70% 70% at 50% 50%, rgba(255,255,255,0.6), transparent)',
                  }}
                />
              )}
              <Image
                src={productImage}
                alt={headline}
                width={1200}
                height={1200}
                sizes="(max-width: 768px) 100vw, 80vw"
                className="h-[78vh] max-h-full w-auto object-contain drop-shadow-[0_24px_64px_rgba(0,0,0,0.75)]"
              />
            </div>
          </motion.div>
        </div>
      )}

      {imageRect
        ? hotspots.map((h, i) => (
            <div
              key={h._key}
              className="absolute pointer-events-none"
              style={{
                left: imageRect.left,
                top: imageRect.top,
                width: imageRect.width,
                height: imageRect.height,
                zIndex: 10,
              }}
            >
              <div
                className="absolute"
                style={{
                  left: `${h.x}%`,
                  top: `${h.y}%`,
                  opacity: entered ? 1 : 0,
                  transform: entered ? 'scale(1)' : 'scale(0.2)',
                  transition: `opacity 0.4s ease-out ${240 + i * 110}ms, transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) ${240 + i * 110}ms`,
                  pointerEvents: 'auto',
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
                  presentation="callout"
                  calloutSide={h.x >= 50 ? 'left' : 'right'}
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
                  tabIndex={i === (focusedHotspotIndex ?? 0) ? 0 : -1}
                  onFocus={() => setFocusedHotspotIndex(i)}
                />
              </div>
            </div>
          ))
        : hotspots.map((h, i) => (
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
                presentation="callout"
                calloutSide={h.x >= 50 ? 'left' : 'right'}
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
                tabIndex={i === (focusedHotspotIndex ?? 0) ? 0 : -1}
                onFocus={() => setFocusedHotspotIndex(i)}
              />
            </div>
          ))}

      <div className="stage-enter-top absolute top-3 right-3 z-20 flex flex-col items-end gap-2">
        <div className="flex items-center gap-1.5">
          <span
            className={`text-[10px] font-medium tabular-nums transition-colors duration-500 select-none ${allDiscovered ? 'text-accent/90' : 'text-white/45'}`}
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
              />
            </svg>
            {allDiscovered && (
              <div className="stage-check-pop absolute inset-0 flex items-center justify-center">
                <Check className="text-accent h-3.5 w-3.5 stroke-3" />
              </div>
            )}
          </div>
        </div>

        {allDiscovered && (
          <div className="completion-badge bg-accent/15 border-accent/35 flex items-center gap-1.5 rounded-full border px-3 py-1.5">
            <CheckCircle2 className="text-accent h-3.5 w-3.5 shrink-0" />
            <span className="text-white text-xs font-semibold tracking-wide whitespace-nowrap">
              All {total} features discovered
            </span>
          </div>
        )}
      </div>

      {!activePanel && !allDiscovered && hotspots.length > 1 && (
        <div
          className="stage-enter-top pointer-events-none absolute top-13 right-3 z-20"
          style={{ animationDelay: '200ms' }}
        >
          <p className="text-white/35 text-right text-[8px] tracking-wide select-none">
            ← → to explore
          </p>
        </div>
      )}

      <div
        className="stage-enter-top pointer-events-none absolute top-6 left-6 z-20 max-w-md md:max-w-xl pr-6"
        style={{ animationDelay: '380ms' }}
      >
        <p className="mb-1.5 text-[10px] font-bold tracking-[0.2em] text-[#a9a0ff] uppercase">
          Product exploration
        </p>
        <h2 className="mb-3 text-2xl leading-tight font-bold text-white md:text-3xl">
          {headline}
        </h2>
        {body && (
          <div className="prose prose-sm max-w-none font-light leading-relaxed text-white/70 md:prose-base prose-invert">
            {typeof body === 'string' ? <p>{body}</p> : <InlineDiscoveryCueProvider resolveLinkedLayer={resolveLinkedLayer}><PortableText value={body as import('@portabletext/types').PortableTextBlock[]} components={STAGE_PORTABLE_TEXT_COMPONENTS} /></InlineDiscoveryCueProvider>}
          </div>
        )}
      </div>



      {discoveredCount === 0 && total > 0 && (
        <div
          className="stage-enter-bottom pointer-events-none absolute bottom-10 left-1/2 z-20 -translate-x-1/2"
          style={{ animationDelay: '700ms' }}
        >
          <span className="text-[10px] font-medium tracking-wide text-white/45">
            Explore each highlighted feature
          </span>
        </div>
      )}

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
        preview={preview}
        resolveLinkedLayer={resolveLinkedLayer}
      />
    </div>
  );
}
