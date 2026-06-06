import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const sessionId = new URL(req.url).searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  const records = await prisma.slideProgress.findMany({
    where: { sessionId },
    select: { slideId: true, visitedHotspots: true, completed: true },
  });

  const slides: Record<string, { visitedHotspots: string[]; completed: boolean }> = {};
  for (const r of records) {
    slides[r.slideId] = {
      visitedHotspots: JSON.parse(r.visitedHotspots) as string[],
      completed: r.completed,
    };
  }

  return NextResponse.json({ slides });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (body.type === "slide") {
    const { sessionId, slideId, visitedHotspots, completed } = body as {
      type: "slide";
      sessionId: string;
      slideId: string;
      visitedHotspots: string[];
      completed: boolean;
    };

    if (!sessionId || !slideId) {
      return NextResponse.json({ error: "sessionId and slideId required" }, { status: 400 });
    }

    await prisma.slideProgress.upsert({
      where: { sessionId_slideId: { sessionId, slideId } },
      update: { visitedHotspots: JSON.stringify(visitedHotspots ?? []), completed: completed ?? false },
      create: { sessionId, slideId, visitedHotspots: JSON.stringify(visitedHotspots ?? []), completed: completed ?? false },
    });

    return NextResponse.json({ ok: true });
  }

  if (body.type === "quiz") {
    const { sessionId, moduleId, score, total, answers } = body as {
      type: "quiz";
      sessionId: string;
      moduleId: string;
      score: number;
      total: number;
      answers: { question: string; selected: string; correct: string }[];
    };

    if (!sessionId || !moduleId || score === undefined || total === undefined) {
      return NextResponse.json({ error: "sessionId, moduleId, score, and total required" }, { status: 400 });
    }

    await prisma.quizAttempt.create({
      data: { sessionId, moduleId, score, total, answers: JSON.stringify(answers ?? []) },
    });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown type" }, { status: 400 });
}
