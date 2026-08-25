// Single-process, in-memory fixed-window limiter. Right-sized for this app's current
// single-instance local/dev deployment; swap for a distributed limiter (e.g. Upstash)
// if this ever runs as more than one process.
const windows = new Map<string, { count: number; resetAt: number }>();

// Caller-controlled keys (e.g. a spoofed x-forwarded-for per request) could otherwise
// grow this map without bound. Opportunistically sweep expired entries once the map
// gets large rather than running a separate timer.
const SWEEP_THRESHOLD = 10_000;

function sweepExpired(now: number): void {
  for (const [key, entry] of windows) {
    if (entry.resetAt < now) windows.delete(key);
  }
}

export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  if (windows.size > SWEEP_THRESHOLD) sweepExpired(now);

  const existing = windows.get(key);
  if (!existing || now >= existing.resetAt) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (existing.count >= limit) return false;
  existing.count += 1;
  return true;
}
