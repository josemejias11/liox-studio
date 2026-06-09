"use client";

import React, { useState } from "react";
import { Check } from "lucide-react";

export interface HotspotProps {
  x: number;
  y: number;
  label: string;
  visited?: boolean;
  onOpen: () => void;
  onVisit?: () => void;
  
  // ── Design knobs ──────────────────────────────────────────────────────────
  variant?: "moto-indigo-black" | "white-black";
  className?: string;
  pulseClassName?: string;
  labelClassName?: string;
  icon?: React.ReactNode;
}

export function Hotspot({
  x,
  y,
  label,
  visited = false,
  onOpen,
  onVisit,
  variant = "white-black",
  className = "",
  pulseClassName = "",
  labelClassName = "",
  icon,
}: HotspotProps) {
  const [bursting, setBursting] = useState(false);
  const [justVisited, setJustVisited] = useState(false);

  function handleClick() {
    if (!visited) {
      setBursting(true);
      setJustVisited(true);
      onVisit?.();
      setTimeout(() => setBursting(false), 600);
      setTimeout(() => setJustVisited(false), 350);
    }
    onOpen();
  }

  const safeLabel = label;
  const isIndigo = variant === "moto-indigo-black";

  const ringColor = isIndigo ? "border-moto-indigo/55" : "border-white/55";
  const unvisitedClass = isIndigo 
    ? "bg-moto-indigo shadow-moto-indigo/50 hover:bg-moto-indigo/90" 
    : "bg-white shadow-white/50 hover:bg-white/90";
  const visitedClass = isIndigo 
    ? "bg-moto-indigo shadow-moto-indigo/60" 
    : "bg-white shadow-white/60";
  const checkColor = "text-moto-black";

  return (
    <button
      onClick={handleClick}
      style={{ left: `${x}%`, top: `${y}%` }}
      className={`absolute -translate-x-1/2 -translate-y-1/2 z-10 group focus:outline-none ${className}`}
      aria-label={`Learn about ${safeLabel}`}
    >
      {/* Wave rings — continuous waves */}
      {!visited && (
        <>
          <span className={`stage-ring stage-ring-1 ${pulseClassName || ringColor}`} />
          <span className={`stage-ring stage-ring-2 ${pulseClassName || ringColor}`} />
          <span className={`stage-ring stage-ring-3 ${pulseClassName || ringColor}`} />
        </>
      )}

      {/* Burst ring — one-shot on click */}
      {bursting && <span className={`stage-burst ${pulseClassName || ringColor}`} />}

      {/* The physical dot */}
      <span
        className={`relative flex items-center justify-center rounded-full transition-all duration-300 transform group-hover:scale-125
          h-5 w-5 border-2 border-transparent
          ${visited ? visitedClass : unvisitedClass}
        `}
      >
        {visited ? (
          icon || <Check className={`h-2.5 w-2.5 stroke-[3px] ${checkColor} ${justVisited ? "stage-check-pop" : ""}`} />
        ) : (
          icon
        )}
      </span>

      {/* Label tooltip — shows on hover above the dot */}
      <span
        className={`absolute left-1/2 -translate-x-1/2 bottom-full mb-3 max-w-[250px] w-max text-center
          rounded-lg px-3 py-1.5 text-[11px] font-semibold tracking-wide
          opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0
          transition-all duration-200 ease-out
          pointer-events-none shadow-2xl
          ${labelClassName || "bg-background/90 backdrop-blur-sm text-foreground border border-border/20"}`}
      >
        {safeLabel}
        {/* Arrow */}
        <span className="absolute left-1/2 -translate-x-1/2 top-full border-[5px] border-transparent border-t-background/90" />
      </span>
    </button>
  );
}
