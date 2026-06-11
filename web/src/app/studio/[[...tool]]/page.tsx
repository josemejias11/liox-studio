'use client';

// Import from the explicit client-component subpath instead of "next-sanity/studio".
// "next-sanity/studio" is a Server Component entry — it calls preloadModule() at
// render time, which is a React 19 RSC-only API. When that import runs inside a
// "use client" boundary, Turbopack's HMR graph cannot reconcile the resulting async
// module chunk, producing the ChunkLoadError for hmr-client chunks.
//
// "next-sanity/studio/client-component" exposes the same NextStudio wrapped in a
// Suspense + lazy() boundary that is safe to use as a client component, and avoids
// any RSC-only API calls at module evaluation time.
import { NextStudio } from 'next-sanity/studio/client-component';
import config from '../../../../sanity.config';

export default function StudioPage() {
  return <NextStudio config={config} />;
}
