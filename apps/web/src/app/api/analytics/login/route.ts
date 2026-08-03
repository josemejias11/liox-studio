/**
 * POST /analytics/login
 *
 * Validates the submitted password against ANALYTICS_PASSWORD.
 * On success: sets an httpOnly `analytics_token` cookie and redirects to /analytics.
 * On failure: redirects back to /analytics/login with an error query param.
 */

import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { analyticsCookieValue, isAnalyticsPasswordValid } from '@/analytics/server/analytics-auth';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const formData = await req.formData();
  const submitted = formData.get('password');
  // Fail closed: if the env var is not configured, deny access.
  if (!isAnalyticsPasswordValid(submitted)) {
    const loginUrl = new URL('/analytics/login?error=1', req.url);
    return NextResponse.redirect(loginUrl, { status: 303 });
  }

  // Set the auth cookie then redirect to the dashboard.
  const cookieStore = await cookies();
  cookieStore.set('analytics_token', analyticsCookieValue()!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  return NextResponse.redirect(new URL('/analytics', req.url), { status: 303 });
}
