import { CourseGenerationRequestSchema } from '@lb-studio/contracts/course-generation';
import { NextRequest, NextResponse } from 'next/server';
import { isCourseStudioAuthorized } from '@/server/auth/course-studio';
import { jsonError, readJson, unexpectedApiError } from '@/shared/server/http';
import {
  requestAuthoringGeneration,
  listAuthoringGenerations,
} from '@/authoring/server/generation-commands';

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!(await isCourseStudioAuthorized(request))) return jsonError('Unauthorized', 401);
  try {
    return NextResponse.json({ generations: await listAuthoringGenerations() });
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
