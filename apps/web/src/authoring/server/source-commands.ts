import { createHash } from 'node:crypto';
import {
  beginCourseSourceRemoval,
  completeCourseSourceRemoval,
  createPendingSource,
  getCourseSource,
  listCourseSources,
  markSourceFailed,
  prisma,
  retryCourseSourceIndex,
} from '@moto-ai/database';
import { enqueueDocumentIndexJob } from '@moto-ai/jobs';
import { deleteCourseDocument, RagServiceError } from '@moto-ai/parser-client';
import { deleteCourseAsset, getCourseAsset, putCourseAsset } from '@/server/storage/course-assets';

export async function uploadAuthoringSource({
  courseId,
  filename,
  contentType,
  bytes,
}: {
  courseId: string;
  filename: string;
  contentType: string;
  bytes: Buffer;
}) {
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true } });
  if (!course) throw new Error('COURSE_NOT_FOUND');

  const sha256 = createHash('sha256').update(bytes).digest('hex');
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
    return { source, job };
  } catch (error) {
    if (source) {
      const sourceId = source.id;
      await beginCourseSourceRemoval(courseId, sourceId)
        .then(() => (uploaded ? deleteCourseAsset(uploaded.r2Key) : undefined))
        .then(() => completeCourseSourceRemoval(courseId, sourceId))
        .catch((cleanupError) =>
          console.error('[authoring/source-upload] cleanup failed:', cleanupError),
        );
    } else if (uploaded) {
      await deleteCourseAsset(uploaded.r2Key).catch((cleanupError) =>
        console.error('[authoring/source-upload] R2 cleanup failed:', cleanupError),
      );
    }
    throw error;
  }
}

export function listAuthoringSources(courseId: string) {
  return listCourseSources(courseId);
}

export async function removeAuthoringSource(courseId: string, sourceId: string) {
  const source = await beginCourseSourceRemoval(courseId, sourceId);
  const cleanup = await Promise.allSettled([
    deleteCourseAsset(source.r2Key),
    deleteCourseDocument(courseId, sourceId),
  ]);
  const rejected = cleanup.filter(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  );
  if (rejected.length > 0) {
    for (const result of rejected) {
      console.error('[course-studio/sources] source cleanup failed:', result.reason);
    }
    throw new SourceCleanupIncompleteError();
  }
  return completeCourseSourceRemoval(courseId, sourceId);
}

export class SourceCleanupIncompleteError extends Error {
  constructor() {
    super('SOURCE_CLEANUP_INCOMPLETE');
    this.name = 'SourceCleanupIncompleteError';
  }
}

export { RagServiceError };

export async function retryAuthoringSourceIndex(courseId: string, sourceId: string) {
  const source = await getCourseSource(courseId, sourceId);
  if (source.indexStatus !== 'failed') throw new Error('COURSE_SOURCE_RETRY_NOT_ALLOWED');

  const object = await getCourseAsset(source.r2Key);
  if (!object.Body) throw new SourceAssetUnavailableError('SOURCE_ASSET_UNAVAILABLE');
  const bytes = Buffer.from(await object.Body.transformToByteArray());
  if (createHash('sha256').update(bytes).digest('hex') !== source.sha256) {
    throw new SourceAssetUnavailableError('SOURCE_ASSET_MISMATCH');
  }

  const pending = await retryCourseSourceIndex(courseId, sourceId);
  try {
    const job = await enqueueDocumentIndexJob(
      {
        sourceId,
        courseId,
        sha256: pending.sha256,
        filename: pending.filename,
        contentType: pending.contentType,
      },
      bytes,
    );
    return { source: pending, job };
  } catch (error) {
    await markSourceFailed(
      courseId,
      sourceId,
      'The retry could not be queued. Try again when the processing service is available.',
    ).catch(() => undefined);
    throw error;
  }
}

export class SourceAssetUnavailableError extends Error {
  constructor(readonly code: 'SOURCE_ASSET_UNAVAILABLE' | 'SOURCE_ASSET_MISMATCH') {
    super(code);
    this.name = 'SourceAssetUnavailableError';
  }
}
