import type { NextConfig } from 'next';

// ─── Security header helpers ────────────────────────────────────────────────

const isDev = process.env.NODE_ENV !== 'production';

const SHARED_IMG_SRC = [
  "'self'",
  'data:',
  'blob:',
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
  "media-src 'self'",
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
  transpilePackages: [
    '@moto-ai/contracts',
    '@moto-ai/database',
    '@moto-ai/jobs',
    '@moto-ai/parser-client',
  ],
  async headers() {
    return [
      {
        source: '/((?!_next/static|_next/image|favicon.ico).*)',
        headers: [...COMMON_HEADERS, { key: 'Content-Security-Policy', value: MAIN_CSP }],
      },
    ];
  },
};

export default nextConfig;
