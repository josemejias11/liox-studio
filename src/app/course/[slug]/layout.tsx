import type { ReactNode } from 'react';

// Scopes bg-background to the immersive player route so the body's
// bg-background (Frost) never bleeds through any uncovered pixel.
export default function CourseLayout({ children }: { children: ReactNode }) {
  return <div className="bg-background min-h-dvh">{children}</div>;
}
