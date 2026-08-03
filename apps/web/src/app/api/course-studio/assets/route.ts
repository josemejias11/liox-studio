import { NextRequest, NextResponse } from 'next/server';
import { isCourseStudioAuthorized } from '@/server/auth/course-studio';
import { uploadAuthoringAsset } from '@/authoring/server/asset-commands';

export const runtime = 'nodejs';

const MAX_ASSET_BYTES = 50 * 1024 * 1024;
const SOURCE_EXTENSIONS = new Set(['.pdf', '.pptx', '.docx', '.xlsx']);

function extension(filename: string): string {
  const normalized = filename.trim().toLowerCase();
  const dot = normalized.lastIndexOf('.');
  return dot >= 0 ? normalized.slice(dot) : '';
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!(await isCourseStudioAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const form = await request.formData();
  const courseId = form.get('courseId');
  const file = form.get('file');
  if (typeof courseId !== 'string' || !courseId || !(file instanceof File)) {
    return NextResponse.json({ error: 'courseId and file are required' }, { status: 400 });
  }
  if (file.size > MAX_ASSET_BYTES) {
    return NextResponse.json({ error: 'Assets must be 50 MB or smaller' }, { status: 413 });
  }
  if (SOURCE_EXTENSIONS.has(extension(file.name))) {
    return NextResponse.json(
      { error: 'Course documents must be uploaded through the course source library' },
      { status: 400 },
    );
  }

  try {
    const asset = await uploadAuthoringAsset({
      courseId,
      filename: file.name,
      contentType: file.type || undefined,
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
    return NextResponse.json({ asset }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'COURSE_NOT_FOUND') {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }
    console.error('[course-studio/assets] upload failed:', error);
    return NextResponse.json({ error: 'Asset upload failed' }, { status: 500 });
  }
}
