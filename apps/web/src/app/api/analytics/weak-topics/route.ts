import { NextRequest, NextResponse } from 'next/server';
import { WeakTopicsRequestSchema } from '@/shared/contracts/api';
import { getWeakTopicsForCourse } from '@/analytics/server/analytics.service';
import { readJson, unexpectedApiError } from '@/shared/server/http';

export async function POST(req: NextRequest) {
  const parsed = await readJson(req, WeakTopicsRequestSchema);
  if (!parsed.success) return parsed.response;

  const { courseId, lessons } = parsed.data;

  try {
    const result = await getWeakTopicsForCourse(courseId, lessons);
    return NextResponse.json(result);
  } catch (err: unknown) {
    return unexpectedApiError('api/analytics/weak-topics', err);
  }
}
