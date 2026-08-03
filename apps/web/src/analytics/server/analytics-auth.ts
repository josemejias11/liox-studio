export function isAnalyticsPasswordValid(submitted: FormDataEntryValue | null): boolean {
  const expected = process.env.ANALYTICS_PASSWORD;
  return !!expected && typeof submitted === 'string' && submitted === expected;
}

export function analyticsCookieValue(): string | null {
  return process.env.ANALYTICS_PASSWORD ?? null;
}
