import {
  createLesson,
  duplicateLesson,
  getAuthoringCourse,
  trashLesson,
  updateLesson,
  type CourseTrashItem,
} from '@moto-ai/database';
import { COURSE_LESSON_TYPES, type LessonInput } from '@moto-ai/contracts/course-studio';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isCourseStudioAuthorized } from '@/server/auth/course-studio';
import { jsonError, readJson, unexpectedApiError } from '@/shared/server/http';

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

function serializeTrashItem(item: CourseTrashItem) {
  return { ...item, deletedAt: item.deletedAt.toISOString() };
}

async function ensureLessonInCourse(courseId: string, lessonId: string): Promise<void> {
  const course = await getAuthoringCourse(courseId);
  const lessonExists = course?.chapters.some((chapter) =>
    chapter.lessons.some((lesson) => lesson.id === lessonId),
  );
  if (!lessonExists) throw new Error('LESSON_NOT_FOUND');
}

function lessonError(error: unknown) {
  if (error instanceof Error && error.message === 'LESSON_NOT_FOUND') {
    return jsonError('Lesson not found', 404);
  }
  if (error instanceof Error && error.message === 'FINAL_LESSON') {
    return jsonError('A chapter must keep at least one screen', 409);
  }
  return unexpectedApiError('course-studio/lessons', error);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!(await isCourseStudioAuthorized(request))) return jsonError('Unauthorized', 401);
  const body = await readJson(request, createSchema);
  if (!body.success) return body.response;
  try {
    return NextResponse.json(
      { course: await createLesson(body.data.chapterId, body.data.lessonType) },
      { status: 201 },
    );
  } catch (error) {
    return lessonError(error);
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  if (!(await isCourseStudioAuthorized(request))) return jsonError('Unauthorized', 401);
  const body = await readJson(request, updateSchema);
  if (!body.success) return body.response;
  const { lessonId, ...input } = body.data;
  try {
    return NextResponse.json({ course: await updateLesson(lessonId, input as LessonInput) });
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
    if (body.data.action === 'duplicate') {
      return NextResponse.json({ course: await duplicateLesson(body.data.lessonId) });
    }

    await ensureLessonInCourse((await params).courseId, body.data.lessonId);
    const { course, trashItem, trash } = await trashLesson(body.data.lessonId);
    return NextResponse.json({
      course,
      trashItem: serializeTrashItem(trashItem),
      trash: trash.map(serializeTrashItem),
    });
  } catch (error) {
    return lessonError(error);
  }
}
