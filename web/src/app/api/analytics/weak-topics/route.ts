import { NextRequest, NextResponse } from 'next/server';
import { WeakTopicsRequestSchema } from '@/lib/contracts/api';
import { getLessonEngagement } from '@/services/analytics.service';

export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = WeakTopicsRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request payload', details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { courseId, lessons } = parsed.data;
  const engagement = await getLessonEngagement(courseId);

  if (engagement.length === 0) {
    return NextResponse.json({ weakTopics: [], engagement: [] });
  }

  // Median viewCount across all seen lessons
  const counts = engagement.map((e) => e.viewCount).sort((a, b) => a - b);
  const mid = Math.floor(counts.length / 2);
  const median = counts.length % 2 === 0 ? (counts[mid - 1] + counts[mid]) / 2 : counts[mid];

  // Lessons with at or below median engagement are "weak"
  const weakIds = new Set(engagement.filter((e) => e.viewCount <= median).map((e) => e.lessonId));

  // Lessons present in the request but with zero views are also weak
  const seenIds = new Set(engagement.map((e) => e.lessonId));
  for (const l of lessons) {
    if (!seenIds.has(l.id)) weakIds.add(l.id);
  }

  // Collect topics from weak lessons
  const lessonMap = new Map(lessons.map((l) => [l.id, l]));
  const topicSet = new Set<string>();
  for (const id of weakIds) {
    const meta = lessonMap.get(id);
    if (!meta) continue;
    for (const t of meta.topics) {
      if (t.trim()) topicSet.add(t.trim());
    }
  }

  return NextResponse.json({
    weakTopics: Array.from(topicSet).slice(0, 15),
    engagement,
  });
}
