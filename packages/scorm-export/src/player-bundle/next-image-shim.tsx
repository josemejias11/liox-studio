import type { ImgHTMLAttributes } from 'react';

/**
 * Drop-in replacement for `next/image`, aliased in only for this package's esbuild build
 * (see scripts/build-player.mjs) so the standalone SCORM player bundle never calls Next's
 * `/_next/image?url=...` optimization endpoint — an endpoint that doesn't exist once this
 * ships as a static zip with no Next.js server behind it. apps/web itself keeps using the
 * real `next/image` everywhere else (Course Studio, review, etc.); this alias is scoped to
 * this build only.
 *
 * Verified against every `<Image>` usage reachable from MotoViewer (12 call sites across
 * CourseCover, ContentLesson, ProductStage x2, SplitScreenLesson, CanvasInspectionLesson,
 * ColorSwitcherLesson, ScrollStoryLesson x2, DragDropLesson, PhotoCardStack,
 * CourseQuizPlayer):
 * - Every `fill` usage already pairs with a `className` that sets `object-cover` /
 *   `object-contain` via Tailwind, so this shim only needs to give the `fill` image an
 *   absolutely-positioned, full-size box — no object-fit default to guess at.
 * - Every non-`fill` usage passes plain numeric `width`/`height`, which a native `<img>`
 *   already honors as attributes with no extra logic.
 * - None use `placeholder="blur"` / `blurDataURL`, `onLoad`, `onError`, or `unoptimized` —
 *   so `priority` and `sizes` (Next-specific, no native `<img>` equivalent that matters here)
 *   can be safely dropped as no-ops, and everything else (`className`, `style`, `draggable`,
 *   `loading`, ...) passes straight through to the native element.
 */
interface ShimImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src: string;
  alt: string;
  fill?: boolean;
  priority?: boolean;
  sizes?: string;
}

export default function Image({
  src,
  alt,
  fill,
  priority,
  sizes,
  style,
  className,
  ...rest
}: ShimImageProps) {
  void priority;
  void sizes;
  // This file *is* the next/image replacement for the standalone bundle; there is no
  // Next.js server here to optimize through, so a plain <img> is the correct, deliberate
  // choice, not an oversight.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      style={
        fill ? { position: 'absolute', inset: 0, width: '100%', height: '100%', ...style } : style
      }
      {...rest}
    />
  );
}
