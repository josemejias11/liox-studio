"use client";

interface HotspotProps {
  // Position within the lesson as percentages (0–100)
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
  icon?: React.ReactNode;
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
  icon,
}: HotspotProps) {
  function handleClick() {
    if (!visited) onVisit?.();
    onOpen();
  }

  const safeLabel = label;

  return (
    <button
      onClick={handleClick}
      style={{ left: `${x}%`, top: `${y}%` }}
      className="absolute -translate-x-1/2 -translate-y-1/2 z-10 group focus:outline-none"
      aria-label={`Learn about ${safeLabel}`}
    >
      {/* Pulse rings — continuous waves */}
      {!visited && (
        <>
          <span
            className={`absolute inset-[-16px] rounded-full animate-[ping_2.5s_ease-out_infinite] opacity-50 shadow-[0_0_25px_rgba(255,255,255,0.7)] ${
              pulseClassName || "bg-white"
            }`}
          />
          <span
            className={`absolute inset-[-6px] rounded-full animate-[ping_2.5s_ease-out_infinite_1s] opacity-80 shadow-[0_0_20px_rgba(255,255,255,0.9)] ${
              pulseClassName || "bg-white"
            }`}
          />
        </>
      )}

      {/* The physical dot */}
      <span
        className={`relative flex items-center justify-center rounded-full transition-all duration-300 transform group-hover:scale-110
          ${
            className
              ? className
              : `h-11 w-11 border-[3px] border-white/90 backdrop-blur-md shadow-[0_0_20px_rgba(255,255,255,0.6),inset_0_0_12px_rgba(255,255,255,0.6)] ${
                  visited ? "bg-black/40 text-white/60" : "bg-white/20 text-white"
                }`
          }
        `}
      >
        {icon || <div className={`h-4 w-4 rounded-full ${visited ? "bg-white/40" : "bg-white shadow-[0_0_15px_rgba(255,255,255,1)]"}`} />}
      </span>

      {/* Label tooltip — shows on hover above the dot */}
      <span
        className={`absolute left-1/2 -translate-x-1/2 bottom-full mb-3 max-w-[250px] md:max-w-[320px] w-max text-center
          rounded-xl px-4 py-2.5 text-sm md:text-base font-semibold leading-snug
          opacity-0 group-hover:opacity-100 transition-opacity duration-150
          pointer-events-none shadow-xl
          ${labelClassName || "bg-background/90 backdrop-blur-sm text-foreground border border-border/10"}`}
      >
        {safeLabel}
        {/* Arrow */}
        <span className="absolute left-1/2 -translate-x-1/2 top-full border-4 border-transparent border-t-moto-black/90" />
      </span>
    </button>
  );
}
