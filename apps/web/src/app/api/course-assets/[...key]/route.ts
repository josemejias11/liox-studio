import { getCourseAsset } from '@/server/storage/course-assets';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const segments = (await params).key;
  if (
    segments.length < 2 ||
    segments[0] !== 'courses' ||
    segments.some((segment) => !segment || segment === '.' || segment === '..')
  ) {
    return new Response('Invalid asset key', { status: 400 });
  }

  try {
    const object = await getCourseAsset(segments.join('/'));
    if (!object.Body) return new Response('Asset not found', { status: 404 });

    const headers = new Headers({
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Type': object.ContentType ?? 'application/octet-stream',
    });
    if (object.ContentLength !== undefined) {
      headers.set('Content-Length', String(object.ContentLength));
    }
    if (object.ETag) headers.set('ETag', object.ETag);

    return new Response(object.Body.transformToWebStream(), { headers });
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 404) return new Response('Asset not found', { status: 404 });
    console.error('[api/course-assets] R2 read failed');
    return new Response('Asset unavailable', { status: 502 });
  }
}
