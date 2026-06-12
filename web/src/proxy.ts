/**
 * Next.js Proxy — protects the /analytics instructor dashboard.
 *
 * Guard: checks for an httpOnly cookie `analytics_token` whose value must
 * match the ANALYTICS_PASSWORD environment variable. Any mismatch or absence
 * redirects to /analytics/login.
 *
 * The matcher explicitly excludes /analytics/login to prevent an infinite
 * redirect loop, and also excludes Next.js internal paths (_next/*) and
 * static assets.
 */

import { NextRequest, NextResponse } from 'next/server';

export function proxy(req: NextRequest): NextResponse {
  const token = req.cookies.get('analytics_token')?.value;
  const expected = process.env.ANALYTICS_PASSWORD;

  // If ANALYTICS_PASSWORD is not set in this environment, deny access rather
  // than allowing everyone through — fail closed.
  if (!expected || token !== expected) {
    const loginUrl = new URL('/analytics/login', req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match /analytics and any sub-path EXCEPT /analytics/login.
     * Pattern breakdown:
     *   /analytics         — the dashboard root
     *   /analytics/(?!login).*  — any sub-path that does not start with "login"
     *
     * Next.js internal routes (_next/static, _next/image, favicon.ico) are
     * excluded by the negative lookahead on the leading segment.
     */
    '/analytics',
    '/analytics/((?!login).*)',
  ],
};
