import { createHash } from 'node:crypto';
import { getCourseSource, markSourceFailed, retryCourseSourceIndex } from '@moto-ai/database';
import { enqueueDocumentIndexJob } from '@moto-ai/jobs';
import { NextRequest, NextResponse } from 'next/server';
import { isCourseStudioAuthorized } from '@/lib/course-studio-auth';
import { getCourseAsset } from '@/lib/r2';
import { jsonError, unexpectedApiError } from '@/lib/server/http';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string; sourceId: string }> },
): Promise<NextResponse> {
  if (!(await isCourseStudioAuthorized(request))) return jsonError('Unauthorized', 401);

  const { courseId, sourceId } = await params;
  try {
    const source = await getCourseSource(courseId, sourceId);
    if (source.indexStatus !== 'failed') {
      return jsonError('Only failed source indexing can be retried', 409);
    }
    const object = await getCourseAsset(source.r2Key);
    if (!object.Body)
      return jsonError('The stored source file is unavailable. Upload it again.', 409);
    const bytes = Buffer.from(await object.Body.transformToByteArray());
    if (createHash('sha256').update(bytes).digest('hex') !== source.sha256) {
      return jsonError(
        'The stored source file no longer matches its record. Upload it again.',
        409,
      );
    }
    const pending = await retryCourseSourceIndex(courseId, sourceId);
    try {
      const job = await enqueueDocumentIndexJob(
        {
          sourceId,
          courseId,
          sha256: pending.sha256,
          filename: pending.filename,
          contentType: pending.contentType,
        },
        bytes,
      );
      return NextResponse.json({ source: pending, job }, { status: 202 });
    } catch (error) {
      // Leave a clear actionable source state if the durable queue is unavailable.
      await markSourceFailed(
        courseId,
        sourceId,
        'The retry could not be queued. Try again when the processing service is available.',
      ).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'COURSE_SOURCE_NOT_FOUND') {
      return jsonError('Source not found', 404);
    }
    if (error instanceof Error && error.message === 'COURSE_SOURCE_RETRY_NOT_ALLOWED') {
      return jsonError('Only failed source indexing can be retried', 409);
    }
    if (error instanceof Error && error.message === 'COURSE_SOURCE_REMOVAL_IN_PROGRESS') {
      return jsonError('This source is being removed', 409);
    }
    return unexpectedApiError('course-studio/source retry', error);
  }
}
