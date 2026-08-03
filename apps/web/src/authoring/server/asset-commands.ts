import { prisma } from '@moto-ai/database';
import { deleteCourseAsset, putCourseAsset } from '@/server/storage/course-assets';

export async function uploadAuthoringAsset({
  courseId,
  filename,
  contentType,
  bytes,
}: {
  courseId: string;
  filename: string;
  contentType?: string;
  bytes: Uint8Array;
}) {
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true } });
  if (!course) throw new Error('COURSE_NOT_FOUND');

  let uploaded: Awaited<ReturnType<typeof putCourseAsset>> | undefined;
  try {
    uploaded = await putCourseAsset({ courseId, filename, contentType, bytes });
    return await prisma.courseAsset.create({
      data: {
        r2Key: uploaded.r2Key,
        filename: uploaded.filename ?? filename,
        contentType: uploaded.contentType,
        byteSize: bytes.byteLength,
        deliveryUrl: uploaded.url,
      },
    });
  } catch (error) {
    if (uploaded) await deleteCourseAsset(uploaded.r2Key).catch(() => undefined);
    throw error;
  }
}
