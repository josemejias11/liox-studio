// Re-export the viewport config from next-sanity/studio so Next.js does not
// inject its own viewport <meta> tag, which would conflict with Studio's
// full-screen layout management.
import React from "react";
import type { Metadata } from "next";

export { viewport } from "next-sanity/studio";

export const metadata: Metadata = { title: "Moto Tutor AI — Studio" };

// Studio manages its own viewport and body styles
export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return children;
}

