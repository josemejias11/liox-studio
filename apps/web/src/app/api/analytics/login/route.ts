import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import {
  isAnalyticsPasswordValid,
  issueAnalyticsSessionToken,
} from '@/analytics/server/analytics-auth';
import { checkRateLimit } from '@/server/auth/rate-limit';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const clientIp = (req.headers.get('x-forwarded-for') ?? 'unknown').slice(0, 64);
  if (!checkRateLimit(`analytics-login:${clientIp}`, 10, 60_000)) {
    return NextResponse.redirect(new URL('/analytics/login?error=1', req.url), { status: 303 });
  }

  const formData = await req.formData();
  const submitted = formData.get('password');
  if (!isAnalyticsPasswordValid(submitted)) {
    const loginUrl = new URL('/analytics/login?error=1', req.url);
    return NextResponse.redirect(loginUrl, { status: 303 });
  }
  const token = issueAnalyticsSessionToken();
  if (!token) {
    return NextResponse.redirect(new URL('/analytics/login?error=config', req.url), {
      status: 303,
    });
  }
  const cookieStore = await cookies();
  cookieStore.set('analytics_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8,
  });

  return NextResponse.redirect(new URL('/analytics', req.url), { status: 303 });
}
