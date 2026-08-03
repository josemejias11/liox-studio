import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isCourseStudioAuthorized } from '@/server/auth/course-studio';
import { jsonError, readJson, unexpectedApiError } from '@/shared/server/http';
import {
  createAuthoringRevision,
  listAuthoringRevisions,
} from '@/authoring/server/course-commands';

const schema = z.object({ notes: z.string().trim().max(2000).optional() });

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
): Promise<NextResponse> {
  if (!(await isCourseStudioAuthorized(request))) return jsonError('Unauthorized', 401);
  try {
    const courseId = (await params).courseId;
    return NextResponse.json({ revisions: await listAuthoringRevisions(courseId) });
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
    const courseId = (await params).courseId;
    const revision = await createAuthoringRevision(courseId, body.data.notes);
    return NextResponse.json(
      {
        revision,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'COURSE_NOT_FOUND') {
      return jsonError('Course not found', 404);
    }
    if (error instanceof Error && error.message === 'COURSE_SOURCES_NOT_INDEXED') {
      return jsonError('All course sources must finish indexing before freezing a revision', 409);
    }
    return unexpectedApiError('course-studio/revisions', error);
  }
}
