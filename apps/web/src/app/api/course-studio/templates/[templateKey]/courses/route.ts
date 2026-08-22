import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAuthoringCourseFromTemplate } from '@/authoring/server/template-commands';
import { isCourseStudioAuthorized } from '@/server/auth/course-studio';
import { jsonError, readJson, unexpectedApiError } from '@/shared/server/http';

const createTemplateCourseSchema = z.object({ title: z.string().trim().min(1).max(120) });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ templateKey: string }> },
): Promise<NextResponse> {
  if (!(await isCourseStudioAuthorized(request))) return jsonError('Unauthorized', 401);
  const body = await readJson(request, createTemplateCourseSchema);
  if (!body.success) return body.response;
  try {
    const course = await createAuthoringCourseFromTemplate(
      (await params).templateKey,
      body.data.title,
    );
    return NextResponse.json({ course }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'COURSE_TEMPLATE_NOT_FOUND') {
      return jsonError('Course template not found', 404);
    }
    return unexpectedApiError('course-studio/template-course', error);
  }
}
