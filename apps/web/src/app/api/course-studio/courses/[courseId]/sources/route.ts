import { createHash } from 'node:crypto';
import {
  createPendingSource,
  listCourseSources,
  prisma,
  removeCourseSource,
} from '@moto-ai/database';
import { enqueueDocumentIndexJob } from '@moto-ai/jobs';
import { NextRequest, NextResponse } from 'next/server';
import { isCourseStudioAuthorized } from '@/lib/course-studio-auth';
import { deleteCourseAsset, putCourseAsset } from '@/lib/r2';
import { jsonError, unexpectedApiError } from '@/lib/server/http';

export const runtime = 'nodejs';

const MAX_SOURCE_BYTES = 50 * 1024 * 1024;
const SUPPORTED_SOURCE_EXTENSIONS = new Set(['.pdf', '.pptx', '.docx', '.xlsx']);

function extension(filename: string): string {
  const normalized = filename.trim().toLowerCase();
  const dot = normalized.lastIndexOf('.');
  return dot >= 0 ? normalized.slice(dot) : '';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
): Promise<NextResponse> {
  if (!(await isCourseStudioAuthorized(request))) return jsonError('Unauthorized', 401);
  try {
    return NextResponse.json({
      sources: await listCourseSources((await params).courseId),
    });
  } catch (error) {
    return unexpectedApiError('course-studio/sources', error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
): Promise<NextResponse> {
  if (!(await isCourseStudioAuthorized(request))) return jsonError('Unauthorized', 401);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError('Expected a multipart form body', 400);
  }

  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return jsonError('A non-empty "file" field is required', 400);
  }
  const filename = file.name.replaceAll('\\', '/').split('/').pop()?.trim() ?? '';
  if (!filename) return jsonError('A valid filename is required', 400);
  if (filename.length > 255) return jsonError('Filename must be 255 characters or fewer', 400);
  if (file.size > MAX_SOURCE_BYTES) {
    return jsonError('Source files must be 50 MB or smaller', 413);
  }
  if (!SUPPORTED_SOURCE_EXTENSIONS.has(extension(filename))) {
    return jsonError('Source files must be PDF, PPTX, DOCX, or XLSX', 415);
  }

  const { courseId } = await params;
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true } });
  if (!course) return jsonError('Course not found', 404);

  const bytes = Buffer.from(await file.arrayBuffer());
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const contentType = file.type || 'application/octet-stream';
  let uploaded: Awaited<ReturnType<typeof putCourseAsset>> | undefined;
  let source: Awaited<ReturnType<typeof createPendingSource>> | undefined;

  try {
    uploaded = await putCourseAsset({
      courseId: `${courseId}/sources`,
      filename,
      contentType,
      bytes,
    });
    source = await createPendingSource({
      courseId,
      r2Key: uploaded.r2Key,
      filename,
      contentType,
      byteSize: bytes.byteLength,
      sha256,
    });
    const job = await enqueueDocumentIndexJob(
      {
        sourceId: source.id,
        courseId,
        sha256,
        filename: source.filename,
        contentType: source.contentType,
      },
      bytes,
    );
    return NextResponse.json({ source, job }, { status: 202 });
  } catch (error) {
    if (source) {
      await removeCourseSource(courseId, source.id).catch((cleanupError) => {
        console.error('[course-studio/sources] pending source cleanup failed:', cleanupError);
      });
    }
    if (uploaded) {
      await deleteCourseAsset(uploaded.r2Key).catch((cleanupError) => {
        console.error('[course-studio/sources] R2 cleanup failed:', cleanupError);
      });
    }
    console.error('[course-studio/sources] upload failed:', error);
    return jsonError('Source upload failed', 500);
  }
}
