import { createChapter, deleteChapter, updateChapter } from '@moto-ai/database';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isCourseStudioAuthorized } from '@/lib/course-studio-auth';
import { jsonError, readJson, unexpectedApiError } from '@/lib/server/http';

const createSchema = z.object({ title: z.string().trim().min(1).max(120) });
const updateSchema = z.object({
  chapterId: z.string().min(1),
  title: z.string().trim().min(1).max(120).optional(),
  estimatedDuration: z.number().int().min(0).max(1440).nullable().optional(),
});
const deleteSchema = z.object({ chapterId: z.string().min(1) });

function chapterError(error: unknown) {
  if (error instanceof Error && error.message === 'CHAPTER_NOT_FOUND') {
    return jsonError('Chapter not found', 404);
  }
  if (error instanceof Error && error.message === 'FINAL_CHAPTER') {
    return jsonError('A course must keep at least one chapter', 409);
  }
  return unexpectedApiError('course-studio/chapters', error);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
): Promise<NextResponse> {
  if (!(await isCourseStudioAuthorized(request))) return jsonError('Unauthorized', 401);
  const body = await readJson(request, createSchema);
  if (!body.success) return body.response;
  try {
    return NextResponse.json(
      { course: await createChapter((await params).courseId, body.data) },
      { status: 201 },
    );
  } catch (error) {
    return chapterError(error);
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  if (!(await isCourseStudioAuthorized(request))) return jsonError('Unauthorized', 401);
  const body = await readJson(request, updateSchema);
  if (!body.success) return body.response;
  const { chapterId, ...input } = body.data;
  try {
    return NextResponse.json({ course: await updateChapter(chapterId, input) });
  } catch (error) {
    return chapterError(error);
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  if (!(await isCourseStudioAuthorized(request))) return jsonError('Unauthorized', 401);
  const body = await readJson(request, deleteSchema);
  if (!body.success) return body.response;
  try {
    return NextResponse.json({ course: await deleteChapter(body.data.chapterId) });
  } catch (error) {
    return chapterError(error);
  }
}
