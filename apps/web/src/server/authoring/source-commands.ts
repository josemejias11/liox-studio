import { createHash } from 'node:crypto';
import {
  beginCourseSourceRemoval,
  completeCourseSourceRemoval,
  createPendingSource,
  prisma,
} from '@moto-ai/database';
import { enqueueDocumentIndexJob } from '@moto-ai/jobs';
import { deleteCourseAsset, putCourseAsset } from '@/lib/r2';

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
    uploaded = await putCourseAsset({ courseId: `${courseId}/sources`, filename, contentType, bytes });
    source = await createPendingSource({
      courseId,
      r2Key: uploaded.r2Key,
      filename,
      contentType,
      byteSize: bytes.byteLength,
      sha256,
    });
    const job = await enqueueDocumentIndexJob(
      { sourceId: source.id, courseId, sha256, filename: source.filename, contentType: source.contentType },
      bytes,
    );
    return { source, job };
  } catch (error) {
    if (source) {
      const sourceId = source.id;
      await beginCourseSourceRemoval(courseId, sourceId)
        .then(() => (uploaded ? deleteCourseAsset(uploaded.r2Key) : undefined))
        .then(() => completeCourseSourceRemoval(courseId, sourceId))
        .catch((cleanupError) => console.error('[authoring/source-upload] cleanup failed:', cleanupError));
    } else if (uploaded) {
      await deleteCourseAsset(uploaded.r2Key).catch((cleanupError) =>
        console.error('[authoring/source-upload] R2 cleanup failed:', cleanupError),
      );
    }
    throw error;
  }
}
