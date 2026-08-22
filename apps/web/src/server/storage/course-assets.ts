import { getObject, putObject, deleteObject } from '@moto-ai/storage';
import type { CourseAssetRef } from '@moto-ai/contracts/course-assets';

export interface CourseAssetUpload {
  courseId: string;
  filename: string;
  contentType?: string;
  bytes: Uint8Array;
}

function safeFilename(filename: string): string {
  const normalized = filename.normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g, '-');
  return normalized.replace(/-+/g, '-').replace(/^-|-$/g, '') || 'asset';
}

function createCourseAssetKey(courseId: string, filename: string): string {
  return `courses/${courseId}/${crypto.randomUUID()}-${safeFilename(filename)}`;
}

function courseAssetUrl(r2Key: string): string {
  return `/api/course-assets/${r2Key.split('/').map(encodeURIComponent).join('/')}`;
}

export async function putCourseAsset(
  input: CourseAssetUpload,
): Promise<CourseAssetRef & { r2Key: string }> {
  const r2Key = createCourseAssetKey(input.courseId, input.filename);
  await putObject({ key: r2Key, bytes: input.bytes, contentType: input.contentType });

  return {
    id: r2Key,
    r2Key,
    url: courseAssetUrl(r2Key),
    filename: input.filename,
    contentType: input.contentType,
  };
}

export async function getCourseAsset(r2Key: string) {
  return getObject(r2Key);
}

export async function deleteCourseAsset(r2Key: string): Promise<void> {
  await deleteObject(r2Key);
}
