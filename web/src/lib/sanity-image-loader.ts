import type { ImageLoader } from 'next/image';

// Custom next/image loader for Sanity CDN assets.
//
// next/image picks the candidate width per breakpoint/`sizes`; we forward it to
// Sanity's image pipeline (`w=` + `fit=max` + `auto=format`) so variants are
// generated and cached on cdn.sanity.io directly — no proxying through
// /_next/image and no double-constraining via a pre-baked `w=` on the src URL.
// Always pass the *raw* asset URL as `src` (never `optimizeSanityImage` output).
export const sanityImageLoader: ImageLoader = ({ src, width, quality }) => {
  if (!src.startsWith('https://cdn.sanity.io/')) return src;
  const url = new URL(src);
  url.searchParams.set('auto', 'format');
  url.searchParams.set('fit', 'max');
  url.searchParams.set('w', String(width));
  url.searchParams.set('q', String(quality ?? 75));
  return url.toString();
};
