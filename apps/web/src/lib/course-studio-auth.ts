import type { NextRequest } from 'next/server';

export const COURSE_STUDIO_COOKIE = 'course_studio_token';

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function courseStudioToken(): Promise<string | null> {
  const password = process.env.COURSE_STUDIO_PASSWORD;
  return password ? sha256(password) : null;
}

export async function isCourseStudioAuthorized(request: NextRequest): Promise<boolean> {
  const expected = await courseStudioToken();
  return !!expected && request.cookies.get(COURSE_STUDIO_COOKIE)?.value === expected;
}
