import type { NextConfig } from 'next';

// ─── Security header helpers ────────────────────────────────────────────────

const isDev = process.env.NODE_ENV !== 'production';

// Shared directives that apply to both the main app and the Studio path.
const SHARED_IMG_SRC = [
  "'self'",
  'data:',
  'blob:',
  'https://cdn.sanity.io',
  'https://github.com',
  'https://avatars.githubusercontent.com',
].join(' ');

/**
 * Strict CSP for the main application.
 *
 * script-src includes 'unsafe-inline' because Next.js 16 injects inline script
 * tags for hydration bootstrapping and chunk loading. A nonce-based approach is
 * possible via Middleware but requires runtime header injection on every request;
 * the tradeoff is deferred until a dedicated nonce-middleware pass.
 *
 * font-src is 'self' only — next/font/google self-hosts Geist at build time
 * (downloaded to /_next/static/), so no fonts.gstatic.com entry is needed.
 */
const MAIN_CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src ${SHARED_IMG_SRC}`,
  "media-src 'self' https://cdn.sanity.io",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
]
  .join('; ')
  .trim();

/**
 * Relaxed CSP for Sanity Studio (/studio/*).
 *
 * - 'unsafe-eval' is required by Sanity's React runtime and styled-components
 *   when running in the browser (used for dynamic expression evaluation).
 * - worker-src blob: is required by Sanity's web workers (e.g. content-lake sync).
 * - connect-src is broadened to Sanity's API and CDN endpoints.
 * - frame-ancestors 'self' allows Studio to embed preview iframes on the same origin.
 */
const STUDIO_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  `img-src ${SHARED_IMG_SRC}`,
  "font-src 'self' https://fonts.gstatic.com",
  "connect-src 'self' https://api.sanity.io https://*.api.sanity.io wss://*.api.sanity.io https://cdn.sanity.io https://accounts.sanity.io https://registry.npmjs.org",
  "worker-src 'self' blob:",
  "frame-src 'self' https://accounts.sanity.io",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
]
  .join('; ')
  .trim();

// Headers applied to every response (both paths share these).
const COMMON_HEADERS = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
];

// ─── Next.js config ──────────────────────────────────────────────────────────

const nextConfig: NextConfig = {
  // Enable the SWC styled-components transform so Turbopack can handle the
  // CSS-in-JS runtime that Sanity Studio (and the project itself) relies on.
  // Without this, Turbopack falls back to the Babel plugin path which conflicts
  // with its HMR chunk graph, producing ChunkLoadError for the hmr-client chunks.
  compiler: {
    styledComponents: true,
  },
  images: {
    loaderFile: './src/lib/sanity-image-loader.ts',
    remotePatterns: [
      // Sanity CDN for course images
      { protocol: 'https', hostname: 'cdn.sanity.io' },
    ],
  },

  async headers() {
    return [
      // ── Sanity Studio — relaxed policy (must come first; more-specific match) ──
      {
        source: '/studio(.*)',
        headers: [
          ...COMMON_HEADERS,
          { key: 'Content-Security-Policy', value: STUDIO_CSP },
          // Override X-Frame-Options to allow Studio's own preview iframes.
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
      // ── Main application — strict policy (excludes /studio/* and internal Next.js assets to prevent overwrite/HMR breaking) ──
      {
        source: '/((?!studio|_next/static|_next/image|favicon.ico).*)',
        headers: [
          ...COMMON_HEADERS,
          { key: 'Content-Security-Policy', value: MAIN_CSP },
        ],
      },
    ];
  },
};

export default nextConfig;
