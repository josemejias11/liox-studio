import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { ProgressRequestSchema } from '@/lib/contracts/api';
import { loadSessionProgress, recordHotspots, recordLessonView } from '@/lib/progress-store';
import { checkRateLimit } from '@/lib/rate-limit';
import { jsonError, readJson, unexpectedApiError } from '@/lib/server/http';

export async function GET(req: NextRequest) {
  const sessionId = new URL(req.url).searchParams.get('sessionId');
  // Simple UUID v4 regex validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!sessionId || !uuidRegex.test(sessionId)) {
    return jsonError('Valid sessionId required', 400);
  }

  try {
    return NextResponse.json(await loadSessionProgress(sessionId));
  } catch (error: unknown) {
    return unexpectedApiError('api/progress GET', error);
  }
}

export async function POST(req: NextRequest) {
  // ── Rate limiting (by client IP) ─────────────────────────────────────────
  const headerStore = await headers();
  const forwarded = headerStore.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
  const { success } = await checkRateLimit(ip);
  if (!success) {
    return jsonError('Too many requests', 429);
  }

  const parsed = await readJson(req, ProgressRequestSchema);
  if (!parsed.success) return parsed.response;

  const body = parsed.data;

  try {
    if (body.type === 'lesson') {
      if (body.visitedHotspots !== undefined || body.completed !== undefined) {
        await recordHotspots(body);
      } else {
        await recordLessonView(body);
      }

      return NextResponse.json({ ok: true });
    }

    // Quiz attempts are recorded server-side by /api/quiz/grade — this route
    // intentionally no longer accepts a client-supplied quiz result.
    return jsonError('unknown type', 400);
  } catch (error: unknown) {
    return unexpectedApiError('api/progress POST', error);
  }
}
