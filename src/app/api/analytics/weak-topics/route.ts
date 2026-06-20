import { NextRequest, NextResponse } from 'next/server';
import { WeakTopicsRequestSchema } from '@/lib/contracts/api';
import { getWeakTopicsForCourse } from '@/services/analytics.service';

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

  try {
    const result = await getWeakTopicsForCourse(courseId, lessons);
    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error('[api/analytics/weak-topics] unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
