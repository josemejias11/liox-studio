"use client";

import { useState } from "react";
import { Check } from "lucide-react";

interface PulseHotspotProps {
  x: number;
  y: number;
  label: string;
  visited: boolean;
  onVisit: () => void;
  onOpen: () => void;
  keyFocused?: boolean;
}

export function PulseHotspot({ x, y, label, visited, onVisit, onOpen, keyFocused = false }: PulseHotspotProps) {
  const [bursting, setBursting] = useState(false);
  const [justVisited, setJustVisited] = useState(false);

  function handleClick() {
    if (!visited) {
      setBursting(true);
      setJustVisited(true);
      onVisit();
      setTimeout(() => setBursting(false), 600);
      setTimeout(() => setJustVisited(false), 350);
    }
    onOpen();
  }

  return (
    <button
      onClick={handleClick}
      style={{ left: `${x}%`, top: `${y}%` }}
      className="absolute -translate-x-1/2 -translate-y-1/2 z-10 group focus:outline-none"
      aria-label={`Discover ${label}`}
    >
      {/* Wave rings — 3 staggered rings, hidden once visited */}
      {!visited && (
        <>
          <span className="stage-ring stage-ring-1" />
          <span className="stage-ring stage-ring-2" />
          <span className="stage-ring stage-ring-3" />
        </>
      )}

      {/* Burst ring — one-shot on click */}
      {bursting && <span className="stage-burst" />}

      {/* Visited glow halo */}
      {visited && (
        <span className="absolute inset-[-6px] rounded-full bg-accent/20 blur-sm pointer-events-none" />
      )}

      {/* Keyboard focus ring */}
      {keyFocused && (
        <span className="absolute inset-[-12px] rounded-full border-2 border-border/70 animate-pulse pointer-events-none" />
      )}

      {/* Core dot */}
      <span
        className={`relative flex h-5 w-5 items-center justify-center rounded-full border-2 border-border/90 shadow-lg
          transition-all duration-300 group-hover:scale-125
          ${visited
            ? "bg-accent shadow-moto-indigo/60"
            : "bg-accent shadow-moto-indigo/50 group-hover:bg-muted"
          }`}
      >
        {visited && (
          <Check
            className={`h-2.5 w-2.5 text-foreground stroke-[3] ${justVisited ? "stage-check-pop" : ""}`}
          />
        )}
      </span>

      {/* Label tooltip — floats above on hover with micro-animation */}
      <span
        className="absolute left-1/2 -translate-x-1/2 bottom-full mb-3 whitespace-nowrap
          rounded-lg px-3 py-1.5 text-[11px] font-semibold tracking-wide
          opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0
          transition-all duration-200 ease-out
          pointer-events-none shadow-2xl
          bg-background/10 backdrop-blur-md text-foreground border border-border/20"
      >
        {label}
        <span className="absolute left-1/2 -translate-x-1/2 top-full border-[5px] border-transparent border-t-moto-frost/15" />
      </span>
    </button>
  );
}
