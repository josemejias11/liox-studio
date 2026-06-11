import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Map a semantic width token (from Sanity textOverlay/graphic fields) to a max-width class. */
export function getSemanticWidthClass(width?: string): string {
  switch (width) {
    case 'small':
      return 'max-w-sm';
    case 'medium':
      return 'max-w-md';
    case 'large':
      return 'max-w-lg';
    case 'full':
      return 'max-w-full';
    default:
      return width || 'max-w-xl';
  }
}

/** Derive a human-readable caption from an uploaded asset filename. */
export function titleFromFilename(filename?: string): string {
  if (!filename) return '';
  const name = filename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Map a Sanity aspect-ratio token ("16:9", "1:1", …) to a CSS aspect-ratio value. */
const CSS_ASPECT_RATIOS: Record<string, string> = {
  '16:9': '16 / 9',
  '1:1': '1 / 1',
  '4:5': '4 / 5',
  '9:16': '9 / 16',
};

export function cssAspectRatio(ratio?: string): string {
  return (ratio && CSS_ASPECT_RATIOS[ratio]) || '16 / 9';
}
