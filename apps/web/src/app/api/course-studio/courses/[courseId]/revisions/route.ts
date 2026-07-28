import { createCourseRevision, listCourseRevisions } from '@moto-ai/database';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isCourseStudioAuthorized } from '@/lib/course-studio-auth';
import { jsonError, readJson, unexpectedApiError } from '@/lib/server/http';

const schema = z.object({ notes: z.string().trim().max(2000).optional() });

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
): Promise<NextResponse> {
  if (!(await isCourseStudioAuthorized(request))) return jsonError('Unauthorized', 401);
  try {
    return NextResponse.json({
      revisions: await listCourseRevisions((await params).courseId),
    });
  } catch (error) {
    return unexpectedApiError('course-studio/revisions', error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
): Promise<NextResponse> {
  if (!(await isCourseStudioAuthorized(request))) return jsonError('Unauthorized', 401);
  const body = await readJson(request, schema);
  if (!body.success) return body.response;
  try {
    return NextResponse.json(
      { revision: await createCourseRevision((await params).courseId, body.data.notes) },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'COURSE_NOT_FOUND') {
      return jsonError('Course not found', 404);
    }
    return unexpectedApiError('course-studio/revisions', error);
  }
}
