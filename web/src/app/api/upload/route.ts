import { NextRequest, NextResponse } from 'next/server';
import { MAX_UPLOAD_BYTES } from '@/lib/contracts/api';
import { parserPost, parserDelete, ParserUploadResponseSchema, ParserServiceError } from '@/lib/parser-service';

// Proxies course-material uploads (multipart form: course_id + file) to the
// self-hosted parser service, server-to-server. Enforces the 50MB cap before
// forwarding anything upstream.

const USER_SAFE_UNAVAILABLE =
  'The upload service is temporarily unavailable. Please try again in a moment.';

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
    const raw = await parserDelete('/api/document', { json: { course_id, filename } });
    return NextResponse.json(raw);
  } catch (err: unknown) {
    if (err instanceof ParserServiceError) {
      console.error('[api/upload DELETE] parser service error:', err.message);
      return NextResponse.json({ error: USER_SAFE_UNAVAILABLE }, { status: 502 });
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

  const upstream = new FormData();
  upstream.append('course_id', courseId);
  upstream.append('file', file, file.name);

  try {
    const raw = await parserPost('/api/upload', { body: upstream, timeoutMs: 120_000 });
    const parsed = ParserUploadResponseSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: USER_SAFE_UNAVAILABLE }, { status: 502 });
    }
    return NextResponse.json(parsed.data);
  } catch (err: unknown) {
    if (err instanceof ParserServiceError) {
      console.error('[api/upload] parser service error:', err.message);
      return NextResponse.json({ error: USER_SAFE_UNAVAILABLE }, { status: 502 });
    }
    console.error('[api/upload] unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
