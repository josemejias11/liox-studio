'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';

// ── Variants ──────────────────────────────────────────────────────────────────
// Single hotspot implementation; the former PulseHotspot is the "pulse" variant.

export type HotspotVariant = 'moto-indigo-black' | 'white-black' | 'pulse';
export type HotspotPresentation = 'classic' | 'callout' | 'reticle';

interface VariantStyles {
  ariaPrefix: string;
  /** Default ring color class; "" lets .stage-ring fall back to currentColor. */
  ring: string;
  dotVisited: string;
  dotUnvisited: string;
  check: string;
  tooltip: string;
  arrow: string;
  /** Glow halo behind the dot once visited (pulse only). */
  visitedHalo: boolean;
}

const VARIANT_STYLES: Record<HotspotVariant, VariantStyles> = {
  'white-black': {
    ariaPrefix: 'Learn about',
    ring: 'border-white/55',
    dotVisited: 'glass-panel border-white/40 shadow-lg text-white bg-white/20',
    dotUnvisited: 'glass-panel border-white/60 shadow-[0_0_15px_rgba(255,255,255,0.4)] bg-white/40',
    check: 'text-white',
    tooltip: 'glass-panel max-w-62.5 w-max text-center text-foreground',
    arrow: 'hidden',
    visitedHalo: false,
  },
  'moto-indigo-black': {
    ariaPrefix: 'Learn about',
    ring: 'border-moto-indigo/55',
    dotVisited: 'glass-panel border-moto-indigo/40 shadow-lg text-moto-indigo bg-moto-indigo/20',
    dotUnvisited:
      'glass-panel border-moto-indigo/60 shadow-[0_0_15px_rgba(104,91,199,0.4)] bg-moto-indigo/40',
    check: 'text-moto-indigo',
    tooltip: 'glass-panel max-w-62.5 w-max text-center text-foreground',
    arrow: 'hidden',
    visitedHalo: false,
  },
  pulse: {
    ariaPrefix: 'Discover',
    ring: '',
    dotVisited: 'glass-panel border-accent/40 shadow-lg bg-accent/20',
    dotUnvisited:
      'glass-panel border-accent/60 shadow-[0_0_20px_rgba(104,91,199,0.6)] bg-accent/40',
    check: 'text-foreground',
    tooltip: 'glass-panel whitespace-nowrap text-foreground',
    arrow: 'hidden',
    visitedHalo: true,
  },
};

// ── Props ─────────────────────────────────────────────────────────────────────

export interface HotspotProps {
  x: number;
  y: number;
  label: string;
  visited?: boolean;
  onOpen: () => void;
  onVisit?: () => void;

  // ── Design knobs ──────────────────────────────────────────────────────────
  variant?: HotspotVariant;
  presentation?: HotspotPresentation;
  calloutSide?: 'left' | 'right';
  className?: string;
  pulseClassName?: string;
  labelClassName?: string;
  icon?: React.ReactNode;

  // ── Roving-tabindex support (ProductStage keyboard navigation) ────────────
  /** React 19 ref-as-prop — lets a parent move real DOM focus to this hotspot. */
  ref?: React.Ref<HTMLButtonElement>;
  tabIndex?: number;
  onFocus?: React.FocusEventHandler<HTMLButtonElement>;
}

