import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ProgressRequestSchema } from '@/lib/contracts/progress';
import { checkRateLimit } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  const sessionId = new URL(req.url).searchParams.get('sessionId');
  // Simple UUID v4 regex validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!sessionId || !uuidRegex.test(sessionId)) {
    return NextResponse.json({ error: 'Valid sessionId required' }, { status: 400 });
  }

  try {
    const [progressRecords, hotspotRecords] = await Promise.all([
      prisma.lessonProgress.findMany({ where: { sessionId } }),
      prisma.hotspotVisit.findMany({ where: { sessionId, layerId: '' } }),
    ]);

    const lessons: Record<string, { visitedHotspots: string[]; completed: boolean }> = {};

    for (const r of progressRecords) {
      lessons[r.lessonId] = { visitedHotspots: [], completed: r.completed };
    }

    for (const h of hotspotRecords) {
      if (!lessons[h.lessonId]) lessons[h.lessonId] = { visitedHotspots: [], completed: false };
      if (!lessons[h.lessonId].visitedHotspots.includes(h.label)) {
        lessons[h.lessonId].visitedHotspots.push(h.label);
      }
    }

    return NextResponse.json({ lessons });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // ── Rate limiting (by client IP) ─────────────────────────────────────────
  const headerStore = await headers();
  const forwarded = headerStore.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
  const { success } = await checkRateLimit(ip);
  if (!success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = ProgressRequestSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request payload', details: parsed.error.issues },
      { status: 400 },
    );
  }

  const body = parsed.data;

  try {
    if (body.type === 'lesson') {
      const { sessionId, lessonId, visitedHotspots, completed } = body;

      await prisma.$transaction(async (tx) => {
        await tx.session.upsert({
          where: { id: sessionId },
          update: { updatedAt: new Date() },
          create: { id: sessionId },
        });

        await tx.lessonProgress.upsert({
          where: { sessionId_lessonId: { sessionId, lessonId } },
          update: { completed: completed ?? false },
          create: { sessionId, lessonId, completed: completed ?? false },
        });

        if (visitedHotspots && visitedHotspots.length > 0) {
          for (const label of visitedHotspots) {
            await tx.hotspotVisit.upsert({
              where: {
                sessionId_lessonId_layerId_label: { sessionId, lessonId, layerId: '', label },
              },
              update: {},
              create: { sessionId, lessonId, layerId: '', label },
            });
          }
        }
      });

      return NextResponse.json({ ok: true });
    }

    // Quiz attempts are recorded server-side by /api/quiz/grade — this route
    // intentionally no longer accepts a client-supplied quiz result.
    return NextResponse.json({ error: 'unknown type' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
