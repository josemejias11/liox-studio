import { CourseGenerationRequestSchema } from '@moto-ai/contracts/course-generation';
import { getCourseGeneration, prisma } from '@moto-ai/database';
import { NextRequest, NextResponse } from 'next/server';
import { isCourseStudioAuthorized } from '@/server/auth/course-studio';
import { jsonError, readJson, unexpectedApiError } from '@/shared/server/http';
import {
  requestAuthoringGeneration,
  toCourseGenerationSummary,
} from '@/authoring/server/generation-commands';

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!(await isCourseStudioAuthorized(request))) return jsonError('Unauthorized', 401);
  try {
    const records = await prisma.courseGeneration.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true },
    });
    const generations = await Promise.all(records.map(({ id }) => getCourseGeneration(id)));
    return NextResponse.json({ generations: generations.map(toCourseGenerationSummary) });
  } catch (error) {
    return unexpectedApiError('course-studio/generations GET', error);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!(await isCourseStudioAuthorized(request))) return jsonError('Unauthorized', 401);
  const body = await readJson(request, CourseGenerationRequestSchema);
  if (!body.success) return body.response;
  try {
    const result = await requestAuthoringGeneration(body.data);
    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    if (error instanceof Error && error.message === 'FROZEN_SOURCE_REVISION_NOT_FOUND') {
      return jsonError('Frozen source revision not found', 404);
    }
    if (error instanceof Error && error.message === 'FROZEN_SOURCE_REVISION_EMPTY') {
      return jsonError('Choose a frozen revision with at least one indexed source', 409);
    }
    return unexpectedApiError('course-studio/generations POST', error);
  }
}
