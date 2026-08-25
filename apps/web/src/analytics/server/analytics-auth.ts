import { createSignedSessionToken, verifySignedSessionToken } from '@/server/auth/session-token';
import type { NextRequest } from 'next/server';

const PURPOSE = 'analytics';

export function isAnalyticsPasswordValid(submitted: FormDataEntryValue | null): boolean {
  const expected = process.env.ANALYTICS_PASSWORD;
  return !!expected && typeof submitted === 'string' && submitted === expected;
}

export function issueAnalyticsSessionToken(): string | null {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret) {
    console.error('AUTH_SESSION_SECRET is not set — sessions cannot be issued.');
    return null;
  }
  if (!process.env.ANALYTICS_PASSWORD) return null;
  return createSignedSessionToken(PURPOSE, secret);
}

function verifyToken(token: string | undefined): boolean {
  const secret = process.env.AUTH_SESSION_SECRET;
  return !!secret && verifySignedSessionToken(token, PURPOSE, secret);
}

export function isAnalyticsAuthorized(request: NextRequest): boolean {
  return verifyToken(request.cookies.get('analytics_token')?.value);
}

export async function isAnalyticsSessionValid(): Promise<boolean> {
  const { cookies } = await import('next/headers');
  const store = await cookies();
  return verifyToken(store.get('analytics_token')?.value);
}
