const ASSET_URL_PATTERN = /^\/api\/course-assets\/(courses\/[^/]+\/[^/?#]+)$/;

export function collectAssetRefs(payload: unknown): string[] {
  const found = new Set<string>();

  function walk(value: unknown): void {
    if (typeof value === 'string') {
      const match = value.match(ASSET_URL_PATTERN);
      if (match) found.add(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    if (value && typeof value === 'object') {
      for (const item of Object.values(value as Record<string, unknown>)) walk(item);
    }
  }

  walk(payload);
  return [...found];
}

/**
 * r2KeyFor extracts the storage object key ("courses/<id>/<uuid>-<filename>")
 * from one of the URLs collectAssetRefs found, for fetching from storage.
 */
export function r2KeyFor(assetUrl: string): string | null {
  const match = assetUrl.match(ASSET_URL_PATTERN);
  return match ? decodeURIComponent(match[1]) : null;
}

export function rewriteAssetUrls(payload: unknown, urlMap: Map<string, string>): unknown {
  if (typeof payload === 'string') return urlMap.get(payload) ?? payload;
  if (Array.isArray(payload)) return payload.map((item) => rewriteAssetUrls(item, urlMap));
  if (payload && typeof payload === 'object') {
    return Object.fromEntries(
      Object.entries(payload as Record<string, unknown>).map(([key, value]) => [
        key,
        rewriteAssetUrls(value, urlMap),
      ]),
    );
  }
  return payload;
}
