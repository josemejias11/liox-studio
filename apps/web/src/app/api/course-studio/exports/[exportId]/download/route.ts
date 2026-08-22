import { NextRequest } from 'next/server';
import { prisma } from '@moto-ai/database';
import { getObject } from '@moto-ai/storage';
import { isCourseStudioAuthorized } from '@/server/auth/course-studio';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ exportId: string }> },
) {
  if (!(await isCourseStudioAuthorized(request))) return new Response('Unauthorized', { status: 401 });

  const { exportId } = await params;
  const record = await prisma.courseScormExport.findUnique({ where: { id: exportId } });
  if (!record) return new Response('Export not found', { status: 404 });

  try {
    const object = await getObject(record.r2Key);
    if (!object.Body) return new Response('Export not found', { status: 404 });

    const headers = new Headers({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="scorm-export-${record.id}.zip"`,
      'Content-Length': String(record.byteSize),
    });

    return new Response(object.Body.transformToWebStream(), { headers });
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 404) return new Response('Export not found', { status: 404 });
    console.error('[api/course-studio/exports] storage read failed');
    return new Response('Export unavailable', { status: 502 });
  }
}
