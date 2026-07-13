import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { MAX_UPLOAD_BYTES } from '@/lib/contracts/api';
import { uploadCourseDocument, deleteCourseDocument, RagServiceError } from '@/lib/parser-service';
import { jsonError, readJson, unexpectedApiError } from '@/lib/server/http';

// Proxies course-material uploads and deletions to the self-hosted parser service,
// server-to-server. Enforces the 50MB cap before forwarding anything upstream.

function isAuthorized(req: NextRequest): boolean {
  const token = req.cookies.get('analytics_token')?.value;
  const expected = process.env.ANALYTICS_PASSWORD;
  return !!expected && token === expected;
}

export async function DELETE(req: NextRequest) {
  if (!isAuthorized(req)) {
    return jsonError('Unauthorized', 401);
  }

  const parsed = await readJson(req, z.unknown(), {
    invalidJsonMessage: 'Expected a JSON body',
  });
  if (!parsed.success) return parsed.response;

  const { course_id, filename } =
    parsed.data && typeof parsed.data === 'object'
      ? (parsed.data as Record<string, unknown>)
      : {};

  if (typeof course_id !== 'string' || course_id.length === 0) {
    return jsonError('A valid "course_id" field is required', 400);
  }
  if (typeof filename !== 'string' || filename.length === 0) {
    return jsonError('A valid "filename" field is required', 400);
  }

  try {
    const result = await deleteCourseDocument(course_id, filename);
    return NextResponse.json(result);
  } catch (err: unknown) {
    if (err instanceof RagServiceError) {
      return jsonError(err.message, 502);
    }
    return unexpectedApiError('api/upload DELETE', err);
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return jsonError('Unauthorized', 401);
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return jsonError('Expected a multipart form body', 400);
  }

  const file = formData.get('file');
  const courseId = formData.get('course_id');

  if (!(file instanceof File) || file.size === 0) {
    return jsonError('A non-empty "file" field is required', 400);
  }
  if (typeof courseId !== 'string' || courseId.length === 0 || courseId.length > 100) {
    return jsonError('A valid "course_id" field is required', 400);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return jsonError(
      `File exceeds the ${Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)}MB upload limit`,
      413,
    );
  }

  try {
    const result = await uploadCourseDocument(courseId, file);
    return NextResponse.json(result);
  } catch (err: unknown) {
    if (err instanceof RagServiceError) {
      return jsonError(err.message, 502);
    }
    return unexpectedApiError('api/upload', err);
  }
}
