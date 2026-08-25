import { NextRequest, NextResponse } from 'next/server';
import { deleteCourseDuplicateJob, JobDeleteBlockedError } from '@moto-ai/jobs';

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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isCourseStudioAuthorized(request))) return jsonError('Unauthorized', 401);
  const { id } = await params;
  try {
    await deleteCourseDuplicateJob(id);
    return new NextResponse(null, { status: 204 });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'JOB_NOT_FOUND') {
      return jsonError('Job not found', 404);
    }
    if (error instanceof JobDeleteBlockedError) {
      return jsonError('This request is still in progress and cannot be cleared yet.', 409);
    }
    return unexpectedApiError('api/jobs DELETE', error);
  }
}
