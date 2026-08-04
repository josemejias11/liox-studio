

import { NextRequest, NextResponse } from 'next/server';

export function proxy(req: NextRequest): NextResponse {
  const token = req.cookies.get('analytics_token')?.value;
  const expected = process.env.ANALYTICS_PASSWORD;
  if (!expected || token !== expected) {
    const loginUrl = new URL('/analytics/login', req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [

    '/analytics',
    '/analytics/((?!login).*)',
  ],
};
