import type { ReactNode } from "react";

// Scopes bg-moto-black to the immersive player route so the body's
// bg-background (Frost) never bleeds through any uncovered pixel.
export default function ModuleLayout({ children }: { children: ReactNode }) {
  return <div className="bg-moto-black min-h-dvh">{children}</div>;
}
