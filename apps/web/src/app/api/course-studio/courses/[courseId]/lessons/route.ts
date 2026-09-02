import { COURSE_LESSON_TYPES } from '@lb-studio/contracts/course-studio';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isCourseStudioAuthorized } from '@/server/auth/course-studio';
import { jsonError, readJson, unexpectedApiError } from '@/shared/server/http';
import {
  createAuthoringLesson,
  deleteOrDuplicateAuthoringLesson,
  updateAuthoringLesson,
} from '@/authoring/server/course-commands';

const createSchema = z.object({
  chapterId: z.string().min(1),
  lessonType: z.enum(COURSE_LESSON_TYPES),
});
const updateSchema = z.object({
  lessonId: z.string().min(1),
  headline: z.string().trim().min(1).max(160).optional(),
  body: z.unknown().nullable().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});
const actionSchema = z.object({
  lessonId: z.string().min(1),
  action: z.enum(['delete', 'duplicate']),
});

function lessonError(error: unknown) {
  if (error instanceof Error && error.message === 'LESSON_NOT_FOUND') {
    return jsonError('Lesson not found', 404);
  }
  if (error instanceof Error && error.message === 'CHAPTER_NOT_FOUND') {
    return jsonError('Chapter not found', 404);
  }
  if (error instanceof Error && error.message === 'FINAL_LESSON') {
    return jsonError('A chapter must keep at least one screen', 409);
  }
  return unexpectedApiError('course-studio/lessons', error);
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
      {
        course: await createAuthoringLesson(
          (await params).courseId,
          body.data.chapterId,
          body.data.lessonType,
        ),
      },
      { status: 201 },
    );
  } catch (error) {
    return lessonError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
): Promise<NextResponse> {
  if (!(await isCourseStudioAuthorized(request))) return jsonError('Unauthorized', 401);
  const body = await readJson(request, updateSchema);
  if (!body.success) return body.response;
  const { lessonId, ...input } = body.data;
  try {
    return NextResponse.json({
      course: await updateAuthoringLesson((await params).courseId, lessonId, input),
    });
  } catch (error) {
    return lessonError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
): Promise<NextResponse> {
  if (!(await isCourseStudioAuthorized(request))) return jsonError('Unauthorized', 401);
  const body = await readJson(request, actionSchema);
  if (!body.success) return body.response;
  try {
    return NextResponse.json(
      await deleteOrDuplicateAuthoringLesson({
        courseId: (await params).courseId,
        lessonId: body.data.lessonId,
        action: body.data.action,
      }),
    );
  } catch (error) {
    return lessonError(error);
  }
}
