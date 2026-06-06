import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ProgressRequestSchema } from "@/lib/contracts/progress";

export async function GET(req: NextRequest) {
  const sessionId = new URL(req.url).searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  const progressRecords = await prisma.slideProgress.findMany({
    where: { sessionId },
  });

  const hotspotRecords = await prisma.hotspotVisit.findMany({
    where: { sessionId },
  });

  const slides: Record<string, { visitedHotspots: string[]; completed: boolean }> = {};

  for (const r of progressRecords) {
    slides[r.slideId] = {
      visitedHotspots: [],
      completed: r.completed,
    };
  }

  for (const h of hotspotRecords) {
    if (!slides[h.slideId]) {
      slides[h.slideId] = { visitedHotspots: [], completed: false };
    }
    if (!slides[h.slideId].visitedHotspots.includes(h.label)) {
      slides[h.slideId].visitedHotspots.push(h.label);
    }
  }

  return NextResponse.json({ slides });
}

export async function POST(req: NextRequest) {
  const json = await req.json();
  const parsed = ProgressRequestSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request payload", details: parsed.error.issues }, { status: 400 });
  }

  const body = parsed.data;

  // Ensure session exists
  await prisma.session.upsert({
    where: { id: body.sessionId },
    update: { updatedAt: new Date() },
    create: { id: body.sessionId },
  });

  if (body.type === "slide") {
    const { sessionId, slideId, visitedHotspots, completed } = body;

    await prisma.slideProgress.upsert({
      where: { sessionId_slideId: { sessionId, slideId } },
      update: { completed: completed ?? false },
      create: { sessionId, slideId, completed: completed ?? false },
    });

    if (visitedHotspots && visitedHotspots.length > 0) {
      await Promise.all(
        visitedHotspots.map((label) =>
          prisma.hotspotVisit.upsert({
            where: { sessionId_slideId_label: { sessionId, slideId, label } },
            update: {},
            create: { sessionId, slideId, label },
          })
        )
      );
    }

    return NextResponse.json({ ok: true });
  }

  if (body.type === "quiz") {
    const { sessionId, moduleId, score, total, answers } = body;

    await prisma.quizAttempt.create({
      data: {
        sessionId,
        moduleId,
        score,
        total,
        answers: JSON.stringify(answers ?? []),
      },
    });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown type" }, { status: 400 });
}
