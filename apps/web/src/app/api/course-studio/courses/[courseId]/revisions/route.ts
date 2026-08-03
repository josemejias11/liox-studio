import {
  createCourseRevision,
  listCourseRevisions,
  listFrozenRevisionSourceIds,
} from '@moto-ai/database';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isCourseStudioAuthorized } from '@/server/auth/course-studio';
import { jsonError, readJson, unexpectedApiError } from '@/shared/server/http';

const schema = z.object({ notes: z.string().trim().max(2000).optional() });

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
): Promise<NextResponse> {
  if (!(await isCourseStudioAuthorized(request))) return jsonError('Unauthorized', 401);
  try {
    const courseId = (await params).courseId;
    const revisions = await listCourseRevisions(courseId);
    return NextResponse.json({
      revisions: await Promise.all(
        revisions.map(async (revision) => ({
          ...revision,
          sourceIds: await listFrozenRevisionSourceIds(courseId, revision.id),
        })),
      ),
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
    const courseId = (await params).courseId;
    const revision = await createCourseRevision(courseId, body.data.notes);
    return NextResponse.json(
      {
        revision: {
          ...revision,
          sourceIds: await listFrozenRevisionSourceIds(courseId, revision.id),
        },
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