export function Hotspot({
  x,
  y,
  label,
  visited = false,
  onOpen,
  onVisit,
  variant = 'white-black',
  presentation = 'classic',
  calloutSide = 'right',
  className = '',
  pulseClassName = '',
  labelClassName = '',
  icon,
  ref,
  tabIndex,
  onFocus,
}: HotspotProps) {
  const [bursting, setBursting] = useState(false);
  const [justVisited, setJustVisited] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  // Clean up pending burst/check timeouts on unmount.
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    const timeouts = timeoutsRef.current;
    return () => timeouts.forEach(clearTimeout);
  }, []);

  function handleClick() {
    if (!visited) {
      setBursting(true);
      setJustVisited(true);
      onVisit?.();
      timeoutsRef.current.push(
        setTimeout(() => setBursting(false), 600),
        setTimeout(() => setJustVisited(false), 350),
      );
    }
    onOpen();
  }

  const styles = VARIANT_STYLES[variant];
  const ringClass = pulseClassName || styles.ring;
  const isCallout = presentation === 'callout';
  const isReticle = presentation === 'reticle';
  const compactTooltipClass = presentation === 'classic' ? '' : 'md:hidden';

  return (
    <motion.button
      ref={ref}
      tabIndex={tabIndex}
      onFocus={onFocus}
      onClick={handleClick}
      style={{ left: `${x}%`, top: `${y}%` }}
      className={`group focus-visible:ring-accent absolute z-10 flex min-h-11 min-w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none ${className}`}
      aria-label={`${styles.ariaPrefix} ${label}`}
      whileHover={shouldReduceMotion ? undefined : { scale: 1.1 }}
      whileTap={shouldReduceMotion ? undefined : { scale: 0.9 }}
      transition={
        shouldReduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 400, damping: 25 }
      }
    >
      {/* Wave rings — 2 staggered continuous waves, hidden once visited */}
      {!visited && (
        <>
          <span
            className={`stage-ring stage-ring-1 motion-reduce:animate-none motion-reduce:transition-none ${ringClass}`}
          />
          <span
            className={`stage-ring stage-ring-2 motion-reduce:animate-none motion-reduce:transition-none ${ringClass}`}
          />
        </>
      )}

      {/* Burst ring — one-shot on click */}
      {bursting && <span className={`stage-burst ${ringClass}`} />}

      {/* Visited glow halo */}
      {styles.visitedHalo && visited && (
        <motion.span
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={shouldReduceMotion ? { duration: 0 } : undefined}
          className="bg-accent/20 pointer-events-none absolute -inset-1.5 rounded-full blur-sm"
        />
      )}

      {/* The physical dot */}
      <motion.span
        layout={!shouldReduceMotion}
        className={`relative flex h-6 w-6 items-center justify-center rounded-full transition-colors duration-300 ${visited ? styles.dotVisited : styles.dotUnvisited} `}
      >
        {visited
          ? icon || (
              <Check
                className={`h-3 w-3 stroke-3 ${styles.check} ${justVisited ? 'stage-check-pop' : ''}`}
              />
            )
          : icon}
      </motion.span>

      {/* Persistent Stage callout for desktop presentations. */}
      {isCallout && (
        <span
          className={`pointer-events-none absolute top-1/2 hidden -translate-y-1/2 items-center motion-reduce:animate-none motion-reduce:transition-none md:flex ${
            calloutSide === 'left' ? 'right-1/2 flex-row-reverse' : 'left-1/2'
          }`}
        >
          <span
            className={`h-px w-14 ${
              calloutSide === 'left' ? 'bg-linear-to-l' : 'bg-linear-to-r'
            } from-[#bcb4ff] to-[#685bc7]/35`}
          />
          <span className="rounded-xl border border-white/15 bg-[#111225]/88 px-3 py-2 text-xs font-semibold whitespace-nowrap text-white shadow-xl backdrop-blur-xl">
            {label}
          </span>
        </span>
      )}

      {/* Canvas reticle around the shared physical dot. */}
      {isReticle && (
        <span className="pointer-events-none absolute h-16 w-16 rounded-full border border-[#9eb0ff]/75 shadow-[0_0_0_10px_rgba(158,176,255,0.08)] motion-reduce:animate-none motion-reduce:transition-none">
          <span className="absolute top-1/2 left-[-14px] h-px w-[90px] -translate-y-1/2 bg-[#9eb0ff]/65" />
          <span className="absolute top-[-14px] left-1/2 h-[90px] w-px -translate-x-1/2 bg-[#9eb0ff]/65" />
        </span>
      )}

      {/* Label tooltip — shows on hover AND keyboard focus above the dot */}
      <span
        className={`pointer-events-none absolute bottom-full left-1/2 mb-3 -translate-x-1/2 translate-y-2 rounded-xl px-4 py-2 text-sm font-semibold tracking-wide opacity-0 transition-all duration-300 ease-out group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100 ${compactTooltipClass} ${labelClassName || styles.tooltip}`}
      >
        {label}
        {/* Arrow */}
        <span
          className={`absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent ${styles.arrow}`}
        />
      </span>
    </motion.button>
  );
}
