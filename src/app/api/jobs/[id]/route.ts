import { NextRequest, NextResponse } from 'next/server';

import { JobStatusResponseSchema } from '@/lib/jobs/contracts';
import { getJobStatus } from '@/lib/jobs/queue';
import { jsonError, unexpectedApiError } from '@/lib/server/http';

export const runtime = 'nodejs';

// Every result is already a client-safe projection. Job IDs are unguessable
// CUIDs, which lets the learner quiz poll without requiring an auth session.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const job = await getJobStatus(id);
    if (!job) return jsonError('Job not found', 404);
    return NextResponse.json(JobStatusResponseSchema.parse(job));
  } catch (error: unknown) {
    return unexpectedApiError('api/jobs GET', error);
  }
}
