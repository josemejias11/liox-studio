export { collectAssetRefs, r2KeyFor } from '@moto-ai/storage';

export function rewriteAssetUrls(payload: unknown, urlMap: Map<string, string>): unknown {
  function walk(value: unknown): unknown {
    if (typeof value === 'string') {
      return urlMap.get(value) ?? value;
    }
    if (Array.isArray(value)) {
      return value.map(walk);
    }
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, walk(item)]),
      );
    }
    return value;
  }

  return walk(payload);
}
