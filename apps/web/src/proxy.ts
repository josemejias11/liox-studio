import { NextRequest, NextResponse } from 'next/server';
import { verifySignedSessionToken } from '@/server/auth/session-token';

// Next.js 16 renamed middleware to "proxy" and it always runs on the Node.js
// runtime — node:crypto (createHmac/timingSafeEqual) is available here without
// an explicit runtime opt-in (which this Next.js version rejects as a build error).

export function proxy(req: NextRequest): NextResponse {
  const secret = process.env.AUTH_SESSION_SECRET;
  const token = req.cookies.get('analytics_token')?.value;
  if (!secret || !verifySignedSessionToken(token, 'analytics', secret)) {
    const loginUrl = new URL('/analytics/login', req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/analytics', '/analytics/((?!login).*)'],
};
