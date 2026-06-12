/**
 * Rate limiting via Upstash Redis + @upstash/ratelimit.
 *
 * Uses a sliding-window algorithm (60 requests / 60 s per identifier).
 * The identifier is the client IP extracted from the x-forwarded-for header,
 * which Vercel always populates.
 *
 * Graceful degradation: when UPSTASH_REDIS_REST_URL is not configured (e.g.
 * in local development) the check is skipped and a warning is emitted once.
 * This avoids breaking local dev that has no Upstash instance.
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

let ratelimit: Ratelimit | null = null;
let degradationWarned = false;

function getRatelimiter(): Ratelimit | null {
  if (ratelimit) return ratelimit;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    if (!degradationWarned) {
      console.warn(
        '[rate-limit] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN not set — ' +
          'rate limiting is disabled. Set these env vars in production.',
      );
      degradationWarned = true;
    }
    return null;
  }

  const redis = new Redis({ url, token });
  ratelimit = new Ratelimit({
    redis,
    // Sliding window: 60 requests per 60-second window per identifier.
    limiter: Ratelimit.slidingWindow(60, '60 s'),
    analytics: false,
    prefix: 'rl:progress',
  });

  return ratelimit;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
}

/**
 * Check whether `identifier` (typically a client IP) is within the allowed
 * request budget. Returns `{ success: true }` when allowed or when rate
 * limiting is unconfigured (graceful degradation).
 */
export async function checkRateLimit(identifier: string): Promise<RateLimitResult> {
  const limiter = getRatelimiter();

  if (!limiter) {
    // Degraded mode — allow the request through.
    return { success: true, remaining: -1 };
  }

  const result = await limiter.limit(identifier);
  return { success: result.success, remaining: result.remaining };
}
