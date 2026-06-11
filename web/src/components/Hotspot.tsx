'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';

// ── Variants ──────────────────────────────────────────────────────────────────
// Single hotspot implementation; the former PulseHotspot is the "pulse" variant.

export type HotspotVariant = 'moto-indigo-black' | 'white-black' | 'pulse';

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
    dotVisited: 'border-transparent bg-white shadow-white/60',
    dotUnvisited: 'border-transparent bg-white shadow-white/50 hover:bg-white/90',
    check: 'text-moto-black',
    tooltip:
      'max-w-62.5 w-max text-center bg-background/90 backdrop-blur-sm text-foreground border border-border/20',
    arrow: 'border-t-background/90',
    visitedHalo: false,
  },
  'moto-indigo-black': {
    ariaPrefix: 'Learn about',
    ring: 'border-moto-indigo/55',
    dotVisited: 'border-transparent bg-moto-indigo shadow-moto-indigo/60',
    dotUnvisited: 'border-transparent bg-moto-indigo shadow-moto-indigo/50 hover:bg-moto-indigo/90',
    check: 'text-moto-black',
    tooltip:
      'max-w-62.5 w-max text-center bg-background/90 backdrop-blur-sm text-foreground border border-border/20',
    arrow: 'border-t-background/90',
    visitedHalo: false,
  },
  pulse: {
    ariaPrefix: 'Discover',
    ring: '',
    dotVisited: 'border-border/90 shadow-lg bg-accent shadow-moto-indigo/60',
    dotUnvisited: 'border-border/90 shadow-lg bg-accent shadow-moto-indigo/50 group-hover:bg-muted',
    check: 'text-foreground',
    tooltip:
      'whitespace-nowrap bg-background/10 backdrop-blur-md text-foreground border border-border/20',
    arrow: 'border-t-moto-frost/15',
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

  return (
    <button
      ref={ref}
      tabIndex={tabIndex}
      onFocus={onFocus}
      onClick={handleClick}
      style={{ left: `${x}%`, top: `${y}%` }}
      className={`group focus-visible:ring-accent absolute z-10 -translate-x-1/2 -translate-y-1/2 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none ${className}`}
      aria-label={`${styles.ariaPrefix} ${label}`}
    >
      {/* Wave rings — 3 staggered continuous waves, hidden once visited */}
      {!visited && (
        <>
          <span className={`stage-ring stage-ring-1 ${ringClass}`} />
          <span className={`stage-ring stage-ring-2 ${ringClass}`} />
          <span className={`stage-ring stage-ring-3 ${ringClass}`} />
        </>
      )}

      {/* Burst ring — one-shot on click */}
      {bursting && <span className={`stage-burst ${ringClass}`} />}

      {/* Visited glow halo */}
      {styles.visitedHalo && visited && (
        <span className="bg-accent/20 pointer-events-none absolute -inset-1.5 rounded-full blur-sm" />
      )}

      {/* The physical dot */}
      <span
        className={`relative flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all duration-300 group-hover:scale-125 ${visited ? styles.dotVisited : styles.dotUnvisited} `}
      >
        {visited
          ? icon || (
              <Check
                className={`h-2.5 w-2.5 stroke-3 ${styles.check} ${justVisited ? 'stage-check-pop' : ''}`}
              />
            )
          : icon}
      </span>

      {/* Label tooltip — shows on hover AND keyboard focus above the dot */}
      <span
        className={`pointer-events-none absolute bottom-full left-1/2 mb-3 -translate-x-1/2 translate-y-2 rounded-lg px-3 py-1.5 text-sm font-semibold tracking-wide opacity-0 shadow-2xl transition-all duration-200 ease-out group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100 ${labelClassName || styles.tooltip}`}
      >
        {label}
        {/* Arrow */}
        <span
          className={`absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent ${styles.arrow}`}
        />
      </span>
    </button>
  );
}
