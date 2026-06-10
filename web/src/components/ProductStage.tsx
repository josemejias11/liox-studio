"use client";

import React, { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Check, CheckCircle2 } from "lucide-react";
import { PulseHotspot } from "./PulseHotspot";
import { DiscoveryPanel } from "./DiscoveryPanel";
import { CompletionBurst } from "./CompletionBurst";
import { optimizeSanityImage } from "@/lib/image-optimization";

interface StageHotspot {
  _key: string;
  label: string;
  topic: string;
  body?: string;
  photos?: { asset?: { url?: string } }[];
  x: number;
  y: number;
  contentMode?: "tooltip" | "layer";
  suggestions?: string[];
}

interface ProductStageProps {
  headline: string;
  productImage?: string;
  stageBackground?: string;
  enableCompletionAnimation?: boolean;
  completionTransition?: "spin" | "rise" | "fade";
  hotspots: StageHotspot[];
  visited: Set<string>;
  onVisit: (label: string) => void;
  onNext: () => void;
  onOpenLayer?: (id: string) => void;
  onPrev?: () => void;
  course_title?: string;
  course_description?: string;
}

export function ProductStage({
  headline,
  productImage,
  stageBackground,
  enableCompletionAnimation = false,
  completionTransition = "spin",
  hotspots,
  visited,
  onVisit,
  onNext,
  onOpenLayer,
  onPrev,
  course_title,
  course_description,
}: ProductStageProps) {
  const [activePanel, setActivePanel] = useState<{
    label: string;
    topic: string;
    body?: string;
    photos?: { asset?: { url?: string } }[];
    x?: number;
    y?: number;
    suggestions?: string[];
  } | null>(null);

  // Phase 4 — completion burst
  const [showBurst, setShowBurst] = useState(false);
  const prevAllDiscovered = useRef(false);

  // Phase 6 — entrance + shared parallax state (mouse OR gyroscope)
  const [entered, setEntered] = useState(false);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Phase 7 — keyboard navigation
  const [focusedHotspotIndex, setFocusedHotspotIndex] = useState<number | null>(null);

  // Ref bundle for event handlers to avoid stale closures
  const stateRef = useRef({ activePanel, focusedHotspotIndex, hotspots, visited, onVisit, onOpenLayer });
  useEffect(() => {
    stateRef.current = { activePanel, focusedHotspotIndex, hotspots, visited, onVisit, onOpenLayer };
  });

  const discoveredCount = visited.size;
  const total = hotspots.length;
  const allDiscovered = total > 0 && discoveredCount >= total;
  const shouldAnimateCompletion = allDiscovered && enableCompletionAnimation;

  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset = circumference * (1 - (total > 0 ? discoveredCount / total : 0));

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

      const { activePanel: ap, focusedHotspotIndex: fi, hotspots: hs, visited: vs, onVisit: ov, onOpenLayer: ool } =
        stateRef.current;

      if (e.key === "Escape") {
        setActivePanel(null);
        setFocusedHotspotIndex(null);
        return;
      }

      // Hotspot cycling — only when panel is closed
      if (!ap) {
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          if (hs.length === 0) return;
          e.preventDefault();
          const dir = e.key === "ArrowRight" ? 1 : -1;
          const base = fi ?? (dir === 1 ? -1 : hs.length);
          setFocusedHotspotIndex(((base + dir) + hs.length) % hs.length);
        }

        if ((e.key === "Enter" || e.key === " ") && fi !== null) {
          e.preventDefault();
          const h = hs[fi];
          if (!h) return;
          if (!vs.has(h.label)) ov(h.label);
          if (h.contentMode === "layer") {
            ool?.(h._key);
          } else {
            setActivePanel({ label: h.label, topic: h.topic, body: h.body, photos: h.photos, x: h.x, y: h.y, suggestions: h.suggestions });
          }
        }
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []); // runs once — stateRef provides live values

  // Clear keyboard focus when panel opens (so re-focus cycles cleanly on close)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (activePanel) setFocusedHotspotIndex(null);
  }, [activePanel]);

  // ── Phase 7: Device-orientation (gyroscope) parallax ──────────────────────

  useEffect(() => {
    if (typeof window === "undefined" || !window.DeviceOrientationEvent) return;

    let smoothX = 0;
    let smoothY = 0;

    function onOrientation(e: DeviceOrientationEvent) {
      // gamma: left/right tilt (–90…90°) → –1…1
      // beta:  front/back tilt (–180…180°), normalized around 30° reading angle
      const rawX = Math.max(-1, Math.min(1, (e.gamma ?? 0) / 45));
      const rawY = Math.max(-1, Math.min(1, ((e.beta ?? 30) - 30) / 45));

      // Low-pass filter for smooth, floating motion
      smoothX = smoothX * 0.82 + rawX * 0.18;
      smoothY = smoothY * 0.82 + rawY * 0.18;

      setParallax({ x: smoothX, y: smoothY });
    }

    window.addEventListener("deviceorientation", onOrientation, true);
    return () => window.removeEventListener("deviceorientation", onOrientation, true);
  }, []);

  // ── Mouse handlers (desktop) ───────────────────────────────────────────────

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setParallax({
      x: ((e.clientX - rect.left)  / rect.width  - 0.5) * 2,
      y: ((e.clientY - rect.top)   / rect.height - 0.5) * 2,
    });
  }

  function handleMouseLeave() {
    setParallax({ x: 0, y: 0 });
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
          className="absolute top-4 left-4 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-background/60 backdrop-blur-sm border border-border/20 text-foreground/70 text-xs font-medium hover:text-foreground hover:bg-background/80 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label="Go to previous lesson"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back
        </button>
      )}

      {/* ── Background — fades in, counter-drifts ── */}
      {stageBackground ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={optimizeSanityImage(stageBackground, 1920)}
          alt=""
          className="absolute inset-0 w-full h-full object-cover stage-enter-bg"
          style={{
            transform: `translate(${parallax.x * -6}px, ${parallax.y * -4}px) scale(1.05)`,
            transition: "transform 0.3s ease-out",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-background stage-enter-bg" />
      )}

      {/* ── Cursor-reactive ambient glow ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 62% 52% at ${50 + parallax.x * 10}% ${50 + parallax.y * 7}%, rgba(104,91,199,0.09), transparent)`,
          transition: "background 0.45s ease-out",
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_40%_at_50%_82%,rgba(15,23,42,0.65),transparent)] pointer-events-none" />

      {/* ── Product image — 3-layer: entrance / parallax / breathe+spin ── */}
      {productImage && (
        <div
          className={`absolute top-0 left-0 bottom-0 flex items-center justify-center stage-enter-product
            transition-[right,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
            ${shouldAnimateCompletion && completionTransition === "fade" ? "opacity-80" : ""}
          `}
          style={{ right: "0%" }}
        >
          {/* Parallax layer */}
          <div
            className="h-full flex items-center justify-center"
            style={
              !allDiscovered
                ? {
                    transform: `translate(${parallax.x * 14}px, ${parallax.y * 9}px)`,
                    transition: "transform 0.15s ease-out",
                  }
                : undefined
            }
          >
            {/* Breathe / spin layer */}
            <div
              className={
                shouldAnimateCompletion && completionTransition === "spin"
                  ? "stage-spin-anim"
                  : shouldAnimateCompletion && completionTransition === "rise"
                  ? "stage-rise-anim"
                  : "stage-product-breathe"
              }
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={optimizeSanityImage(productImage, 1200)}
                alt={headline}
                className="h-[78vh] max-h-full w-auto object-contain drop-shadow-[0_24px_64px_rgba(0,0,0,0.75)]"
              />
            </div>
          </div>
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
            transform: entered ? "scale(1)" : "scale(0.2)",
            transition: `opacity 0.4s ease-out ${240 + i * 110}ms, transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) ${240 + i * 110}ms`,
          }}
        >
          <PulseHotspot
            x={0}
            y={0}
            label={h.label}
            visited={visited.has(h.label)}
            onVisit={() => onVisit(h.label)}
            onOpen={() =>
              setActivePanel({ label: h.label, topic: h.topic, body: h.body, photos: h.photos, x: h.x, y: h.y, suggestions: h.suggestions })
            }
            keyFocused={focusedHotspotIndex === i}
          />
        </div>
      ))}

      {/* ── Progress arc — top right ── */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 z-20 stage-enter-top">
        <span
          className={`text-[10px] font-medium tabular-nums select-none transition-colors duration-500
            ${allDiscovered ? "text-accent/80" : "text-foreground/40"}`}
        >
          {discoveredCount} / {total}
        </span>
        <div className="relative">
          <svg
            width="38" height="38" viewBox="0 0 44 44"
            className="-rotate-90"
            aria-label={`${discoveredCount} of ${total} discovered`}
          >
            <circle cx="22" cy="22" r={radius} fill="none" stroke="rgba(233,234,242,0.08)" strokeWidth="2.5" />
            <circle
              cx="22" cy="22" r={radius}
              fill="none"
              stroke="rgb(104,91,199)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeOffset}
              className="transition-all duration-500 ease-out"
              style={allDiscovered ? { filter: "drop-shadow(0 0 4px rgb(104 91 199 / 0.6))" } : undefined}
            />
          </svg>
          {allDiscovered && (
            <div className="absolute inset-0 flex items-center justify-center stage-check-pop">
              <Check className="h-3.5 w-3.5 text-accent stroke-3" />
            </div>
          )}
        </div>
      </div>

      {/* ── Keyboard hint — bottom left of arc ── */}
      {!activePanel && hotspots.length > 1 && (
        <div className="absolute top-13 right-3 z-20 pointer-events-none stage-enter-top" style={{ animationDelay: "200ms" }}>
          <p className="text-foreground/20 text-[8px] text-right tracking-wide select-none">
            ← → to explore
          </p>
        </div>
      )}

      {/* ── Lesson label — bottom left ── */}
      <div
        className="absolute bottom-16 left-5 z-20 pointer-events-none stage-enter-bottom"
        style={{ animationDelay: "380ms" }}
      >
        <p className="text-foreground/25 text-[8px] font-semibold uppercase tracking-[0.15em] mb-0.5">
          Discover
        </p>
        <h2 className="text-foreground/70 text-xs font-medium leading-tight max-w-[40%]">
          {headline}
        </h2>
      </div>

      {/* ── Continue ── */}
      {allDiscovered && (
        <div className="absolute bottom-8 right-4 z-20 stage-rise flex flex-col items-end gap-2">
          <div className="completion-badge flex items-center gap-1.5 bg-accent/15 border border-accent/35 rounded-full px-3 py-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-accent shrink-0" />
            <span className="text-foreground text-xs font-semibold tracking-wide whitespace-nowrap">
              All {total} features discovered
            </span>
          </div>
          <button
            onClick={onNext}
            className="completion-button-glow flex items-center gap-2 bg-background text-foreground text-sm font-bold
              px-6 py-3 rounded-full shadow-2xl shadow-moto-black/40
              hover:bg-background/90 active:scale-95 transition-transform duration-150"
          >
            Continue
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Discover hint ── */}
      {discoveredCount === 0 && total > 0 && (
        <div
          className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 pointer-events-none stage-enter-bottom"
          style={{ animationDelay: "700ms" }}
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
        label={activePanel?.label ?? ""}
        topic={activePanel?.topic}
        body={activePanel?.body}
        photos={activePanel?.photos ?? []}
        x={activePanel?.x}
        y={activePanel?.y}
        mode="popover"
        course_title={course_title}
        course_description={course_description}
        suggestions={activePanel?.suggestions}
      />
    </div>
  );
}
