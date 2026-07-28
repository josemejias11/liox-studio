import { createCourseTemplate } from '@moto-ai/database';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isCourseStudioAuthorized } from '@/lib/course-studio-auth';
import { readJson } from '@/lib/server/http';

const createCourseSchema = z.object({ title: z.string().trim().min(1).max(120) });

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!(await isCourseStudioAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await readJson(request, createCourseSchema);
  if (!body.success) return body.response;
  const course = await createCourseTemplate(body.data.title);
  return NextResponse.json({ course }, { status: 201 });
}
