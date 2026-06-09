export function optimizeSanityImage(url: string | undefined | null, width?: number): string | undefined {
  if (!url) return undefined;
  if (!url.startsWith("https://cdn.sanity.io/")) return url;
  
  const hasParams = url.includes("?");
  const separator = hasParams ? "&" : "?";
  
  let optimizedUrl = `${url}${separator}auto=format&q=75`;
  if (width) {
    optimizedUrl += `&w=${width}&fit=max`;
  }
  
  return optimizedUrl;
}
