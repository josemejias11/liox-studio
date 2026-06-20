import { NextRequest, NextResponse } from 'next/server';
import { MAX_UPLOAD_BYTES } from '@/lib/contracts/api';
import { uploadCourseDocument, deleteCourseDocument, RagServiceError } from '@/lib/parser-service';

// Proxies course-material uploads and deletions to the self-hosted parser service,
// server-to-server. Enforces the 50MB cap before forwarding anything upstream.

function isAuthorized(req: NextRequest): boolean {
  const token = req.cookies.get('analytics_token')?.value;
  const expected = process.env.ANALYTICS_PASSWORD;
  return !!expected && token === expected;
}

export async function DELETE(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body' }, { status: 400 });
  }

  const { course_id, filename } =
    body && typeof body === 'object' ? (body as Record<string, unknown>) : {};

  if (typeof course_id !== 'string' || course_id.length === 0) {
    return NextResponse.json({ error: 'A valid "course_id" field is required' }, { status: 400 });
  }
  if (typeof filename !== 'string' || filename.length === 0) {
    return NextResponse.json({ error: 'A valid "filename" field is required' }, { status: 400 });
  }

  try {
    const result = await deleteCourseDocument(course_id, filename);
    return NextResponse.json(result);
  } catch (err: unknown) {
    if (err instanceof RagServiceError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    console.error('[api/upload DELETE] unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Expected a multipart form body' }, { status: 400 });
  }

  const file = formData.get('file');
  const courseId = formData.get('course_id');

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'A non-empty "file" field is required' }, { status: 400 });
  }
  if (typeof courseId !== 'string' || courseId.length === 0 || courseId.length > 100) {
    return NextResponse.json({ error: 'A valid "course_id" field is required' }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `File exceeds the ${Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)}MB upload limit` },
      { status: 413 },
    );
  }

  try {
    const result = await uploadCourseDocument(courseId, file);
    return NextResponse.json(result);
  } catch (err: unknown) {
    if (err instanceof RagServiceError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    console.error('[api/upload] unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
