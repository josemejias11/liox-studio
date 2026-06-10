import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ProgressRequestSchema } from "@/lib/contracts/progress";

export async function GET(req: NextRequest) {
  const sessionId = new URL(req.url).searchParams.get("sessionId");
  // Simple UUID v4 regex validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!sessionId || !uuidRegex.test(sessionId)) {
    return NextResponse.json({ error: "Valid sessionId required" }, { status: 400 });
  }

  try {
    const [progressRecords, layerProgressRecords, hotspotRecords] = await Promise.all([
      prisma.lessonProgress.findMany({ where: { sessionId } }),
      prisma.layerProgress.findMany({ where: { sessionId } }),
      prisma.hotspotVisit.findMany({ where: { sessionId } }),
    ]);

    const lessons: Record<string, { visitedHotspots: string[]; completed: boolean }> = {};
    const layers: Record<string, { visitedHotspots: string[]; completed: boolean }> = {};

    for (const r of progressRecords) {
      lessons[r.lessonId] = { visitedHotspots: [], completed: r.completed };
    }

    for (const r of layerProgressRecords) {
      layers[r.layerId] = { visitedHotspots: [], completed: r.completed };
    }

    for (const h of hotspotRecords) {
      if (h.layerId && h.layerId !== "") {
        if (!layers[h.layerId]) layers[h.layerId] = { visitedHotspots: [], completed: false };
        if (!layers[h.layerId].visitedHotspots.includes(h.label)) {
          layers[h.layerId].visitedHotspots.push(h.label);
        }
      } else {
        if (!lessons[h.lessonId]) lessons[h.lessonId] = { visitedHotspots: [], completed: false };
        if (!lessons[h.lessonId].visitedHotspots.includes(h.label)) {
          lessons[h.lessonId].visitedHotspots.push(h.label);
        }
      }
    }

    return NextResponse.json({ lessons, layers });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = ProgressRequestSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request payload", details: parsed.error.issues }, { status: 400 });
  }

  const body = parsed.data;

  try {
    if (body.type === "lesson") {
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
              where: { sessionId_lessonId_layerId_label: { sessionId, lessonId, layerId: "", label } },
              update: {},
              create: { sessionId, lessonId, layerId: "", label },
            });
          }
        }
      });

      return NextResponse.json({ ok: true });
    }

    if (body.type === "layer") {
      const { sessionId, lessonId, layerId, visitedHotspots, completed } = body;

      await prisma.$transaction(async (tx) => {
        await tx.session.upsert({
          where: { id: sessionId },
          update: { updatedAt: new Date() },
          create: { id: sessionId },
        });

        await tx.layerProgress.upsert({
          where: { sessionId_lessonId_layerId: { sessionId, lessonId, layerId } },
          update: { completed: completed ?? false },
          create: { sessionId, lessonId, layerId, completed: completed ?? false },
        });

        if (visitedHotspots && visitedHotspots.length > 0) {
          for (const label of visitedHotspots) {
            await tx.hotspotVisit.upsert({
              where: { sessionId_lessonId_layerId_label: { sessionId, lessonId, layerId, label } },
              update: {},
              create: { sessionId, lessonId, layerId, label },
            });
          }
        }
      });

      return NextResponse.json({ ok: true });
    }

    // Quiz attempts are recorded server-side by /api/quiz/grade — this route
    // intentionally no longer accepts a client-supplied quiz result.
    return NextResponse.json({ error: "unknown type" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
