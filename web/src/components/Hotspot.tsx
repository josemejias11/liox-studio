"use client";

interface HotspotProps {
  // Position within the slide as percentages (0–100)
  x: number;
  y: number;
  label: string;
  visited?: boolean;
  onOpen: () => void;
  onVisit?: () => void;

  // ── Design knobs ──────────────────────────────────────────────────────────
  // Override the dot itself (size, bg, border, shadow…)
  className?: string;
  // Override the animated pulse ring (color, opacity, size…)
  pulseClassName?: string;
  // Override the label tooltip bubble
  labelClassName?: string;
}

export function Hotspot({
  x,
  y,
  label,
  visited = false,
  onOpen,
  onVisit,
  className = "",
  pulseClassName = "",
  labelClassName = "",
}: HotspotProps) {
  function handleClick() {
    if (!visited) onVisit?.();
    onOpen();
  }

  return (
    <button
      onClick={handleClick}
      style={{ left: `${x}%`, top: `${y}%` }}
      className="absolute -translate-x-1/2 -translate-y-1/2 z-10 group focus:outline-none"
      aria-label={`Learn about ${label}`}
    >
      {/* Pulse ring — swap pulseClassName to change color/speed/size */}
      {!visited && (
        <span
          className={`absolute inset-[-4px] rounded-full animate-ping opacity-50 ${
            pulseClassName || "bg-primary"
          }`}
        />
      )}

      {/* Core dot — swap className to change size, color, shape */}
      <span
        className={`relative flex h-4 w-4 rounded-full border-2 border-white shadow-lg shadow-black/40
          transition-transform duration-150 group-hover:scale-125 group-focus-visible:scale-125
          ${visited ? "bg-emerald-400 border-emerald-200" : "bg-primary"}
          ${className}`}
      />

      {/* Label tooltip — shows on hover above the dot */}
      <span
        className={`absolute left-1/2 -translate-x-1/2 bottom-full mb-2.5 whitespace-nowrap
          rounded-md px-2.5 py-1 text-[11px] font-semibold
          opacity-0 group-hover:opacity-100 transition-opacity duration-150
          pointer-events-none shadow-xl
          ${labelClassName || "bg-zinc-900/90 backdrop-blur-sm text-white border border-white/10"}`}
      >
        {label}
        {/* Arrow */}
        <span className="absolute left-1/2 -translate-x-1/2 top-full border-4 border-transparent border-t-zinc-900/90" />
      </span>
    </button>
  );
}
