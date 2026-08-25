import { NextRequest, NextResponse } from 'next/server';
import { isAnalyticsAuthorized } from '@/analytics/server/analytics-auth';
import { WeakTopicsRequestSchema } from '@/shared/contracts/api';
import { getWeakTopicsForCourse } from '@/analytics/server/analytics.service';
import { jsonError, readJson, unexpectedApiError } from '@/shared/server/http';

export async function POST(req: NextRequest) {
  if (!isAnalyticsAuthorized(req)) return jsonError('Unauthorized', 401);
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
