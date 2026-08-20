export async function fetchJson<T>(
  url: string,
  init: RequestInit,
  fallbackMessage: string,
): Promise<T> {
  const response = await fetch(url, init);
  const result = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(result.error || fallbackMessage);
  return result;
}
