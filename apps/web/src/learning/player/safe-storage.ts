// Thin wrapper around window.localStorage that never throws.
//
// apps/web's own Course Studio preview/review surfaces always run first-party
// and over https, so localStorage is always available there. The same
// CoursePlayer component also runs standalone inside an exported SCORM .zip,
// which a real LMS may embed as a third-party iframe (localStorage access
// throws SecurityError when third-party storage is blocked) and/or serve
// over plain http:// on an internal network. Mirrors the existing try/catch
// pattern in useLessonProgress.ts.
export function safeLocalStorageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeLocalStorageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Browser storage unavailable (third-party iframe, private mode, etc.) — no-op.
  }
}
