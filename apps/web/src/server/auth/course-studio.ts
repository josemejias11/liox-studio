import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { createSignedSessionToken, verifySignedSessionToken } from './session-token';

export const COURSE_STUDIO_COOKIE = 'course_studio_token';
const PURPOSE = 'course-studio';

export function verifyCourseStudioPassword(password: string): boolean {
  const expected = process.env.COURSE_STUDIO_PASSWORD;
  return !!expected && password === expected;
}

export function issueCourseStudioSessionToken(): string | null {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret) {
    console.error('AUTH_SESSION_SECRET is not set — sessions cannot be issued.');
    return null;
  }
  if (!process.env.COURSE_STUDIO_PASSWORD) return null;
  return createSignedSessionToken(PURPOSE, secret);
}

function verifyToken(token: string | undefined): boolean {
  const secret = process.env.AUTH_SESSION_SECRET;
  return !!secret && verifySignedSessionToken(token, PURPOSE, secret);
}

export async function isCourseStudioAuthorized(request: NextRequest): Promise<boolean> {
  return verifyToken(request.cookies.get(COURSE_STUDIO_COOKIE)?.value);
}

export async function isCourseStudioSessionValid(): Promise<boolean> {
  const store = await cookies();
  return verifyToken(store.get(COURSE_STUDIO_COOKIE)?.value);
}
