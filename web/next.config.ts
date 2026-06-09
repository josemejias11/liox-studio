import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable the SWC styled-components transform so Turbopack can handle the
  // CSS-in-JS runtime that Sanity Studio (and the project itself) relies on.
  // Without this, Turbopack falls back to the Babel plugin path which conflicts
  // with its HMR chunk graph, producing ChunkLoadError for the hmr-client chunks.
  compiler: {
    styledComponents: true,
  },
  images: {
    remotePatterns: [
      // Sanity CDN for course images
      { protocol: "https", hostname: "cdn.sanity.io" },
    ],
  },
};

export default nextConfig;
