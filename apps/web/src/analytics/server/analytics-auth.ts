import type { NextRequest } from 'next/server';

export function isAnalyticsPasswordValid(submitted: FormDataEntryValue | null): boolean {
  const expected = process.env.ANALYTICS_PASSWORD;
  return !!expected && typeof submitted === 'string' && submitted === expected;
}

export function analyticsCookieValue(): string | null {
  return process.env.ANALYTICS_PASSWORD ?? null;
}

export function isAnalyticsAuthorized(request: NextRequest): boolean {
  const expected = process.env.ANALYTICS_PASSWORD;
  const token = request.cookies.get('analytics_token')?.value;
  return !!expected && token === expected;
}
