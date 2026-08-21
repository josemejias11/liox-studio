interface ScormLmsApi {
  LMSInitialize(param: string): string;
  LMSFinish(param: string): string;
  LMSGetValue(name: string): string;
  LMSSetValue(name: string, value: string): string;
  LMSCommit(param: string): string;
  LMSGetLastError(): string;
}

declare global {
  interface Window {
    API?: ScormLmsApi;
  }
}

const MAX_WINDOW_HOPS = 500;

function searchWindowChain(start: Window): ScormLmsApi | null {
  let current: Window = start;
  for (let hops = 0; hops < MAX_WINDOW_HOPS; hops += 1) {
    try {
      if (current.API) return current.API;
      if (current.parent && current.parent !== current) {
        current = current.parent;
        continue;
      }
    } catch {
      return null;
    }
    break;
  }
  return null;
}

function findApi(win: Window): ScormLmsApi | null {
  const fromSelf = searchWindowChain(win);
  if (fromSelf) return fromSelf;
  try {
    const opener = win.opener as Window | null | undefined;
    if (opener && !opener.closed) return searchWindowChain(opener);
  } catch {
    return null;
  }
  return null;
}

function formatSessionTime(totalSeconds: number): string {
  const clamped = Math.max(0, Math.round(totalSeconds));
  const hours = String(Math.floor(clamped / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((clamped % 3600) / 60)).padStart(2, '0');
  const seconds = String(clamped % 60).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

export class ScormBridge {
  private api: ScormLmsApi | null = null;
  private initialized = false;
  private sessionStartMs = 0;

  connect(): boolean {
    if (typeof window === 'undefined') return false;
    this.api = findApi(window);
    if (!this.api) return false;
    const result = this.api.LMSInitialize('');
    this.initialized = result === 'true' || result === '1';
    if (this.initialized) this.sessionStartMs = Date.now();
    return this.initialized;
  }

  get isConnected(): boolean {
    return this.initialized;
  }

  getBookmark(): string {
    if (!this.initialized || !this.api) return '';
    return this.api.LMSGetValue('cmi.core.lesson_location');
  }

  setBookmark(lessonKey: string): void {
    if (!this.initialized || !this.api) return;
    this.api.LMSSetValue('cmi.core.lesson_location', lessonKey.slice(0, 255));
    this.api.LMSCommit('');
  }

  getSuspendData(): string {
    if (!this.initialized || !this.api) return '';
    return this.api.LMSGetValue('cmi.suspend_data');
  }

  setSuspendData(data: string): void {
    if (!this.initialized || !this.api) return;
    this.api.LMSSetValue('cmi.suspend_data', data.slice(0, 4096));
  }

  reportInProgress(): void {
    if (!this.initialized || !this.api) return;
    const current = this.api.LMSGetValue('cmi.core.lesson_status');
    if (current === '' || current === 'not attempted') {
      this.api.LMSSetValue('cmi.core.lesson_status', 'incomplete');
      this.api.LMSCommit('');
    }
  }

  reportQuizResult(result: { score: number; total: number; passed: boolean }): void {
    if (!this.initialized || !this.api) return;
    const raw = result.total > 0 ? Math.round((result.score / result.total) * 100) : 0;
    this.api.LMSSetValue('cmi.core.score.raw', String(raw));
    this.api.LMSSetValue('cmi.core.score.min', '0');
    this.api.LMSSetValue('cmi.core.score.max', '100');
    this.api.LMSSetValue('cmi.core.lesson_status', result.passed ? 'passed' : 'failed');
    this.api.LMSCommit('');
  }

  reportComplete(): void {
    if (!this.initialized || !this.api) return;
    const current = this.api.LMSGetValue('cmi.core.lesson_status');
    if (current !== 'passed' && current !== 'failed') {
      this.api.LMSSetValue('cmi.core.lesson_status', 'completed');
      this.api.LMSCommit('');
    }
  }

  finish(): void {
    if (!this.initialized || !this.api) return;
    const sessionSeconds = (Date.now() - this.sessionStartMs) / 1000;
    this.api.LMSSetValue('cmi.core.session_time', formatSessionTime(sessionSeconds));
    this.api.LMSSetValue('cmi.core.exit', 'suspend');
    this.api.LMSCommit('');
    this.api.LMSFinish('');
    this.initialized = false;
  }
}
