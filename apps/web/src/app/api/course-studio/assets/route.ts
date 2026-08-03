import { prisma } from '@moto-ai/database';
import { NextRequest, NextResponse } from 'next/server';
import { isCourseStudioAuthorized } from '@/server/auth/course-studio';
import { deleteCourseAsset, putCourseAsset } from '@/server/storage/course-assets';

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

  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true } });
  if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

  let uploaded: Awaited<ReturnType<typeof putCourseAsset>> | undefined;
  try {
    uploaded = await putCourseAsset({
      courseId,
      filename: file.name,
      contentType: file.type || undefined,
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
    const asset = await prisma.courseAsset.create({
      data: {
        r2Key: uploaded.r2Key,
        filename: uploaded.filename ?? file.name,
        contentType: uploaded.contentType,
        byteSize: file.size,
        deliveryUrl: uploaded.url,
      },
    });
    return NextResponse.json({ asset }, { status: 201 });
  } catch (error) {
    if (uploaded) {
      await deleteCourseAsset(uploaded.r2Key).catch(() => undefined);
    }
    console.error('[course-studio/assets] upload failed:', error);
    return NextResponse.json({ error: 'Asset upload failed' }, { status: 500 });
  }
}
