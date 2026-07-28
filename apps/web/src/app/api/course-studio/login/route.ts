import { NextRequest, NextResponse } from 'next/server';
import { COURSE_STUDIO_COOKIE, courseStudioToken } from '@/lib/course-studio-auth';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const formData = await request.formData();
  const submitted = formData.get('password');
  const expectedPassword = process.env.COURSE_STUDIO_PASSWORD;

  if (!expectedPassword || typeof submitted !== 'string' || submitted !== expectedPassword) {
    return NextResponse.redirect(new URL('/studio/login?error=1', request.url), { status: 303 });
  }

  const token = await courseStudioToken();
  if (!token) {
    return NextResponse.redirect(new URL('/studio/login?error=1', request.url), { status: 303 });
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
