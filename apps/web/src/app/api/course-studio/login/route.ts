import { NextRequest, NextResponse } from 'next/server';
import {
  COURSE_STUDIO_COOKIE,
  issueCourseStudioSessionToken,
  verifyCourseStudioPassword,
} from '@/server/auth/course-studio';
import { checkRateLimit } from '@/server/auth/rate-limit';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const clientIp = (request.headers.get('x-forwarded-for') ?? 'unknown').slice(0, 64);
  if (!checkRateLimit(`course-studio-login:${clientIp}`, 10, 60_000)) {
    return NextResponse.redirect(new URL('/studio/login?error=1', request.url), { status: 303 });
  }

  const formData = await request.formData();
  const submitted = formData.get('password');

  if (typeof submitted !== 'string' || !verifyCourseStudioPassword(submitted)) {
    return NextResponse.redirect(new URL('/studio/login?error=1', request.url), { status: 303 });
  }

  const token = issueCourseStudioSessionToken();
  if (!token) {
    return NextResponse.redirect(new URL('/studio/login?error=config', request.url), {
      status: 303,
    });
  }

  const response = NextResponse.redirect(new URL('/studio', request.url), { status: 303 });
  response.cookies.set(COURSE_STUDIO_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8,
  });
  return response;
}
