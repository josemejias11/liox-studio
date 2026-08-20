import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { analyticsCookieValue, isAnalyticsPasswordValid } from '@/analytics/server/analytics-auth';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const formData = await req.formData();
  const submitted = formData.get('password');
  if (!isAnalyticsPasswordValid(submitted)) {
    const loginUrl = new URL('/analytics/login?error=1', req.url);
    return NextResponse.redirect(loginUrl, { status: 303 });
  }
  const cookieStore = await cookies();
  cookieStore.set('analytics_token', analyticsCookieValue()!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  return NextResponse.redirect(new URL('/analytics', req.url), { status: 303 });
}
