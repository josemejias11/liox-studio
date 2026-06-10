import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Map a semantic width token (from Sanity textOverlay/graphic fields) to a max-width class. */
export function getSemanticWidthClass(width?: string): string {
  switch (width) {
    case "small": return "max-w-sm";
    case "medium": return "max-w-md";
    case "large": return "max-w-lg";
    case "full": return "max-w-full";
    default: return width || "max-w-xl";
  }
}
