import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AssistantQaItemSchema } from '@moto-ai/contracts';
import { isCourseStudioAuthorized } from '@/server/auth/course-studio';
import { jsonError, readJson, unexpectedApiError } from '@/shared/server/http';
import {
  deleteAuthoringAssistantQa,
  listAuthoringAssistantQa,
  requestAuthoringAssistantQaDrafts,
  updateAuthoringAssistantQa,
} from '@/authoring/server/assistant-commands';

const generationSchema = z.object({ sourceIds: z.array(z.string().min(1)).min(1).max(100) });
const updateSchema = AssistantQaItemSchema;

async function authorized(request: NextRequest) {
  return isCourseStudioAuthorized(request);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  if (!(await authorized(request))) return jsonError('Unauthorized', 401);
  return NextResponse.json({ items: await listAuthoringAssistantQa((await params).courseId) });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  if (!(await authorized(request))) return jsonError('Unauthorized', 401);
  const body = await readJson(request, generationSchema);
  if (!body.success) return body.response;
  try {
    return NextResponse.json(
      {
        job: await requestAuthoringAssistantQaDrafts((await params).courseId, body.data.sourceIds),
      },
      { status: 202 },
    );
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === 'ASSISTANT_QA_SOURCES_REQUIRED' ||
        error.message === 'ASSISTANT_QA_SOURCES_NOT_INDEXED')
    )
      return jsonError('Select one or more indexed course sources.', 409);
    return unexpectedApiError('course-studio/assistant-qa', error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  if (!(await authorized(request))) return jsonError('Unauthorized', 401);
  const body = await readJson(request, updateSchema);
  if (!body.success) return body.response;
  try {
    return NextResponse.json({
      item: await updateAuthoringAssistantQa((await params).courseId, body.data.id, body.data),
    });
  } catch (error) {
    return error instanceof Error && error.message === 'ASSISTANT_QA_NOT_FOUND'
      ? jsonError('Assistant Q&A item not found', 404)
      : unexpectedApiError('course-studio/assistant-qa', error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  if (!(await authorized(request))) return jsonError('Unauthorized', 401);
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return jsonError('Assistant Q&A item id is required', 400);
  try {
    await deleteAuthoringAssistantQa((await params).courseId, id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return error instanceof Error && error.message === 'ASSISTANT_QA_NOT_FOUND'
      ? jsonError('Assistant Q&A item not found', 404)
      : unexpectedApiError('course-studio/assistant-qa', error);
  }
}
