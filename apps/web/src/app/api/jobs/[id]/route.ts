import { NextRequest, NextResponse } from 'next/server';

import { isCourseStudioAuthorized } from '@/server/auth/course-studio';
import { jsonError, unexpectedApiError } from '@/shared/server/http';
import { getClientSafeJobStatus } from '@/server/jobs/job-status';

export const runtime = 'nodejs';
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isCourseStudioAuthorized(request))) return jsonError('Unauthorized', 401);
  const { id } = await params;
  try {
    const job = await getClientSafeJobStatus(id);
    if (!job) return jsonError('Job not found', 404);
    return NextResponse.json(job);
  } catch (error: unknown) {
    return unexpectedApiError('api/jobs GET', error);
  }
}
